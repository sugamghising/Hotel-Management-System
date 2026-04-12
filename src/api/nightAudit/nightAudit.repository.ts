import { config } from '../../config';
import {
  AuditAlreadyCompletedError,
  AuditAlreadyInProgressError,
  NotFoundError,
} from '../../core/errors';
import { prisma } from '../../database/prisma';
import { type NightAudit, Prisma } from '../../generated/prisma';
import type { NightAuditRollbackSummary } from './nightAudit.rollback';
import type { NightAuditHistoryQueryInput } from './nightAudit.schema';
import type {
  NightAuditActionSummary,
  NightAuditFinancialSummary,
  NightAuditPreCheckSnapshot,
  NightAuditStepResult,
} from './nightAudit.types';

const OPEN_MAINTENANCE_STATUSES = [
  'REPORTED',
  'ACKNOWLEDGED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_PARTS',
] as const;

export interface NightAuditHotelScope {
  id: string;
  organizationId: string;
  name: string;
  currentBusinessDate: Date;
}

export interface NightAuditListResult {
  items: NightAudit[];
  total: number;
}

/**
 * Normalizes timestamps to UTC midnight for business-date comparisons and writes.
 *
 * @param value - Source timestamp.
 * @returns Date-only UTC value.
 */
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Returns the inclusive end-of-day boundary in UTC for aggregate payment queries.
 *
 * @param value - Business date anchor.
 * @returns UTC timestamp at `23:59:59.999`.
 */
const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

/**
 * Computes the next UTC business date from a normalized date.
 *
 * @param value - Current business date.
 * @returns Next day at UTC midnight.
 */
