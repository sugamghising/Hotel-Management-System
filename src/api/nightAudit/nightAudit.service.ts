import { config } from '../../config';
import { AuditBlockedError, AuditStepFailedError, NotFoundError } from '../../core/errors';
import type { NightAudit, Prisma } from '../../generated/prisma';
import { folioService } from '../folio/folio.service';
import { housekeepingService } from '../housekeeping';
import { maintenanceService } from '../maintenance';
import { notificationService } from '../notification';
import { type NightAuditRepositoryType, nightAuditRepository } from './nightAudit.repository';
import { assertRollbackAllowed } from './nightAudit.rollback';
import type {
  NightAuditDateQueryInput,
  NightAuditHistoryQueryInput,
  NightAuditReportQueryInput,
  RollbackNightAuditInput,
  RunNightAuditInput,
} from './nightAudit.schema';
import {
  NIGHT_AUDIT_STEPS,
  createStepFailure,
  createStepSuccess,
  runStep,
} from './nightAudit.steps';
import type {
  NightAuditActionSummary,
  NightAuditHistoryResponse,
  NightAuditPreCheckSnapshot,
  NightAuditReportResponse,
  NightAuditRollbackResponse,
  NightAuditRunResponse,
  NightAuditStatusResponse,
  NightAuditStepResult,
} from './nightAudit.types';

/**
 * Normalizes timestamps to UTC date-only values for business-date comparisons.
 *
 * @param value - Source timestamp.
 * @returns Date at UTC midnight for the same calendar day.
 */
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Returns the inclusive UTC end-of-day timestamp for a business date.
 *
 * Used by maintenance generation boundaries that expect a full-day cutoff.
 *
 * @param value - Business date anchor.
 * @returns UTC timestamp at `23:59:59.999` for the same date.
 */
const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

/**
 * Converts Prisma decimals or number-like values into native numbers.
 *
 * @param value - Numeric input from Prisma aggregates or persisted audit fields.
 * @returns Parsed numeric value.
 */
const toNumber = (value: { toString(): string } | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return Number.parseFloat(value.toString());
};

/**
 * Produces a JSON-safe deep clone suitable for Prisma `InputJsonValue`.
 *
 * @param value - Arbitrary payload to persist in JSON columns or outbox events.
 * @returns Structured-cloned JSON value.
 */
