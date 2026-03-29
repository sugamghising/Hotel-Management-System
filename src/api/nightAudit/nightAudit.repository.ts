import { config } from '../../config';
import {
  AuditAlreadyCompletedError,
  AuditAlreadyInProgressError,
  NotFoundError,
} from '../../core/errors';
import { prisma } from '../../database/prisma';
import { type NightAudit, Prisma } from '../../generated/prisma';
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

const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

const nextDay = (value: Date): Date => {
  const date = asDateOnly(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const toNumber = (value: Prisma.Decimal | null): number =>
  value ? Number.parseFloat(value.toString()) : 0;

export class NightAuditRepository {
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

  async findAuditById(auditId: string, hotelId?: string): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: {
        id: auditId,
        ...(hotelId ? { hotelId } : {}),
      },
    });
  }

  async findAuditByBusinessDate(hotelId: string, businessDate: Date): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: {
        hotelId,
        businessDate: asDateOnly(businessDate),
      },
    });
  }

  async findLatestAudit(hotelId: string): Promise<NightAudit | null> {
    return prisma.nightAudit.findFirst({
      where: { hotelId },
      orderBy: [{ businessDate: 'desc' }],
    });
  }

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

    return prisma.nightAudit.create({
      data: {
        hotelId,
        businessDate: auditDate,
        ...data,
      },
    });
  }

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

  async advanceHotelBusinessDate(
    organizationId: string,
    hotelId: string,
    businessDate: Date
  ): Promise<Date> {
    const nextBusinessDate = nextDay(businessDate);
    await this.updateHotelBusinessDate(organizationId, hotelId, nextBusinessDate);
    return nextBusinessDate;
  }

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

  getSystemActorId(): string {
    return config.system.userId;
  }
}

export const nightAuditRepository = new NightAuditRepository();
export type NightAuditRepositoryType = NightAuditRepository;