const nextDay = (value: Date): Date => {
  const date = asDateOnly(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

/**
 * Converts nullable Prisma Decimal values to native numbers.
 *
 * @param value - Aggregate decimal value or `null`.
 * @returns Numeric value with `0` fallback when absent.
 */
const toNumber = (value: Prisma.Decimal | null): number =>
  value ? Number.parseFloat(value.toString()) : 0;

/**
 * Produces a JSON-safe deep clone for Prisma JSON persistence.
 *
 * @param value - Arbitrary serializable payload.
 * @returns Payload typed as `Prisma.InputJsonValue`.
 */
const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class NightAuditRepository {
  /**
   * Resolves and validates the hotel scope by organization and hotel identifiers.
   *
   * This enforces tenant boundaries for all night-audit operations that follow.
   *
   * @param organizationId - Organization tenant identifier.
   * @param hotelId - Hotel identifier expected to belong to the organization.
   * @returns Minimal hotel scope metadata used by service-level orchestration.
   * @throws {NotFoundError} When the hotel is missing, deleted, or outside the organization scope.
   */
  async findHotelScope(organizationId: string, hotelId: string): Promise<NightAuditHotelScope> {
    const hotel = await prisma.hotel.findFirst({
      where: {
        id: hotelId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        currentBusinessDate: true,
      },
    });

    if (!hotel) {
      throw new NotFoundError(`Hotel not found with id: ${hotelId}`);
    }

    return hotel;
  }

  /**
   * Retrieves a single audit by id with optional hotel scoping.
   *
   * @param auditId - Audit primary key.
   * @param hotelId - Optional hotel scope guard for multi-tenant safety.
   * @returns Matching audit or `null` when not found.
   */
  async findAuditById(auditId: string, hotelId?: string): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: {
        id: auditId,
        ...(hotelId ? { hotelId } : {}),
      },
    });
  }

  /**
   * Retrieves an audit for a specific hotel business date.
   *
   * @param hotelId - Hotel identifier.
   * @param businessDate - Business date normalized to UTC date-only in query.
   * @returns Matching audit or `null`.
   */
  async findAuditByBusinessDate(hotelId: string, businessDate: Date): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: {
        hotelId,
        businessDate: asDateOnly(businessDate),
      },
    });
  }

  /**
   * Returns the most recent audit for a hotel ordered by business date descending.
   *
   * @param hotelId - Hotel identifier.
   * @returns Latest audit row or `null` when no audits exist.
   */
  async findLatestAudit(hotelId: string): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: { hotelId },
      orderBy: [{ businessDate: 'desc' }],
    });
  }

  /**
   * Lists paginated audit history and total count for a hotel.
   *
   * Both queries execute in a single Prisma transaction to keep paging metadata
   * and result set consistent within the same read snapshot.
   *
   * @param hotelId - Hotel identifier.
   * @param query - Pagination options (`page`, `limit`).
   * @returns Paginated audits with total row count.
   */
  async listAuditHistory(
    hotelId: string,
    query: NightAuditHistoryQueryInput
  ): Promise<NightAuditListResult> {
    const [items, total] = await prisma.$transaction([
      prisma.nightAudit.findMany({
        where: { hotelId },
        orderBy: [{ businessDate: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.nightAudit.count({ where: { hotelId } }),
    ]);

    return { items, total };
  }

  /**
   * Builds the pre-check snapshot used to decide whether a night audit can run.
   *
   * The method executes five scoped read queries in parallel to capture unresolved
   * departures, unbalanced folios, in-house occupancy, posted room-charge coverage,
   * and room-status discrepancies for the target business date. It then derives
   * blocker messages and `canRun` from those counters without mutating any state.
   *
   * @param organizationId - Organization identifier used for tenant scoping.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @param businessDate - Candidate business date for the audit run.
   * @returns Snapshot counters, blocker details, and final run eligibility.
   * @remarks Complexity: O(1) application-side processing with five database queries whose runtime scales with scoped reservation, folio, and room volumes.
   */
  async calculatePreCheckSnapshot(
    organizationId: string,
    hotelId: string,
    businessDate: Date
  ): Promise<NightAuditPreCheckSnapshot> {
    const auditDate = asDateOnly(businessDate);

    const [
      uncheckedOutReservations,
      unbalancedFolios,
      inHouseCount,
      roomChargeGroups,
      roomDiscrepancies,
    ] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          organizationId,
          hotelId,
          status: 'CHECKED_IN',
          checkOutDate: { lte: auditDate },
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: { in: ['CHECKED_OUT', 'NO_SHOW'] },
          balance: { not: new Prisma.Decimal(0) },
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: 'CHECKED_IN',
          checkInDate: { lte: auditDate },
          checkOutDate: { gt: auditDate },
        },
      }),
      prisma.folioItem.groupBy({
        by: ['reservationId'],
        where: {
          hotelId,
          businessDate: auditDate,
          itemType: 'ROOM_CHARGE',
          isVoided: false,
          source: 'NIGHT_AUDIT',
        },
      }),
      prisma.room.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: {
            in: ['OCCUPIED_CLEAN', 'OCCUPIED_DIRTY', 'OCCUPIED_CLEANING'],
          },
          reservations: {
            none: {
              reservation: {
                status: 'CHECKED_IN',
                deletedAt: null,
                checkInDate: { lte: auditDate },
                checkOutDate: { gt: auditDate },
              },
            },
          },
        },
      }),
    ]);

    const pendingCharges = Math.max(0, inHouseCount - roomChargeGroups.length);
    const uncheckedOutReservationIds = uncheckedOutReservations.map(
      (reservation) => reservation.id
    );

    const blockers =
      uncheckedOutReservationIds.length > 0
        ? [
            `${uncheckedOutReservationIds.length} checked-in reservation(s) have departure date on or before ${auditDate.toISOString().slice(0, 10)}`,
          ]
        : [];

    return {
      businessDate: auditDate,
      unbalancedFolios,
      uncheckedOutRes: uncheckedOutReservationIds.length,
      pendingCharges,
      roomDiscrepancies,
      uncheckedOutReservationIds,
      blockers,
      canRun: uncheckedOutReservationIds.length === 0,
    };
  }

  /**
   * Creates or reinitializes an audit record in `IN_PROGRESS` state.
   *
   * Guards prevent duplicate completion and concurrent in-progress batches for the same hotel.
   * On existing non-completed rows for the same business date, state is reset for rerun.
   *
   * @param hotelId - Hotel identifier.
   * @param businessDate - Target audit business date.
   * @param performedBy - User/system actor id assigned to the audit.
   * @param notes - Optional operator notes persisted on the audit row.
   * @param preCheck - Snapshot counters copied into the audit record.
   * @returns Newly created or updated `IN_PROGRESS` audit.
   * @throws {AuditAlreadyCompletedError} When the audit date is already finalized.
   * @throws {AuditAlreadyInProgressError} When another audit run is active for the hotel.
   */
  async startAudit(
    hotelId: string,
    businessDate: Date,
    performedBy: string,
    notes: string | undefined,
    preCheck: NightAuditPreCheckSnapshot
  ): Promise<NightAudit> {
    const auditDate = asDateOnly(businessDate);
    const existing = await this.findAuditByBusinessDate(hotelId, auditDate);

    if (existing?.status === 'COMPLETED') {
      throw new AuditAlreadyCompletedError(auditDate.toISOString().slice(0, 10));
    }

    const inProgress = await prisma.nightAudit.findFirst({
      where: {
        hotelId,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });

    if (inProgress && inProgress.id !== existing?.id) {
      throw new AuditAlreadyInProgressError();
    }

    const data = {
      status: 'IN_PROGRESS' as const,
      startedAt: new Date(),
      completedAt: null,
      performedBy,
      unbalancedFolios: preCheck.unbalancedFolios,
      uncheckedOutRes: preCheck.uncheckedOutRes,
      pendingCharges: preCheck.pendingCharges,
      roomDiscrepancies: preCheck.roomDiscrepancies,
      roomRevenue: 0,
      otherRevenue: 0,
      paymentsReceived: 0,
      autoPostedCharges: 0,
      noShowsMarked: 0,
      errors: Prisma.JsonNull,
      notes: notes ?? null,
    };

    if (existing) {
      return prisma.nightAudit.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.nightAudit
      .create({
        data: {
          hotelId,
          businessDate: auditDate,
          ...data,
        },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const prismaError = error as Prisma.PrismaClientKnownRequestError;
          if (prismaError.code === 'P2002') {
            const target = (prismaError.meta as { target?: unknown } | undefined)?.target;
            const targets = Array.isArray(target) ? target : [target];
            if (targets.filter(Boolean).includes('uq_night_audit_hotel_in_progress')) {
              throw new AuditAlreadyInProgressError();
            }
          }
        }
        throw error;
      });
  }

  /**
   * Finalizes an audit as `COMPLETED` and persists financial/action summaries.
   *
   * Step execution results are embedded into the `errors` JSON payload for report rendering.
   *
   * @param auditId - Audit identifier.
   * @param financial - Computed room/other revenue and payment totals.
   * @param actions - Batch action counters captured during execution.
   * @param steps - Ordered step outcomes.
   * @param warningCount - Number of non-hard-fail step failures.
   * @returns Updated completed audit row.
   */
  async completeAudit(
    auditId: string,
    financial: NightAuditFinancialSummary,
    actions: NightAuditActionSummary,
    steps: NightAuditStepResult[],
    warningCount: number
  ): Promise<NightAudit> {
    return prisma.nightAudit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        roomRevenue: financial.roomRevenue,
        otherRevenue: financial.otherRevenue,
        paymentsReceived: financial.paymentsReceived,
        autoPostedCharges: actions.autoPostedCharges,
        noShowsMarked: actions.noShowsMarked,
        errors: {
          steps,
          warningCount,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Marks an audit as `FAILED` with structured failure payload.
   *
   * @param auditId - Audit identifier.
   * @param payload - Failure metadata and captured step context.
   * @returns Updated failed audit row.
   */
  async failAudit(auditId: string, payload: Prisma.InputJsonValue): Promise<NightAudit> {
    return prisma.nightAudit.update({
      where: { id: auditId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errors: payload,
      },
    });
  }

  /**
   * Marks an audit as `ROLLED_BACK` and persists rollback metadata.
   *
   * @param auditId - Audit identifier.
   * @param rollbackPayload - Structured rollback details saved to `errors`.
   * @param notes - Optional operator-visible rollback note.
   * @returns Updated rolled-back audit row.
   */
  async markRolledBack(
    auditId: string,
    rollbackPayload: Prisma.InputJsonValue,
    notes?: string
  ): Promise<NightAudit> {
    return prisma.nightAudit.update({
      where: { id: auditId },
      data: {
        status: 'ROLLED_BACK',
        errors: rollbackPayload,
        notes: notes ?? null,
      },
    });
  }

  /**
   * Computes financial totals for a hotel's audit date window.
   *
   * Revenue is split into room and non-room folio categories, while payments are
   * aggregated from captured non-refund transactions processed on the same day.
   *
   * @param hotelId - Hotel identifier.
   * @param businessDate - Audit business date used for UTC date boundaries.
   * @returns Financial summary consumed by audit completion.
   */
  async computeFinancialSummary(
    hotelId: string,
    businessDate: Date
  ): Promise<NightAuditFinancialSummary> {
    const auditDate = asDateOnly(businessDate);
    const endOfDay = endOfDayUtc(auditDate);

    const [roomRevenueAgg, otherRevenueAgg, paymentsAgg] = await Promise.all([
      prisma.folioItem.aggregate({
        where: {
          hotelId,
          businessDate: auditDate,
          itemType: 'ROOM_CHARGE',
          isVoided: false,
        },
        _sum: {
          amount: true,
          taxAmount: true,
        },
      }),
      prisma.folioItem.aggregate({
        where: {
          hotelId,
          businessDate: auditDate,
          itemType: {
            notIn: ['ROOM_CHARGE', 'PAYMENT', 'REFUND'],
          },
          isVoided: false,
        },
        _sum: {
          amount: true,
          taxAmount: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          hotelId,
          isRefund: false,
          status: 'CAPTURED',
          processedAt: {
            gte: auditDate,
            lte: endOfDay,
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const roomRevenue =
      toNumber(roomRevenueAgg._sum.amount) + toNumber(roomRevenueAgg._sum.taxAmount);
    const otherRevenue =
      toNumber(otherRevenueAgg._sum.amount) + toNumber(otherRevenueAgg._sum.taxAmount);

    return {
      roomRevenue,
      otherRevenue,
      paymentsReceived: toNumber(paymentsAgg._sum.amount),
    };
  }

  /**
   * Marks eligible confirmed reservations as no-show for the audit date.
   *
   * Writes occur inside a single transaction boundary:
   * - reservation status transitions (`CONFIRMED` -> `NO_SHOW`)
   * - outbox event creation for downstream processing
   *
   * Organization/hotel constraints are applied in the candidate selection query.
   *
   * @param auditId - Audit identifier stamped onto affected reservations.
   * @param organizationId - Organization tenant identifier.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @param businessDate - Effective business date for eligibility.
   * @returns Count and ids of reservations transitioned to no-show.
   */
  async markNoShowsForAudit(
    auditId: string,
    organizationId: string,
    hotelId: string,
    businessDate: Date
  ): Promise<{ count: number; reservationIds: string[] }> {
    const auditDate = asDateOnly(businessDate);
    const now = new Date();

    const candidates = await prisma.reservation.findMany({
      where: {
        organizationId,
        hotelId,
        status: 'CONFIRMED',
        noShow: false,
        noShowAuditId: null,
        checkInDate: {
          lte: auditDate,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (candidates.length === 0) {
      return { count: 0, reservationIds: [] };
    }

    const reservationIds = candidates.map((candidate) => candidate.id);

    await prisma.$transaction(async (tx) => {
      await tx.reservation.updateMany({
        where: {
          id: { in: reservationIds },
        },
        data: {
          status: 'NO_SHOW',
          noShow: true,
          noShowAuditId: auditId,
          cancellationReason: 'AUTO_NO_SHOW_NIGHT_AUDIT',
          modifiedAt: now,
        },
      });

      await tx.outboxEvent.createMany({
        data: reservationIds.map((reservationId) => ({
          eventType: 'reservation.no_show',
          aggregateType: 'RESERVATION',
          aggregateId: reservationId,
          payload: {
            organizationId,
            hotelId,
            reservationId,
            markedAt: now.toISOString(),
            chargeNoShowFee: false,
            reason: 'AUTO_NO_SHOW_NIGHT_AUDIT',
            auditId,
          } satisfies Prisma.InputJsonValue,
        })),
      });
    });

    return {
      count: reservationIds.length,
      reservationIds,
    };
  }

  /**
   * Voids non-voided room charges generated by a specific night audit batch.
   *
   * Only folio items with `source = 'NIGHT_AUDIT'`, matching `sourceRef`, and
   * `itemType = 'ROOM_CHARGE'` are targeted. The method first aggregates count and
   * monetary impact, then applies a bulk void update when there is anything to reverse.
   *
   * @param auditId - Night audit identifier stored in `folio_items.sourceRef`.
   * @param actorId - User/system actor stored in void-audit metadata.
   * @returns Count of voided room charges and combined amount-plus-tax reversed.
   * @remarks Complexity: O(f) in matching folio rows, dominated by aggregate + bulk update scans.
   */
  async rollbackRoomCharges(
    auditId: string,
    actorId: string
  ): Promise<{ voidedRoomCharges: number; voidedAmount: number }> {
    const where = {
      source: 'NIGHT_AUDIT' as const,
      sourceRef: auditId,
      isVoided: false,
      itemType: 'ROOM_CHARGE' as const,
    };

    const summary = await prisma.folioItem.aggregate({
      where,
      _count: { _all: true },
      _sum: { amount: true, taxAmount: true },
    });

    if (summary._count._all === 0) {
      return {
        voidedRoomCharges: 0,
        voidedAmount: 0,
      };
    }

    await prisma.folioItem.updateMany({
      where,
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidedBy: actorId,
        voidReason: `Rolled back by night audit ${auditId}`,
      },
    });

    return {
      voidedRoomCharges: summary._count._all,
      voidedAmount: toNumber(summary._sum.amount) + toNumber(summary._sum.taxAmount),
    };
  }

  /**
   * Reverts reservations auto-marked as `'NO_SHOW'` by the target audit batch.
   *
   * Matching rows are reset back to `'CONFIRMED'` and no-show/cancellation fields
   * are cleared so front-office state reflects pre-audit status.
   *
   * @param auditId - Night audit identifier stamped in `reservation.noShowAuditId`.
   * @returns Number of reservations reverted from `'NO_SHOW'` to `'CONFIRMED'`.
   * @remarks Complexity: O(r) in matching reservation rows processed by a single bulk update.
   */
  async rollbackNoShows(auditId: string): Promise<number> {
    const updated = await prisma.reservation.updateMany({
      where: {
        noShowAuditId: auditId,
        status: 'NO_SHOW',
      },
      data: {
        status: 'CONFIRMED',
        noShow: false,
        noShowAuditId: null,
        cancellationReason: null,
        cancellationFee: null,
        modifiedAt: new Date(),
      },
    });

    return updated.count;
  }

  /**
   * Cancels generated stayover housekeeping tasks linked to a night audit batch.
   *
   * Only active task states (`'PENDING'`, `'IN_PROGRESS'`, `'DND'`, `'ISSUES_REPORTED'`)
   * are transitioned to `'CANCELLED'`, preserving completed history.
   *
   * @param auditId - Night audit identifier stored in `nightAuditBatchId`.
   * @param actorId - User/system actor stored in cancellation metadata.
   * @param reason - Human-readable cancellation reason saved on each task.
   * @returns Number of housekeeping tasks moved to `'CANCELLED'`.
   * @remarks Complexity: O(t) in matching housekeeping-task rows updated in bulk.
   */
  async rollbackStayoverTasks(auditId: string, actorId: string, reason: string): Promise<number> {
    const updated = await prisma.housekeepingTask.updateMany({
      where: {
        nightAuditBatchId: auditId,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED'],
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: actorId,
        cancellationReason: reason,
      },
    });

    return updated.count;
  }

  /**
   * Cancels open preventive maintenance requests generated by the audit batch.
   *
   * Requests are matched by `source = 'PREVENTIVE'` and `sourceRef = auditId`, then
   * open statuses are transitioned to `'CANCELLED'` with actor and reason metadata.
   *
   * @param auditId - Night audit identifier stored in `maintenance_requests.sourceRef`.
   * @param actorId - User/system actor stored in cancellation metadata.
   * @param reason - Human-readable cancellation reason saved on each request.
   * @returns Number of preventive requests transitioned to `'CANCELLED'`.
   * @remarks Complexity: O(m) in matching maintenance-request rows updated in bulk.
   */
  async rollbackPreventiveRequests(
    auditId: string,
    actorId: string,
    reason: string
  ): Promise<number> {
    const updated = await prisma.maintenanceRequest.updateMany({
      where: {
        source: 'PREVENTIVE',
        sourceRef: auditId,
        status: {
          in: [...OPEN_MAINTENANCE_STATUSES],
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledBy: actorId,
        cancellationReason: reason,
      },
    });

    return updated.count;
  }

  /**
   * Sets the hotel's current business date to a normalized UTC day boundary.
   *
   * The update is organization/hotel scoped and rejects missing/deleted hotel rows
   * by requiring exactly one row to be updated.
   *
   * @param organizationId - Organization identifier used for tenant scoping.
   * @param hotelId - Hotel identifier to update.
   * @param businessDate - New business date (normalized to UTC date-only precision).
   * @returns Persisted normalized business date value.
   * @throws {NotFoundError} When the scoped hotel does not exist.
   * @remarks Complexity: O(1) application work with one scoped bulk-update statement.
   */
  async updateHotelBusinessDate(
    organizationId: string,
    hotelId: string,
    businessDate: Date
  ): Promise<Date> {
    const targetDate = asDateOnly(businessDate);

    const result = await prisma.hotel.updateMany({
      where: {
        id: hotelId,
        organizationId,
        deletedAt: null,
      },
      data: {
        currentBusinessDate: targetDate,
      },
    });

    if (result.count !== 1) {
      throw new NotFoundError(`Hotel not found with id: ${hotelId}`);
    }

    return targetDate;
  }

  /**
   * Advances the scoped hotel's business date by one UTC calendar day.
   *
   * This helper computes the next date from the provided business date and delegates
   * persistence/validation to `updateHotelBusinessDate`.
   *
   * @param organizationId - Organization identifier used for tenant scoping.
   * @param hotelId - Hotel identifier to advance.
   * @param businessDate - Current business date baseline.
   * @returns Next business date persisted for the hotel.
   * @throws {NotFoundError} When the scoped hotel does not exist.
   * @remarks Complexity: O(1) plus the delegated single-row update.
   */
  async advanceHotelBusinessDate(
    organizationId: string,
    hotelId: string,
    businessDate: Date
  ): Promise<Date> {
    const nextBusinessDate = nextDay(businessDate);
    await this.updateHotelBusinessDate(organizationId, hotelId, nextBusinessDate);
    return nextBusinessDate;
  }

  /**
   * Persists a night-audit domain event into the outbox for async processing.
   *
   * Outbox rows are written with fixed retry policy (`maxAttempts = 5`) and initial
   * status `'PENDING'` so downstream dispatch workers can pick them up.
   *
   * @param eventType - Domain event name (for example `night_audit.completed`).
   * @param aggregateId - Night audit identifier associated with the event.
   * @param payload - JSON payload serialized for downstream consumers.
   * @returns Resolves when the outbox row has been inserted.
   * @remarks Complexity: O(1) single-row insert.
   */
  async createOutboxEvent(
    eventType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue
  ): Promise<void> {
    await prisma.outboxEvent.create({
      data: {
        eventType,
        aggregateType: 'NIGHT_AUDIT',
        aggregateId,
        payload,
        maxAttempts: 5,
        status: 'PENDING',
      },
    });
  }

  /**
   * Returns the configured system user identifier for automated audit actions.
   *
   * @returns Stable system actor id from runtime configuration.
   */
  getSystemActorId(): string {
    return config.system.userId;
  }

  /**
   * Executes the full night-audit rollback mutation set atomically.
   *
   * Inside one database transaction, this method:
   * 1) voids `'ROOM_CHARGE'` folio items posted by the audit,
   * 2) reverts audit-marked reservation `'NO_SHOW'` statuses to `'CONFIRMED'`,
   * 3) cancels generated stayover housekeeping tasks,
   * 4) cancels generated preventive maintenance requests,
   * 5) restores the hotel's business date to the audit date,
   * 6) marks the audit row as `'ROLLED_BACK'`, and
   * 7) writes a `night_audit.rolled_back` outbox event.
   *
   * @param params - Rollback context including target audit id, scope ids, actor, reason, and previous status.
   * @returns Rollback counters plus the persisted rolled-back audit record.
   * @throws {NotFoundError} When the scoped hotel cannot be updated during rollback.
   * @remarks Complexity: O(f + r + h + m) where `f` is matched folio rows, `r` matched reservations, `h` matched housekeeping tasks, and `m` matched maintenance requests.
   */
  async performRollbackTransaction(params: {
    targetAuditId: string;
    businessDate: Date;
    organizationId: string;
    hotelId: string;
    actorId: string;
    reason: string;
    previousStatus: string;
  }): Promise<{
    rollbackSummary: NightAuditRollbackSummary;
    rolledBackAudit: NightAudit;
  }> {
    const {
      targetAuditId,
      businessDate,
      organizationId,
      hotelId,
      actorId,
      reason,
      previousStatus,
    } = params;

    return prisma.$transaction(async (tx) => {
      // 1. Void all NIGHT_AUDIT room charges for this audit
      const chargeWhere = {
        source: 'NIGHT_AUDIT' as const,
        sourceRef: targetAuditId,
        isVoided: false,
        itemType: 'ROOM_CHARGE' as const,
      };
      const chargeSummary = await tx.folioItem.aggregate({
        where: chargeWhere,
        _count: { _all: true },
        _sum: { amount: true, taxAmount: true },
      });
      if (chargeSummary._count._all > 0) {
        await tx.folioItem.updateMany({
          where: chargeWhere,
          data: {
            isVoided: true,
            voidedAt: new Date(),
            voidedBy: actorId,
            voidReason: `Rolled back by night audit ${targetAuditId}`,
          },
        });
      }
      const voidedRoomCharges = chargeSummary._count._all;

      // 2. Revert no-show reservations
      const noShowResult = await tx.reservation.updateMany({
        where: { noShowAuditId: targetAuditId, status: 'NO_SHOW' },
        data: {
          status: 'CONFIRMED',
          noShow: false,
          noShowAuditId: null,
          cancellationReason: null,
          cancellationFee: null,
          modifiedAt: new Date(),
        },
      });
      const revertedNoShows = noShowResult.count;

      // 3. Cancel stayover housekeeping tasks
      const stayoverResult = await tx.housekeepingTask.updateMany({
        where: {
          nightAuditBatchId: targetAuditId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: actorId,
          cancellationReason: reason,
        },
      });
      const cancelledStayoverTasks = stayoverResult.count;

      // 4. Cancel preventive maintenance requests
      const preventiveResult = await tx.maintenanceRequest.updateMany({
        where: {
          source: 'PREVENTIVE',
          sourceRef: targetAuditId,
          status: { in: [...OPEN_MAINTENANCE_STATUSES] },
        },
        data: { status: 'CANCELLED', cancelledBy: actorId, cancellationReason: reason },
      });
      const cancelledPreventiveRequests = preventiveResult.count;

      // 5. Revert hotel business date back to the audit's business date
      const targetDate = asDateOnly(businessDate);
      const hotelResult = await tx.hotel.updateMany({
        where: { id: hotelId, organizationId, deletedAt: null },
        data: { currentBusinessDate: targetDate },
      });
      if (hotelResult.count !== 1) {
        throw new NotFoundError(`Hotel not found with id: ${hotelId}`);
      }

      const rollbackSummary: NightAuditRollbackSummary = {
        voidedRoomCharges,
        revertedNoShows,
        cancelledStayoverTasks,
        cancelledPreventiveRequests,
      };

      const rollbackPayload = asJson({
        rolledBackAt: new Date().toISOString(),
        rolledBackBy: actorId,
        reason,
        rollback: rollbackSummary,
        previousStatus,
      });

      // 6. Mark the audit as ROLLED_BACK
      const rolledBackAudit = await tx.nightAudit.update({
        where: { id: targetAuditId },
        data: { status: 'ROLLED_BACK', errors: rollbackPayload, notes: reason ?? null },
      });

      // 7. Create outbox event (inside transaction for atomicity)
      await tx.outboxEvent.create({
        data: {
          eventType: 'night_audit.rolled_back',
          aggregateType: 'NIGHT_AUDIT',
          aggregateId: targetAuditId,
          payload: asJson({
            organizationId,
            hotelId,
            auditId: targetAuditId,
            businessDate: businessDate.toISOString(),
            rolledBackAt: new Date().toISOString(),
            rolledBackBy: actorId,
            reason,
            rollback: rollbackSummary,
          }),
          maxAttempts: 5,
          status: 'PENDING',
        },
      });

      return { rollbackSummary, rolledBackAudit };
    });
  }
}

export const nightAuditRepository = new NightAuditRepository();
export type NightAuditRepositoryType = NightAuditRepository;
