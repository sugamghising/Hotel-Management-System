import { config } from '../../config';
import {
  AssetTagAlreadyExistsError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GuestChargeAlreadyPostedError,
  InvalidStatusTransitionError,
  NotFoundError,
  OOOReservationConflictError,
  ScheduleNotDueError,
  logger,
} from '../../core';
import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
import { folioService } from '../folio/folio.service';
import { inventoryService } from './inventory.service';
import { type MaintenanceRepositoryType, maintenanceRepository } from './maintenance.repository';
import type {
  AssignMaintenanceRequestInput,
  CancelMaintenanceRequestInput,
  CompleteMaintenanceRequestInput,
  CreateAssetInput,
  CreateMaintenanceRequestInput,
  CreatePreventiveScheduleInput,
  EscalateMaintenanceRequestInput,
  GenerateDuePreventiveInput,
  ListAssetsQueryInput,
  ListMaintenanceRequestsQueryInput,
  ListPreventiveSchedulesQueryInput,
  LogPartsInput,
  PauseMaintenanceRequestInput,
  PostGuestChargeInput,
  ScheduleMaintenanceRequestInput,
  UpdateAssetInput,
  UpdateMaintenanceRequestInput,
  VerifyMaintenanceRequestInput,
} from './maintenance.schema';
import type { AssetEvaluationResult, MaintenanceDashboardResponse } from './maintenance.types';

const OPEN_STATUSES: Array<
  'REPORTED' | 'ACKNOWLEDGED' | 'SCHEDULED' | 'IN_PROGRESS' | 'PENDING_PARTS'
> = ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_PARTS'];
const CLOSING_STATUSES = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  REPORTED: ['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  ACKNOWLEDGED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_PARTS', 'COMPLETED', 'CANCELLED'],
  PENDING_PARTS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['VERIFIED'],
  VERIFIED: [],
  CANCELLED: [],
};

type SlaPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'EMERGENCY';

const SLA_HOURS_BY_PRIORITY: Record<SlaPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 8,
  EMERGENCY: 2,
};

interface PartsUsedRecord {
  itemId: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  usedAt: string;
  notes?: string;
}

interface EscalationSweepInput {
  organizationId?: string;
  hotelId?: string;
  at?: Date;
  limit?: number;
  reason?: string;
}

export class MaintenanceService {
  private maintenanceRepo: MaintenanceRepositoryType;

  constructor(repository: MaintenanceRepositoryType = maintenanceRepository) {
    this.maintenanceRepo = repository;
  }