const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class NightAuditService {
  private readonly nightAuditRepo: NightAuditRepositoryType;

  /**
   * Creates the service with a repository implementation (defaulting to Prisma-backed repository).
   *
   * @param repository - Repository used for scoped reads/writes and transactional operations.
   */
  constructor(repository: NightAuditRepositoryType = nightAuditRepository) {
    this.nightAuditRepo = repository;
  }

  /**
   * Computes the pre-check snapshot for a hotel-scoped business date.
   *
   * The organization/hotel pair is validated up front through `findHotelScope` to prevent
   * cross-tenant reads. This method is read-only and returns blockers plus operational
   * counters used by `runAudit`.
   *
   * @param organizationId - Organization tenant identifier that owns the hotel.
   * @param hotelId - Hotel identifier constrained to the provided organization.
   * @param query - Optional date override; defaults to hotel's current business date.
   * @returns Snapshot of blockers and counts used to decide audit eligibility.
   */
  async preCheck(
    organizationId: string,
    hotelId: string,
    query: NightAuditDateQueryInput = {}
  ): Promise<NightAuditPreCheckSnapshot> {
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const businessDate = this.resolveBusinessDate(query.businessDate, hotel.currentBusinessDate);

    return this.nightAuditRepo.calculatePreCheckSnapshot(organizationId, hotelId, businessDate);
  }

  /**
   * Runs the full night-audit batch workflow for a scoped hotel business date.
   *
   * Flow:
   * 1) Resolve hotel scope and pre-check state.
   * 2) Create/update the audit row as `IN_PROGRESS`.
   * 3) Execute ordered operational steps (financial posting, no-shows, housekeeping,
   *    maintenance, escalation sweep, business-date advance) while collecting step logs.
   * 4) Transition audit to `COMPLETED` or `FAILED`, then emit outbox events.
   *
   * Transaction boundaries are step-level in downstream modules; this orchestrator persists
   * state transitions between steps. Side effects include DB writes (audit rows, reservation/task
   * updates via collaborators), outbox inserts, and optional user notifications/loggable warnings.
   *
   * @param organizationId - Organization tenant identifier for all scoped operations.
   * @param hotelId - Hotel identifier constrained to the organization scope.
   * @param input - Run options including optional business date and notes.
   * @param userId - Optional initiating user for notification fan-out; system actor is used otherwise.
   * @returns Completed audit report, original pre-check snapshot, and next business date.
   * @throws {AuditBlockedError} When hard pre-check blockers are present.
   * @throws {AuditStepFailedError} When a hard-fail step or finalization stage fails.
   * @remarks Complexity: O(s + c) orchestration work where `s` is configured step count (fixed today) and `c` is downstream side-effect cost from folio/reservation/task modules.
   * @example
   * const result = await service.runAudit(organizationId, hotelId, {
   *   businessDate: new Date('2026-03-31'),
   *   notes: 'End-of-month close',
   * });
   */
  async runAudit(
    organizationId: string,
    hotelId: string,
    input: RunNightAuditInput,
    userId?: string
  ): Promise<NightAuditRunResponse> {
    const actorId = userId ?? config.system.userId;
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const businessDate = this.resolveBusinessDate(input.businessDate, hotel.currentBusinessDate);

    const preCheck = await this.nightAuditRepo.calculatePreCheckSnapshot(
      organizationId,
      hotelId,
      businessDate
    );

    const audit = await this.nightAuditRepo.startAudit(
      hotelId,
      businessDate,
      actorId,
      input.notes,
      preCheck
    );

    const stepResults: NightAuditStepResult[] = [];

    stepResults.push(
      createStepSuccess(1, 'PRE_CHECK_SNAPSHOT', {
        message: 'Pre-check snapshot captured',
        details: {
          unbalancedFolios: preCheck.unbalancedFolios,
          uncheckedOutRes: preCheck.uncheckedOutRes,
          pendingCharges: preCheck.pendingCharges,
          roomDiscrepancies: preCheck.roomDiscrepancies,
        },
      })
    );

    if (!preCheck.canRun) {
      stepResults.push(
        createStepFailure(
          2,
          'PRE_CHECK_BLOCKERS',
          new Error('Blocking pre-check found unchecked-out reservations'),
          {
            uncheckedOutRes: preCheck.uncheckedOutRes,
            reservationIds: preCheck.uncheckedOutReservationIds,
          }
        )
      );

      const payload = {
        phase: 'PRE_CHECK_BLOCKERS',
        steps: stepResults,
        blockedReservations: preCheck.uncheckedOutReservationIds,
      };

      await this.nightAuditRepo.failAudit(audit.id, asJson(payload));
      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.failed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: audit.id,
          businessDate: businessDate.toISOString(),
          failedAt: new Date().toISOString(),
          reason: 'UNCHECKED_OUT_RESERVATIONS',
          preCheck: {
            ...preCheck,
            businessDate: preCheck.businessDate.toISOString(),
          },
        })
      );

      throw new AuditBlockedError('Cannot run audit: guests must be checked out first', {
        uncheckedOutRes: preCheck.uncheckedOutRes,
        reservationIds: preCheck.uncheckedOutReservationIds,
      });
    }

    stepResults.push(
      createStepSuccess(2, 'PRE_CHECK_BLOCKERS', {
        message: 'No hard blockers found',
      })
    );

    const actions: NightAuditActionSummary = {
      autoPostedCharges: 0,
      noShowsMarked: 0,
      stayoverTasksGenerated: 0,
      preventiveTasksGenerated: 0,
      escalationsProcessed: 0,
    };

    const warningSteps: NightAuditStepResult[] = [];

    const stepConfig = new Map(NIGHT_AUDIT_STEPS.map((s) => [s.code, s]));

    /**
     * Records step outcomes and applies hard-fail policy.
     *
     * On hard-fail steps, this helper transitions the audit to `FAILED`, writes a failure
     * payload, emits a `night_audit.failed` outbox event, and throws to stop the batch.
     * Non-hard-fail errors are retained as warnings so processing can continue.
     *
     * @param outcome - Result envelope from `runStep`.
     * @throws {AuditStepFailedError} When the failed step is configured as hard-fail.
     * @remarks Complexity: O(1) per step outcome, excluding repository writes on hard-fail paths.
     */
    const handleStepOutcome = async (outcome: {
      stepResult: NightAuditStepResult;
      error?: unknown;
    }): Promise<void> => {
      stepResults.push(outcome.stepResult);
      if (!outcome.error) return;

      if (stepConfig.get(outcome.stepResult.code)?.hardFail) {
        const payload = {
          phase: outcome.stepResult.code,
          steps: stepResults,
          warningCount: warningSteps.length,
          reason: outcome.stepResult.message,
        };
        await this.nightAuditRepo.failAudit(audit.id, asJson(payload));
        await this.nightAuditRepo.createOutboxEvent(
          'night_audit.failed',
          audit.id,
          asJson({
            organizationId,
            hotelId,
            auditId: audit.id,
            businessDate: businessDate.toISOString(),
            failedAt: new Date().toISOString(),
            reason: outcome.stepResult.message,
          })
        );
        throw new AuditStepFailedError({
          step: outcome.stepResult.step,
          stepName: outcome.stepResult.code,
          originalError: outcome.stepResult.message,
        });
      }

      warningSteps.push(outcome.stepResult);
    };

    await handleStepOutcome(
      await runStep(3, 'POST_ROOM_CHARGES', async () => {
        const result = await folioService.postRoomCharges(
          hotelId,
          organizationId,
          businessDate,
          actorId,
          audit.id
        );
        actions.autoPostedCharges = result.posted;

        return {
          message: `Posted ${result.posted} room charge(s)`,
          details: {
            posted: result.posted,
            totalAmount: result.totalAmount,
          },
        };
      })
    );

    await handleStepOutcome(
      await runStep(4, 'MARK_NO_SHOWS', async () => {
        const result = await this.nightAuditRepo.markNoShowsForAudit(
          audit.id,
          organizationId,
          hotelId,
          businessDate
        );
        actions.noShowsMarked = result.count;

        return {
          message: `Marked ${result.count} reservation(s) as no-show`,
          details: {
            count: result.count,
            reservationIds: result.reservationIds,
          },
        };
      })
    );

    await handleStepOutcome(
      await runStep(5, 'GENERATE_STAYOVER_TASKS', async () => {
        const result = await housekeepingService.autoGenerateStayoverTasks(
          organizationId,
          hotelId,
          { date: businessDate },
          actorId,
          { nightAuditBatchId: audit.id }
        );
        actions.stayoverTasksGenerated = result.created;

        return {
          message: `Generated ${result.created} stayover task(s)`,
          details: {
            created: result.created,
          },
        };
      })
    );

    await handleStepOutcome(
      await runStep(6, 'GENERATE_PREVENTIVE_TASKS', async () => {
        const result = await maintenanceService.generateDuePreventiveTasks(
          organizationId,
          hotelId,
          {
            date: endOfDayUtc(businessDate),
            sourceRef: audit.id,
          }
        );
        actions.preventiveTasksGenerated = result.createdCount;

        return {
          message: `Generated ${result.createdCount} preventive request(s)`,
          details: {
            createdCount: result.createdCount,
          },
        };
      })
    );

    await handleStepOutcome(
      await runStep(7, 'RUN_ESCALATION_SWEEP', async () => {
        const result = await maintenanceService.runEscalationSweep({
          organizationId,
          hotelId,
          reason: 'NIGHT_AUDIT_AUTO_ESCALATION',
        });
        actions.escalationsProcessed = result.escalatedCount;

        return {
          message: `Escalation sweep processed ${result.escalatedCount} request(s)`,
          details: {
            checkedCount: result.checkedCount,
            escalatedCount: result.escalatedCount,
            skippedEmergencyCount: result.skippedEmergencyCount,
          },
        };
      })
    );

    let nextBusinessDate = hotel.currentBusinessDate;
    await handleStepOutcome(
      await runStep(8, 'ADVANCE_BUSINESS_DATE', async () => {
        nextBusinessDate = await this.nightAuditRepo.advanceHotelBusinessDate(
          organizationId,
          hotelId,
          businessDate
        );

        return {
          message: `Business date advanced to ${nextBusinessDate.toISOString().slice(0, 10)}`,
          details: {
            nextBusinessDate,
          },
        };
      })
    );

    try {
      const financial = await this.nightAuditRepo.computeFinancialSummary(hotelId, businessDate);

      const completed = await this.nightAuditRepo.completeAudit(
        audit.id,
        financial,
        actions,
        stepResults,
        warningSteps.length
      );

      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.completed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: completed.id,
          businessDate: businessDate.toISOString(),
          completedAt: completed.completedAt?.toISOString() ?? null,
          nextBusinessDate: nextBusinessDate.toISOString(),
          warningCount: warningSteps.length,
        })
      );

      if (warningSteps.length > 0 && userId) {
        await notificationService.send([userId], {
          type: 'WARNING',
          title: 'Night audit completed with warnings',
          message: `${warningSteps.length} step(s) failed and were logged for audit ${completed.id}`,
          metadata: {
            auditId: completed.id,
            businessDate: businessDate.toISOString().slice(0, 10),
          },
        });
      }

      return {
        audit: this.mapAuditToReport(completed),
        preCheck,
        nextBusinessDate,
      };
    } catch (error) {
      const payload = {
        phase: 'FINALIZE',
        steps: stepResults,
        warningCount: warningSteps.length,
        reason: error instanceof Error ? error.message : String(error),
      };

      await this.nightAuditRepo.failAudit(audit.id, asJson(payload));
      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.failed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: audit.id,
          businessDate: businessDate.toISOString(),
          failedAt: new Date().toISOString(),
          reason: error instanceof Error ? error.message : String(error),
        })
      );

      throw new AuditStepFailedError({
        step: 8,
        stepName: 'FINALIZE_AUDIT',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Returns current hotel business date and latest audit summary.
   *
   * Hotel scope is validated by organization/hotel identifiers before reading audit history.
   *
   * @param organizationId - Organization tenant identifier.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @returns Current business date plus latest audit report when available.
   */
  async getStatus(organizationId: string, hotelId: string): Promise<NightAuditStatusResponse> {
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const latest = await this.nightAuditRepo.findLatestAudit(hotelId);

    return {
      currentBusinessDate: asDateOnly(hotel.currentBusinessDate),
      latestAudit: latest ? this.mapAuditToReport(latest) : null,
    };
  }

  /**
   * Lists paginated night-audit history for a hotel scope.
   *
   * This method is read-only but enforces organization/hotel ownership before returning
   * paginated items and metadata.
   *
   * @param organizationId - Organization tenant identifier.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @param query - Pagination/filter parameters.
   * @returns Audit history page with transformed report items.
   */
  async getHistory(
    organizationId: string,
    hotelId: string,
    query: NightAuditHistoryQueryInput
  ): Promise<NightAuditHistoryResponse> {
    await this.nightAuditRepo.findHotelScope(organizationId, hotelId);

    const { items, total } = await this.nightAuditRepo.listAuditHistory(hotelId, query);

    return {
      items: items.map((item) => this.mapAuditToReport(item)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Retrieves a single audit report by id, business date, or latest fallback.
   *
   * Scope validation is performed first using organization/hotel identifiers to ensure
   * only in-tenant audit records are accessible.
   *
   * @param organizationId - Organization tenant identifier.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @param query - Report locator options (audit id, business date, or implicit latest).
   * @returns Fully mapped audit report payload.
   * @throws {NotFoundError} When no matching audit is found in scope.
   */
  async getReport(
    organizationId: string,
    hotelId: string,
    query: NightAuditReportQueryInput
  ): Promise<NightAuditReportResponse> {
    await this.nightAuditRepo.findHotelScope(organizationId, hotelId);

    let audit: NightAudit | null = null;

    if (query.auditId) {
      audit = await this.nightAuditRepo.findAuditById(query.auditId, hotelId);
    } else if (query.businessDate) {
      audit = await this.nightAuditRepo.findAuditByBusinessDate(hotelId, query.businessDate);
    } else {
      audit = await this.nightAuditRepo.findLatestAudit(hotelId);
    }

    if (!audit) {
      throw new NotFoundError('Night audit report not found');
    }

    return this.mapAuditToReport(audit);
  }

  /**
   * Rolls back the latest eligible night audit for a hotel scope.
   *
   * Preconditions are enforced by `assertRollbackAllowed`, then rollback side effects run
   * inside a single repository transaction to keep financial/state reversals atomic:
   * - Voids night-audit room charges
   * - Reverts no-show reservations
   * - Cancels generated stayover and preventive tasks
   * - Restores hotel business date
   * - Marks audit `ROLLED_BACK` and emits rollback outbox event
   *
   * Optional notifications are sent to the initiating user after commit.
   *
   * @param organizationId - Organization tenant identifier for scoped rollback.
   * @param hotelId - Hotel identifier constrained to the organization.
   * @param input - Rollback target and reason.
   * @param userId - Optional user to notify when rollback completes.
   * @returns Rolled-back audit id/status plus rollback effect counters.
   * @throws {NotFoundError} When no target audit exists.
   * @remarks Complexity: O(r) orchestration around a single transactional rollback, where `r` is dominated by affected folio, reservation, housekeeping, and maintenance rows inside repository rollback logic.
   * @example
   * const rollback = await service.rollbackAudit(organizationId, hotelId, {
   *   auditId,
   *   reason: 'Manual correction after posting error',
   * });
   */
  async rollbackAudit(
    organizationId: string,
    hotelId: string,
    input: RollbackNightAuditInput,
    userId?: string
  ): Promise<NightAuditRollbackResponse> {
    const actorId = userId ?? config.system.userId;
    const reason = input.reason ?? 'Night audit rollback requested';

    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const latestAudit = await this.nightAuditRepo.findLatestAudit(hotelId);

    if (!latestAudit) {
      throw new NotFoundError('No night audit found to rollback');
    }

    const targetAudit = input.auditId
      ? await this.nightAuditRepo.findAuditById(input.auditId, hotelId)
      : latestAudit;

    if (!targetAudit) {
      throw new NotFoundError('Night audit not found');
    }

    assertRollbackAllowed(targetAudit, latestAudit, hotel.currentBusinessDate);

    const { rollbackSummary, rolledBackAudit } =
      await this.nightAuditRepo.performRollbackTransaction({
        targetAuditId: targetAudit.id,
        businessDate: targetAudit.businessDate,
        organizationId,
        hotelId,
        actorId,
        reason,
        previousStatus: targetAudit.status,
      });

    if (userId) {
      await notificationService.send([userId], {
        type: 'INFO',
        title: 'Night audit rolled back',
        message: `Night audit ${targetAudit.id} was rolled back successfully`,
        metadata: {
          auditId: targetAudit.id,
          businessDate: targetAudit.businessDate.toISOString().slice(0, 10),
          rollback: rollbackSummary,
        },
      });
    }

    return {
      auditId: rolledBackAudit.id,
      businessDate: asDateOnly(rolledBackAudit.businessDate),
      status: rolledBackAudit.status,
      rollback: rollbackSummary,
    };
  }

  /**
   * Resolves the effective business date used by run/pre-check operations.
   *
   * Resolution order is explicit request, then hotel current business date, then current UTC date.
   *
   * @param requestedDate - Optional date requested by the caller.
   * @param fallbackDate - Optional hotel-level fallback business date.
   * @returns Normalized UTC date-only business date.
   */
  private resolveBusinessDate(requestedDate?: Date, fallbackDate?: Date): Date {
    if (requestedDate) {
      return asDateOnly(requestedDate);
    }

    if (fallbackDate) {
      return asDateOnly(fallbackDate);
    }

    return asDateOnly(new Date());
  }

  /**
   * Maps a raw `NightAudit` row into the API report contract.
   *
   * This transformation merges persisted financial/state columns with parsed step metadata
   * stored in `errors`, deriving fallback action counts when values are only present in step details.
   *
   * @param audit - Persisted night-audit row.
   * @returns Report DTO used by status/history/report endpoints.
   */
  private mapAuditToReport(audit: NightAudit): NightAuditReportResponse {
    const payload = this.parseErrorPayload(audit.errors);
    const steps = this.parseSteps(payload.steps);

    return {
      id: audit.id,
      hotelId: audit.hotelId,
      businessDate: asDateOnly(audit.businessDate),
      status: audit.status,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      performedBy: audit.performedBy,
      checks: {
        unbalancedFolios: audit.unbalancedFolios,
        uncheckedOutRes: audit.uncheckedOutRes,
        pendingCharges: audit.pendingCharges,
        roomDiscrepancies: audit.roomDiscrepancies,
      },
      financial: {
        roomRevenue: toNumber(audit.roomRevenue),
        otherRevenue: toNumber(audit.otherRevenue),
        paymentsReceived: toNumber(audit.paymentsReceived),
      },
      actions: {
        autoPostedCharges: audit.autoPostedCharges,
        noShowsMarked: audit.noShowsMarked,
        stayoverTasksGenerated: this.getStepNumber(steps, 'GENERATE_STAYOVER_TASKS', 'created'),
        preventiveTasksGenerated: this.getStepNumber(
          steps,
          'GENERATE_PREVENTIVE_TASKS',
          'createdCount'
        ),
        escalationsProcessed: this.getStepNumber(steps, 'RUN_ESCALATION_SWEEP', 'escalatedCount'),
      },
      notes: audit.notes,
      steps,
      warningCount:
        typeof payload.warningCount === 'number'
          ? payload.warningCount
          : steps.filter((step) => step.status === 'FAILED').length,
    };
  }

  /**
   * Safely extracts known fields from the audit `errors` JSON column.
   *
   * @param errors - Persisted JSON payload from audit failure/completion metadata.
   * @returns Object containing optional `steps` and `warningCount` when present.
   */
  private parseErrorPayload(errors: unknown): {
    steps?: unknown;
    warningCount?: unknown;
  } {
    if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
      return {};
    }

    return errors as {
      steps?: unknown;
      warningCount?: unknown;
    };
  }

  /**
   * Normalizes arbitrary JSON into sorted `NightAuditStepResult[]`.
   *
   * Invalid entries are dropped to keep API responses stable even when legacy payloads
   * contain malformed step data.
   *
   * @param candidate - Raw steps payload from persisted JSON.
   * @returns Validated, step-ordered step results.
   */
  private parseSteps(candidate: unknown): NightAuditStepResult[] {
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }

        const stepCandidate = item as Partial<NightAuditStepResult>;
        if (
          typeof stepCandidate.step !== 'number' ||
          typeof stepCandidate.code !== 'string' ||
          typeof stepCandidate.status !== 'string' ||
          typeof stepCandidate.message !== 'string'
        ) {
          return null;
        }

        return {
          step: stepCandidate.step,
          code: stepCandidate.code,
          status: stepCandidate.status,
          message: stepCandidate.message,
          ...(stepCandidate.details && typeof stepCandidate.details === 'object'
            ? { details: stepCandidate.details as Record<string, unknown> }
            : {}),
        } as NightAuditStepResult;
      })
      .filter((item): item is NightAuditStepResult => item !== null)
      .sort((a, b) => a.step - b.step);
  }

  /**
   * Reads a numeric metric from a specific step's details map.
   *
   * @param steps - Parsed step results.
   * @param code - Step code to inspect.
   * @param key - Detail key expected to hold a numeric value.
   * @returns Numeric metric value or `0` when missing/non-numeric.
   */
  private getStepNumber(
    steps: NightAuditStepResult[],
    code: NightAuditStepResult['code'],
    key: string
  ): number {
    const match = steps.find((step) => step.code === code);
    if (!match || !match.details) {
      return 0;
    }

    const value = match.details[key];
    if (typeof value === 'number') {
      return value;
    }

    return 0;
  }
}

export const nightAuditService = new NightAuditService();