  async createRequest(
    organizationId: string,
    hotelId: string,
    input: CreateMaintenanceRequestInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;
    const now = new Date();

    if (input.roomOutOfOrder && !input.roomId) {
      throw new BadRequestError('roomId is required when roomOutOfOrder is true');
    }

    if (input.roomId) {
      const room = await this.maintenanceRepo.findRoomForScope(
        input.roomId,
        organizationId,
        hotelId
      );

      if (!room) {
        throw new NotFoundError('Room not found in this hotel');
      }
    }

    const targetCompletionAt =
      input.targetCompletionAt ?? this.calculateSlaDeadline(input.priority, now);

    const oooUntil = input.oooUntil ?? targetCompletionAt;

    let oooConflicts: Awaited<ReturnType<MaintenanceRepositoryType['findOooConflicts']>> = [];

    if (input.roomOutOfOrder && input.roomId) {
      oooConflicts = await this.maintenanceRepo.findOooConflicts(
        input.roomId,
        organizationId,
        hotelId,
        now,
        oooUntil
      );

      if (oooConflicts.length > 0 && !input.forceRoomOutOfOrder) {
        throw new OOOReservationConflictError(
          'Out-of-order window overlaps with active reservation(s)',
          {
            conflicts: oooConflicts.map((conflict) => ({
              reservationId: conflict.reservationId,
              confirmationNumber: conflict.reservation.confirmationNumber,
              checkInDate: conflict.reservation.checkInDate,
              checkOutDate: conflict.reservation.checkOutDate,
              status: conflict.reservation.status,
            })),
          }
        );
      }
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await this.maintenanceRepo.createRequest(
        {
          organizationId,
          hotelId,
          ...(input.roomId ? { roomId: input.roomId } : {}),
          ...(input.reservationId ? { reservationId: input.reservationId } : {}),
          ...(input.assetId ? { assetId: input.assetId } : {}),
          ...(input.preventiveScheduleId
            ? { preventiveScheduleId: input.preventiveScheduleId }
            : {}),
          category: input.category,
          priority: input.priority,
          title: input.title,
          description: input.description,
          source: input.source,
          ...(input.locationDetails !== undefined
            ? { locationDetails: input.locationDetails }
            : {}),
          reportedBy: actorId,
          reportedByType: input.reportedByType,
          guestReported: input.reportedByType === 'GUEST',
          ...(input.scheduledFor !== undefined ? { scheduledFor: input.scheduledFor } : {}),
          ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
          targetCompletionAt,
          status: input.scheduledFor ? 'SCHEDULED' : 'REPORTED',
          roomOutOfOrder: input.roomOutOfOrder,
          ...(input.oooUntil !== undefined ? { oooUntil: this.asDateOnly(input.oooUntil) } : {}),
        },
        tx
      );

      if (input.roomOutOfOrder && input.roomId) {
        await tx.room.update({
          where: { id: input.roomId },
          data: {
            status: 'OUT_OF_ORDER',
            isOutOfOrder: true,
            oooFrom: this.asDateOnly(now),
            oooUntil: this.asDateOnly(oooUntil),
            oooReason: input.title,
            maintenanceStatus: 'SCHEDULED',
          },
        });
      }

      await this.maintenanceRepo.createOutboxEvents(tx, [
        {
          eventType: 'maintenance.request_created',
          aggregateType: 'MAINTENANCE_REQUEST',
          aggregateId: created.id,
          payload: {
            organizationId,
            hotelId,
            requestId: created.id,
            priority: created.priority,
            category: created.category,
            roomId: created.roomId,
            assetId: created.assetId,
            reportedAt: created.reportedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
        ...(input.roomOutOfOrder && input.roomId
          ? [
              {
                eventType: 'maintenance.ooo_set',
                aggregateType: 'ROOM',
                aggregateId: input.roomId,
                payload: {
                  organizationId,
                  hotelId,
                  requestId: created.id,
                  roomId: input.roomId,
                  oooUntil: this.asDateOnly(oooUntil).toISOString(),
                } as Prisma.InputJsonValue,
              },
            ]
          : []),
      ]);

      return created;
    });

    if (input.priority === 'EMERGENCY') {
      logger.error('Emergency maintenance request raised', {
        requestId: request.id,
        hotelId,
        organizationId,
      });
    }

    return {
      request,
      warnings:
        oooConflicts.length > 0
          ? [
              {
                code: 'OOO_CONFLICT_OVERRIDE',
                message: 'Room out-of-order conflict overridden by force flag',
                conflicts: oooConflicts,
              },
            ]
          : [],
    };
  }

  async listRequests(
    organizationId: string,
    hotelId: string,
    query: ListMaintenanceRequestsQueryInput
  ) {
    const page = query.page;
    const limit = query.limit;

    const { items, total } = await this.maintenanceRepo.listRequests(
      organizationId,
      hotelId,
      query,
      { page, limit }
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRequestDetail(organizationId: string, hotelId: string, requestId: string) {
    const request = await this.maintenanceRepo.findRequestById(requestId, organizationId, hotelId);

    if (!request) {
      throw new NotFoundError('Maintenance request not found');
    }

    return { request };
  }

  async updateRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: UpdateMaintenanceRequestInput
  ) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (CLOSING_STATUSES.includes(existing.status)) {
      throw new ConflictError('Closed maintenance request cannot be updated');
    }

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locationDetails !== undefined ? { locationDetails: input.locationDetails } : {}),
      ...(input.scheduledFor !== undefined ? { scheduledFor: input.scheduledFor } : {}),
      ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
      ...(input.targetCompletionAt !== undefined
        ? { targetCompletionAt: input.targetCompletionAt }
        : {}),
      ...(input.roomOutOfOrder !== undefined ? { roomOutOfOrder: input.roomOutOfOrder } : {}),
      ...(input.oooUntil !== undefined ? { oooUntil: this.asDateOnly(input.oooUntil) } : {}),
    });

    return { request };
  }

  async acknowledgeRequest(organizationId: string, hotelId: string, requestId: string) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);
    this.assertCanTransition(existing.status, 'ACKNOWLEDGED');

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      status: 'ACKNOWLEDGED',
    });

    return { request };
  }

  async assignRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: AssignMaintenanceRequestInput
  ) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (CLOSING_STATUSES.includes(existing.status)) {
      throw new ConflictError('Closed maintenance request cannot be assigned');
    }

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      assignedTo: input.assignedTo,
      assignedAt: new Date(),
      ...(existing.status === 'REPORTED' ? { status: 'ACKNOWLEDGED' } : {}),
    });

    return { request };
  }

  async scheduleRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: ScheduleMaintenanceRequestInput
  ) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (CLOSING_STATUSES.includes(existing.status)) {
      throw new ConflictError('Closed maintenance request cannot be scheduled');
    }

    const nextTarget =
      input.targetCompletionAt ?? this.calculateSlaDeadline(existing.priority, input.scheduledFor);

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      status: 'SCHEDULED',
      scheduledFor: input.scheduledFor,
      ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
      targetCompletionAt: nextTarget,
    });

    return { request };
  }

  async startRequest(organizationId: string, hotelId: string, requestId: string, userId?: string) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (!['ACKNOWLEDGED', 'SCHEDULED', 'PENDING_PARTS'].includes(existing.status)) {
      throw new InvalidStatusTransitionError('Request cannot be started from current status', {
        fromStatus: existing.status,
        toStatus: 'IN_PROGRESS',
      });
    }

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      status: 'IN_PROGRESS',
      startedAt: existing.startedAt ?? new Date(),
      pausedAt: null,
      pauseReason: null,
      ...(existing.assignedTo
        ? {}
        : { assignedTo: userId ?? config.system.userId, assignedAt: new Date() }),
    });

    return { request };
  }

  async pauseRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: PauseMaintenanceRequestInput
  ) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    this.assertCanTransition(existing.status, 'PENDING_PARTS');

    const request = await this.maintenanceRepo.updateRequest(requestId, {
      status: 'PENDING_PARTS',
      pausedAt: new Date(),
      pauseReason: input.reason,
    });

    return { request };
  }

  async logParts(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: LogPartsInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;

    const request = await prisma.$transaction(async (tx) => {
      const current = await tx.maintenanceRequest.findUnique({
        where: { id: requestId },
      });

      if (!current || current.organizationId !== organizationId || current.hotelId !== hotelId) {
        throw new NotFoundError('Maintenance request not found');
      }

      if (!['IN_PROGRESS', 'PENDING_PARTS'].includes(current.status)) {
        throw new ConflictError(
          'Parts can only be logged when request is in progress or pending parts'
        );
      }

      const previousParts = this.parsePartsUsed(current.partsUsed);
      let additionalPartsCost = new Prisma.Decimal(0);
      const nextParts = [...previousParts];

      for (const part of input.parts) {
        const consumed = await inventoryService.consumeStock(tx, {
          itemId: part.itemId,
          qty: part.qty,
          organizationId,
          hotelId,
          performedBy: actorId,
          refType: 'MAINTENANCE_REQUEST',
          refId: current.id,
          ...(part.notes !== undefined ? { notes: part.notes } : {}),
        });

        additionalPartsCost = additionalPartsCost.plus(consumed.totalCost);
        nextParts.push({
          itemId: consumed.itemId,
          qty: consumed.qty,
          unitCost: consumed.unitCost,
          totalCost: consumed.totalCost,
          usedAt: new Date().toISOString(),
          ...(part.notes !== undefined ? { notes: part.notes } : {}),
        });
      }

      const priorPartsCost = current.partsCost ?? new Prisma.Decimal(0);
      const nextPartsCost = priorPartsCost.plus(additionalPartsCost);
      const laborCost = current.laborCost ?? new Prisma.Decimal(0);
      const vendorCost = current.vendorCost ?? new Prisma.Decimal(0);
      const totalCost = nextPartsCost.plus(laborCost).plus(vendorCost);

      return tx.maintenanceRequest.update({
        where: { id: current.id },
        data: {
          partsUsed: nextParts as unknown as Prisma.InputJsonValue,
          partsCost: nextPartsCost,
          totalCost,
          ...(current.status === 'PENDING_PARTS'
            ? {
                status: 'IN_PROGRESS',
                pausedAt: null,
                pauseReason: null,
              }
            : {}),
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });
    });

    return { request };
  }

  async completeRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: CompleteMaintenanceRequestInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;

    const request = await prisma.$transaction(async (tx) => {
      const current = await tx.maintenanceRequest.findUnique({
        where: { id: requestId },
      });

      if (!current || current.organizationId !== organizationId || current.hotelId !== hotelId) {
        throw new NotFoundError('Maintenance request not found');
      }

      if (!['IN_PROGRESS', 'PENDING_PARTS'].includes(current.status)) {
        throw new InvalidStatusTransitionError('Request cannot be completed from current status', {
          fromStatus: current.status,
          toStatus: 'COMPLETED',
        });
      }

      const previousParts = this.parsePartsUsed(current.partsUsed);
      const nextParts = [...previousParts];
      let additionalPartsCost = new Prisma.Decimal(0);

      if (input.parts?.length) {
        for (const part of input.parts) {
          const consumed = await inventoryService.consumeStock(tx, {
            itemId: part.itemId,
            qty: part.qty,
            organizationId,
            hotelId,
            performedBy: actorId,
            refType: 'MAINTENANCE_REQUEST',
            refId: current.id,
            ...(part.notes !== undefined ? { notes: part.notes } : {}),
          });

          additionalPartsCost = additionalPartsCost.plus(consumed.totalCost);
          nextParts.push({
            itemId: consumed.itemId,
            qty: consumed.qty,
            unitCost: consumed.unitCost,
            totalCost: consumed.totalCost,
            usedAt: new Date().toISOString(),
            ...(part.notes !== undefined ? { notes: part.notes } : {}),
          });
        }
      }

      const priorPartsCost = current.partsCost ?? new Prisma.Decimal(0);
      const nextPartsCost = priorPartsCost.plus(additionalPartsCost);
      const laborCost =
        input.laborCost !== undefined
          ? new Prisma.Decimal(input.laborCost)
          : (current.laborCost ?? new Prisma.Decimal(0));
      const vendorCost =
        input.vendorCost !== undefined
          ? new Prisma.Decimal(input.vendorCost)
          : (current.vendorCost ?? new Prisma.Decimal(0));
      const totalCost = nextPartsCost.plus(laborCost).plus(vendorCost);

      const updated = await tx.maintenanceRequest.update({
        where: { id: current.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resolution: input.resolution,
          pausedAt: null,
          pauseReason: null,
          partsUsed: nextParts as unknown as Prisma.InputJsonValue,
          partsCost: nextPartsCost,
          laborCost,
          vendorCost,
          totalCost,
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });

      if (input.clearRoomOutOfOrder && current.roomOutOfOrder && current.roomId) {
        await tx.room.update({
          where: { id: current.roomId },
          data: {
            status: 'VACANT_DIRTY',
            isOutOfOrder: false,
            oooFrom: null,
            oooUntil: null,
            oooReason: null,
            maintenanceStatus: 'NONE',
          },
        });
      }

      await this.maintenanceRepo.createOutboxEvents(tx, [
        {
          eventType: 'maintenance.completed',
          aggregateType: 'MAINTENANCE_REQUEST',
          aggregateId: current.id,
          payload: {
            organizationId,
            hotelId,
            requestId: current.id,
            roomId: current.roomId,
            totalCost: Number(totalCost.toString()),
            completedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        ...(input.clearRoomOutOfOrder && current.roomOutOfOrder && current.roomId
          ? [
              {
                eventType: 'maintenance.ooo_cleared',
                aggregateType: 'ROOM',
                aggregateId: current.roomId,
                payload: {
                  organizationId,
                  hotelId,
                  requestId: current.id,
                  roomId: current.roomId,
                  clearedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
              },
            ]
          : []),
      ]);

      return updated;
    });

    return { request };
  }

  async verifyRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    _input: VerifyMaintenanceRequestInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    this.assertCanTransition(existing.status, 'VERIFIED');

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'VERIFIED',
          verifiedBy: actorId,
          verifiedAt: new Date(),
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });

      if (updated.roomId) {
        await tx.room.update({
          where: { id: updated.roomId },
          data: {
            maintenanceStatus: 'NONE',
          },
        });
      }

      return updated;
    });

    return { request };
  }

  async cancelRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: CancelMaintenanceRequestInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(existing.status)) {
      throw new InvalidStatusTransitionError('Request cannot be cancelled from current status', {
        fromStatus: existing.status,
        toStatus: 'CANCELLED',
      });
    }

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'CANCELLED',
          cancelledBy: actorId,
          cancellationReason: input.reason,
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });

      if (updated.roomOutOfOrder && updated.roomId) {
        await tx.room.update({
          where: { id: updated.roomId },
          data: {
            status: 'VACANT_DIRTY',
            isOutOfOrder: false,
            oooFrom: null,
            oooUntil: null,
            oooReason: null,
            maintenanceStatus: 'NONE',
          },
        });
      }

      return updated;
    });

    return { request };
  }

  async escalateRequest(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: EscalateMaintenanceRequestInput
  ) {
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (CLOSING_STATUSES.includes(existing.status)) {
      throw new ConflictError('Closed request cannot be escalated');
    }

    const nextPriority = this.bumpPriority(existing.priority);

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          priority: nextPriority,
          escalationLevel: {
            increment: 1,
          },
          escalatedAt: new Date(),
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });

      await this.maintenanceRepo.createOutboxEvent(tx, {
        eventType: 'maintenance.escalated',
        aggregateType: 'MAINTENANCE_REQUEST',
        aggregateId: requestId,
        payload: {
          organizationId,
          hotelId,
          requestId,
          fromPriority: existing.priority,
          toPriority: nextPriority,
          escalationLevel: updated.escalationLevel,
          ...(input.reason ? { reason: input.reason } : {}),
        } as Prisma.InputJsonValue,
      });

      return updated;
    });

    return { request };
  }

  async runEscalationSweep(input: EscalationSweepInput = {}) {
    const at = input.at ?? new Date();
    const limit = Math.max(1, input.limit ?? 100);

    const candidates = await prisma.maintenanceRequest.findMany({
      where: {
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        ...(input.hotelId ? { hotelId: input.hotelId } : {}),
        status: { in: OPEN_STATUSES },
        targetCompletionAt: {
          lte: at,
        },
      },
      select: {
        id: true,
        priority: true,
      },
      orderBy: [{ targetCompletionAt: 'asc' }, { reportedAt: 'asc' }],
      take: limit,
    });

    let escalatedCount = 0;
    let skippedEmergencyCount = 0;

    for (const candidate of candidates) {
      if (candidate.priority === 'EMERGENCY') {
        skippedEmergencyCount += 1;
        continue;
      }

      const escalated = await prisma.$transaction(async (tx) => {
        const current = await tx.maintenanceRequest.findFirst({
          where: {
            id: candidate.id,
            status: { in: OPEN_STATUSES },
            targetCompletionAt: {
              lte: at,
            },
          },
          select: {
            id: true,
            organizationId: true,
            hotelId: true,
            priority: true,
          },
        });

        if (!current || current.priority === 'EMERGENCY') {
          return false;
        }

        const nextPriority = this.bumpPriority(current.priority);

        const updated = await tx.maintenanceRequest.update({
          where: { id: current.id },
          data: {
            priority: nextPriority,
            escalationLevel: {
              increment: 1,
            },
            escalatedAt: at,
          },
          select: {
            escalationLevel: true,
          },
        });

        await this.maintenanceRepo.createOutboxEvent(tx, {
          eventType: 'maintenance.escalated',
          aggregateType: 'MAINTENANCE_REQUEST',
          aggregateId: current.id,
          payload: {
            organizationId: current.organizationId,
            hotelId: current.hotelId,
            requestId: current.id,
            fromPriority: current.priority,
            toPriority: nextPriority,
            escalationLevel: updated.escalationLevel,
            reason: input.reason ?? 'SLA_OVERDUE_AUTO_ESCALATION',
          } as Prisma.InputJsonValue,
        });

        return true;
      });

      if (escalated) {
        escalatedCount += 1;
      }
    }

    return {
      checkedCount: candidates.length,
      escalatedCount,
      skippedEmergencyCount,
    };
  }

  async postGuestCharge(
    organizationId: string,
    hotelId: string,
    requestId: string,
    input: PostGuestChargeInput,
    userId?: string
  ) {
    const actorId = userId ?? config.system.userId;
    const existing = await this.getScopedRequest(requestId, organizationId, hotelId);

    if (existing.guestChargePosted) {
      throw new GuestChargeAlreadyPostedError();
    }

    const reservationId = input.reservationId ?? existing.reservationId;
    if (!reservationId) {
      throw new BadRequestError('reservationId is required to post guest charge');
    }

    const charge = await folioService.postCharge(
      reservationId,
      organizationId,
      {
        itemType: 'SERVICE_CHARGE',
        description: input.description,
        amount: input.amount,
        taxAmount: input.taxAmount,
        quantity: 1,
        unitPrice: input.amount,
        revenueCode: input.revenueCode ?? 'MAINT',
        department: input.department ?? 'ENGINEERING',
        source: 'MAINTENANCE',
        sourceRef: requestId,
      },
      actorId,
      hotelId
    );

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          guestChargePosted: true,
          guestChargeFolioItemId: charge.id,
          ...(existing.reservationId ? {} : { reservationId }),
        },
        include: {
          room: true,
          asset: true,
          preventiveSchedule: true,
        },
      });

      await this.maintenanceRepo.createOutboxEvent(tx, {
        eventType: 'maintenance.guest_charge',
        aggregateType: 'MAINTENANCE_REQUEST',
        aggregateId: requestId,
        payload: {
          organizationId,
          hotelId,
          requestId,
          reservationId,
          folioItemId: charge.id,
          amount: input.amount,
          taxAmount: input.taxAmount,
        } as Prisma.InputJsonValue,
      });

      return updated;
    });

    return {
      request,
      charge,
    };
  }

  async getDashboard(organizationId: string, hotelId: string, atDate?: Date) {
    const referenceDate = atDate ?? new Date();
    const startOfDay = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate()
      )
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const [
      openCount,
      overdueCount,
      unassignedCount,
      emergencyOpenCount,
      completedTodayCount,
      byPriorityRows,
      byStatusRows,
      recentCompleted,
    ] = await Promise.all([
      prisma.maintenanceRequest.count({
        where: {
          organizationId,
          hotelId,
          status: { in: OPEN_STATUSES },
        },
      }),
      prisma.maintenanceRequest.count({
        where: {
          organizationId,
          hotelId,
          status: { in: OPEN_STATUSES },
          targetCompletionAt: {
            lt: referenceDate,
          },
        },
      }),
      prisma.maintenanceRequest.count({
        where: {
          organizationId,
          hotelId,
          status: { in: OPEN_STATUSES },
          assignedTo: null,
        },
      }),
      prisma.maintenanceRequest.count({
        where: {
          organizationId,
          hotelId,
          status: { in: OPEN_STATUSES },
          priority: 'EMERGENCY',
        },
      }),
      prisma.maintenanceRequest.count({
        where: {
          organizationId,
          hotelId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
      prisma.maintenanceRequest.groupBy({
        by: ['priority'],
        where: {
          organizationId,
          hotelId,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.maintenanceRequest.groupBy({
        by: ['status'],
        where: {
          organizationId,
          hotelId,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.maintenanceRequest.findMany({
        where: {
          organizationId,
          hotelId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            not: null,
          },
        },
        select: {
          reportedAt: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: [{ completedAt: 'desc' }],
        take: 250,
      }),
    ]);

    const durationsInHours = recentCompleted
      .map((row) => {
        const start = row.startedAt ?? row.reportedAt;
        const end = row.completedAt;
        if (!end) {
          return null;
        }

        return Math.max(0, end.getTime() - start.getTime()) / (1000 * 60 * 60);
      })
      .filter((value): value is number => value !== null);

    const averageResolutionHours =
      durationsInHours.length > 0
        ? Number(
            (
              durationsInHours.reduce((sum, value) => sum + value, 0) / durationsInHours.length
            ).toFixed(2)
          )
        : 0;

    const dashboard: MaintenanceDashboardResponse = {
      openCount,
      overdueCount,
      unassignedCount,
      emergencyOpenCount,
      completedTodayCount,
      averageResolutionHours,
      byPriority: byPriorityRows.map((row) => ({
        priority: row.priority,
        count: row._count._all,
      })),
      byStatus: byStatusRows.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    };

    return { dashboard };
  }

  async createPreventiveSchedule(
    organizationId: string,
    hotelId: string,
    input: CreatePreventiveScheduleInput
  ) {
    if (input.roomId) {
      const room = await this.maintenanceRepo.findRoomForScope(
        input.roomId,
        organizationId,
        hotelId
      );
      if (!room) {
        throw new NotFoundError('Room not found in this hotel');
      }
    }

    if (input.assetId) {
      const asset = await this.maintenanceRepo.findAssetById(
        input.assetId,
        organizationId,
        hotelId
      );
      if (!asset) {
        throw new NotFoundError('Asset not found in this hotel');
      }
    }

    const created = await this.maintenanceRepo.createPreventiveSchedule(
      organizationId,
      hotelId,
      input
    );

    const computedNextRunAt = this.computeInitialNextRun(
      input.startDate,
      input.frequency,
      input.frequencyValue
    );

    if (created.nextRunAt.getTime() !== computedNextRunAt.getTime()) {
      const schedule = await this.maintenanceRepo.updatePreventiveSchedule(created.id, {
        nextRunAt: computedNextRunAt,
      });

      return { schedule };
    }

    return { schedule: created };
  }

  async listPreventiveSchedules(
    organizationId: string,
    hotelId: string,
    query: ListPreventiveSchedulesQueryInput
  ) {
    const page = query.page;
    const limit = query.limit;

    const { items, total } = await this.maintenanceRepo.listPreventiveSchedules(
      organizationId,
      hotelId,
      query,
      { page, limit }
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async pausePreventiveSchedule(organizationId: string, hotelId: string, scheduleId: string) {
    const schedule = await this.maintenanceRepo.findPreventiveScheduleById(
      scheduleId,
      organizationId,
      hotelId
    );

    if (!schedule) {
      throw new NotFoundError('Preventive schedule not found');
    }

    const updated = await this.maintenanceRepo.updatePreventiveSchedule(scheduleId, {
      isActive: false,
    });

    return { schedule: updated };
  }

  async generateDuePreventiveTasks(
    organizationId: string,
    hotelId: string,
    input: GenerateDuePreventiveInput
  ) {
    const at = input.date ?? new Date();
    const dueSchedules = await this.maintenanceRepo.listDuePreventiveSchedules(
      organizationId,
      hotelId,
      at,
      input.scheduleId
    );

    if (input.scheduleId && dueSchedules.length === 0) {
      throw new ScheduleNotDueError('Selected preventive schedule is not due yet');
    }

    let createdCount = 0;

    for (const schedule of dueSchedules) {
      if (schedule.endDate && schedule.endDate < at) {
        await this.maintenanceRepo.updatePreventiveSchedule(schedule.id, { isActive: false });
        continue;
      }

      const existing = await this.maintenanceRepo.findGeneratedRequestForScheduleDate(
        schedule.id,
        organizationId,
        hotelId,
        at
      );

      if (existing) {
        continue;
      }

      const targetCompletionAt = this.calculateSlaDeadline(schedule.priority, at);

      await prisma.$transaction(async (tx) => {
        const request = await this.maintenanceRepo.createRequest(
          {
            organizationId,
            hotelId,
            ...(schedule.roomId ? { roomId: schedule.roomId } : {}),
            ...(schedule.assetId ? { assetId: schedule.assetId } : {}),
            preventiveScheduleId: schedule.id,
            category: schedule.category,
            priority: schedule.priority,
            title: schedule.defaultTitle ?? `Preventive maintenance - ${schedule.title}`,
            description:
              schedule.defaultDescription ??
              schedule.description ??
              'Auto-generated from preventive maintenance schedule',
            source: 'PREVENTIVE',
            reportedBy: config.system.userId,
            reportedByType: 'SYSTEM',
            guestReported: false,
            scheduledFor: at,
            ...(schedule.estimatedHours !== null
              ? { estimatedHours: schedule.estimatedHours }
              : {}),
            targetCompletionAt,
            status: 'SCHEDULED',
            ...(schedule.autoAssignTo
              ? { assignedTo: schedule.autoAssignTo, assignedAt: new Date() }
              : {}),
          },
          tx
        );

        const nextRunAt = this.calculateNextRun(
          schedule.nextRunAt,
          schedule.frequency,
          schedule.frequencyValue
        );

        await this.maintenanceRepo.updatePreventiveSchedule(
          schedule.id,
          {
            lastGeneratedAt: at,
            nextRunAt,
          },
          tx
        );

        await this.maintenanceRepo.createOutboxEvent(tx, {
          eventType: 'maintenance.request_created',
          aggregateType: 'MAINTENANCE_REQUEST',
          aggregateId: request.id,
          payload: {
            organizationId,
            hotelId,
            requestId: request.id,
            source: 'PREVENTIVE',
            scheduleId: schedule.id,
          } as Prisma.InputJsonValue,
        });
      });

      createdCount += 1;
    }

    return {
      createdCount,
    };
  }

  async createAsset(organizationId: string, hotelId: string, input: CreateAssetInput) {
    if (input.roomId) {
      const room = await this.maintenanceRepo.findRoomForScope(
        input.roomId,
        organizationId,
        hotelId
      );
      if (!room) {
        throw new NotFoundError('Room not found in this hotel');
      }
    }

    const existing = await this.maintenanceRepo.findAssetByTag(
      input.assetTag,
      organizationId,
      hotelId
    );
    if (existing) {
      throw new AssetTagAlreadyExistsError();
    }

    const asset = await this.maintenanceRepo.createAsset(organizationId, hotelId, input);

    return { asset };
  }

  async listAssets(organizationId: string, hotelId: string, query: ListAssetsQueryInput) {
    const page = query.page;
    const limit = query.limit;

    const { items, total } = await this.maintenanceRepo.listAssets(organizationId, hotelId, query, {
      page,
      limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAssetDetail(organizationId: string, hotelId: string, assetId: string) {
    const asset = await this.maintenanceRepo.findAssetById(assetId, organizationId, hotelId);

    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    return { asset };
  }

  async updateAsset(
    organizationId: string,
    hotelId: string,
    assetId: string,
    input: UpdateAssetInput
  ) {
    const existing = await this.maintenanceRepo.findAssetById(assetId, organizationId, hotelId);

    if (!existing) {
      throw new NotFoundError('Asset not found');
    }

    if (input.roomId) {
      const room = await this.maintenanceRepo.findRoomForScope(
        input.roomId,
        organizationId,
        hotelId
      );
      if (!room) {
        throw new NotFoundError('Room not found in this hotel');
      }
    }

    const asset = await this.maintenanceRepo.updateAsset(assetId, input);

    return { asset };
  }

  async evaluateAsset(organizationId: string, hotelId: string, assetId: string) {
    const asset = await this.maintenanceRepo.findAssetById(assetId, organizationId, hotelId);

    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    const last12Months = new Date();
    last12Months.setUTCMonth(last12Months.getUTCMonth() - 12);

    const relatedRequests = await prisma.maintenanceRequest.findMany({
      where: {
        organizationId,
        hotelId,
        assetId,
        status: {
          in: ['COMPLETED', 'VERIFIED'],
        },
        completedAt: {
          gte: last12Months,
        },
      },
      select: {
        totalCost: true,
      },
    });

    const completedRequestsLast12Months = relatedRequests.length;
    const totalRepairCostLast12Months = relatedRequests.reduce((sum, row) => {
      return sum + Number((row.totalCost ?? new Prisma.Decimal(0)).toString());
    }, 0);

    const lifecycleStart = asset.installDate ?? asset.purchaseDate;
    const ageMonths = lifecycleStart
      ? Math.max(
          0,
          (new Date().getUTCFullYear() - lifecycleStart.getUTCFullYear()) * 12 +
            (new Date().getUTCMonth() - lifecycleStart.getUTCMonth())
        )
      : null;

    const lifeUtilizationRatio =
      ageMonths !== null && asset.lifeExpectancyMonths
        ? ageMonths / asset.lifeExpectancyMonths
        : null;

    const signals = {
      highRepairCost: totalRepairCostLast12Months >= 10000,
      frequentFailures: completedRequestsLast12Months >= 3,
      nearEndOfLife: (lifeUtilizationRatio ?? 0) >= 0.85,
    };

    const trueSignals = Object.values(signals).filter(Boolean).length;

    const recommendation: AssetEvaluationResult['recommendation'] =
      trueSignals >= 2 ? 'REPLACE' : trueSignals === 1 ? 'MONITOR' : 'MAINTAIN';

    const evaluation: AssetEvaluationResult = {
      recommendation,
      signals,
      metrics: {
        completedRequestsLast12Months,
        totalRepairCostLast12Months: Number(totalRepairCostLast12Months.toFixed(2)),
        ageMonths,
        lifeUtilizationRatio:
          lifeUtilizationRatio === null ? null : Number(lifeUtilizationRatio.toFixed(2)),
      },
    };

    return {
      asset,
      evaluation,
    };
  }

  private async getScopedRequest(requestId: string, organizationId: string, hotelId: string) {
    const request = await this.maintenanceRepo.findRequestById(requestId, organizationId, hotelId);

    if (!request) {
      throw new NotFoundError('Maintenance request not found');
    }

    if (request.organizationId !== organizationId || request.hotelId !== hotelId) {
      throw new ForbiddenError('Access denied');
    }

    return request;
  }

  private assertCanTransition(fromStatus: string, toStatus: string) {
    const allowedTargets = STATUS_TRANSITIONS[fromStatus] ?? [];

    if (!allowedTargets.includes(toStatus)) {
      throw new InvalidStatusTransitionError('Invalid maintenance request status transition', {
        fromStatus,
        toStatus,
        allowedTargets,
      });
    }
  }

  private calculateSlaDeadline(priority: string, from: Date): Date {
    const priorityKey: SlaPriority =
      priority in SLA_HOURS_BY_PRIORITY ? (priority as SlaPriority) : 'MEDIUM';
    const slaHours = SLA_HOURS_BY_PRIORITY[priorityKey];

    return new Date(from.getTime() + slaHours * 60 * 60 * 1000);
  }

  private bumpPriority(priority: string) {
    switch (priority) {
      case 'LOW':
        return 'MEDIUM';
      case 'MEDIUM':
        return 'HIGH';
      case 'HIGH':
        return 'URGENT';
      case 'URGENT':
        return 'EMERGENCY';
      default:
        return 'EMERGENCY';
    }
  }

  private asDateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private parsePartsUsed(value: unknown): PartsUsedRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const parsed: PartsUsedRecord[] = [];

    for (const row of value) {
      if (!row || typeof row !== 'object') {
        continue;
      }

      const candidate = row as Record<string, unknown>;
      const itemId = typeof candidate['itemId'] === 'string' ? candidate['itemId'] : null;
      const qty = typeof candidate['qty'] === 'number' ? candidate['qty'] : null;
      const unitCost = typeof candidate['unitCost'] === 'number' ? candidate['unitCost'] : null;
      const totalCost = typeof candidate['totalCost'] === 'number' ? candidate['totalCost'] : null;
      const usedAt = typeof candidate['usedAt'] === 'string' ? candidate['usedAt'] : null;

      if (itemId && qty !== null && unitCost !== null && totalCost !== null && usedAt) {
        parsed.push({
          itemId,
          qty,
          unitCost,
          totalCost,
          usedAt,
          ...(typeof candidate['notes'] === 'string' ? { notes: candidate['notes'] } : {}),
        });
      }
    }

    return parsed;
  }

  private computeInitialNextRun(startDate: Date, frequency: string, value: number): Date {
    const now = new Date();

    if (startDate > now) {
      return startDate;
    }

    if (value > 0) {
      const startTime = startDate.getTime();
      const nowTime = now.getTime();

      if (frequency === 'DAILY') {
        const intervalMs = value * 24 * 60 * 60 * 1000;
        const elapsed = nowTime - startTime;
        if (elapsed >= 0) {
          const intervalsPassed = Math.floor(elapsed / intervalMs) + 1;
          return new Date(startTime + intervalsPassed * intervalMs);
        }
      } else if (frequency === 'WEEKLY') {
        const intervalMs = value * 7 * 24 * 60 * 60 * 1000;
        const elapsed = nowTime - startTime;
        if (elapsed >= 0) {
          const intervalsPassed = Math.floor(elapsed / intervalMs) + 1;
          return new Date(startTime + intervalsPassed * intervalMs);
        }
      }
    }

    let cursor = startDate;
    const MAX_ITERATIONS = 10000;
    let iterations = 0;

    while (cursor <= now && iterations < MAX_ITERATIONS) {
      const next = this.calculateNextRun(cursor, frequency, value);

      if (next.getTime() === cursor.getTime()) {
        break;
      }

      cursor = next;
      iterations += 1;
    }

    if (cursor <= now) {
      cursor = this.calculateNextRun(now, frequency, value);
    }

    return cursor;
  }

  private calculateNextRun(from: Date, frequency: string, value: number): Date {
    const next = new Date(from);

    switch (frequency) {
      case 'DAILY':
        next.setUTCDate(next.getUTCDate() + value);
        break;
      case 'WEEKLY':
        next.setUTCDate(next.getUTCDate() + value * 7);
        break;
      case 'MONTHLY':
        next.setUTCMonth(next.getUTCMonth() + value);
        break;
      case 'QUARTERLY':
        next.setUTCMonth(next.getUTCMonth() + value * 3);
        break;
      case 'YEARLY':
        next.setUTCFullYear(next.getUTCFullYear() + value);
        break;
      default:
        next.setUTCDate(next.getUTCDate() + value);
        break;
    }

    return next;
  }
}

export const maintenanceService = new MaintenanceService();
