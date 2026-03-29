import { z } from 'zod';
import { config } from '../../config';
import { prisma } from '../../database/prisma';
import { logger } from '../logger';

const SYSTEM_ACTOR_ID = config.system.userId;

const ReservationCheckedOutPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  reservationRoomId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkedOutAt: z.coerce.date(),
  lateCheckOut: z.boolean().default(false),
});

const ReservationCheckedInPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  reservationRoomId: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  checkedInAt: z.coerce.date(),
  earlyCheckIn: z.boolean().optional(),
  assignmentType: z.enum(['INITIAL', 'AUTO', 'MANUAL', 'UPGRADE', 'CHANGE', 'WALK_IN']).optional(),
});

const ReservationNoShowPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  markedAt: z.coerce.date(),
  chargeNoShowFee: z.boolean().optional(),
  noShowFee: z.number().optional(),
  reason: z.string().optional(),
});

const RoomOccupiedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  roomId: z.string().uuid(),
  occupiedAt: z.coerce.date(),
});

const RoomVacatedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  roomId: z.string().uuid(),
  vacatedAt: z.coerce.date(),
  lateCheckOut: z.boolean().optional(),
});

const RoomUpgradedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  fromRoomId: z.string().uuid(),
  toRoomId: z.string().uuid(),
  assignedAt: z.coerce.date(),
});

const MaintenanceRequestCreatedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'EMERGENCY']).optional(),
  category: z.string().optional(),
  roomId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  source: z.string().optional(),
  scheduleId: z.string().uuid().optional(),
  reportedAt: z.coerce.date().optional(),
});

const MaintenanceOooSetPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  roomId: z.string().uuid(),
  oooUntil: z.coerce.date().optional(),
});

const MaintenanceOooClearedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  roomId: z.string().uuid(),
  clearedAt: z.coerce.date(),
});

const MaintenanceCompletedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  totalCost: z.number().optional(),
  completedAt: z.coerce.date().optional(),
});

const MaintenanceEscalatedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  fromPriority: z.string(),
  toPriority: z.string(),
  escalationLevel: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

const MaintenanceGuestChargePayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  reservationId: z.string().uuid(),
  folioItemId: z.string().uuid(),
  amount: z.number(),
  taxAmount: z.number().optional(),
});

const InventoryLowStockPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  itemId: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  reorderPoint: z.number().int(),
  availableStock: z.number().int(),
  refType: z.string().optional(),
  refId: z.string().uuid().optional(),
});

const NightAuditCompletedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  auditId: z.string().uuid().optional(),
  businessDate: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  nextBusinessDate: z.coerce.date().optional(),
  warningCount: z.number().int().nonnegative().optional(),
});

const NightAuditFailedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  auditId: z.string().uuid().optional(),
  businessDate: z.coerce.date().optional(),
  failedAt: z.coerce.date().optional(),
  reason: z.string().optional(),
});

const NightAuditRolledBackPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  auditId: z.string().uuid().optional(),
  businessDate: z.coerce.date(),
  rolledBackAt: z.coerce.date().optional(),
  rolledBackBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});

class OutboxWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isTicking = false;

  start(intervalMs = 5000): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.tick().catch((error: unknown) => {
        logger.error('Outbox worker tick failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, intervalMs);

    logger.info('Outbox worker started', { intervalMs });
  }

  stop(): void {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    logger.info('Outbox worker stopped');
  }

  private async tick(): Promise<void> {
    if (this.isTicking) {
      return;
    }

    this.isTicking = true;

    try {
      const event = await this.claimNextEvent();
      if (!event) {
        return;
      }

      await this.processEvent(event.id, event.eventType, event.payload);
    } finally {
      this.isTicking = false;
    }
  }

  private async claimNextEvent() {
    return prisma.$transaction(async (tx) => {
      const now = new Date();

      const next = await tx.outboxEvent.findFirst({
        where: {
          status: 'PENDING',
          nextAttemptAt: { lte: now },
        },
        orderBy: [{ createdAt: 'asc' }],
        select: { id: true },
      });

      if (!next) {
        return null;
      }

      // Atomically claim the event by conditionally updating only if it is still PENDING.
      const updated = await tx.outboxEvent.updateMany({
        where: {
          id: next.id,
          status: 'PENDING',
          nextAttemptAt: { lte: now },
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (updated.count !== 1) {
        // Another worker has already claimed or modified this event.
        return null;
      }

      // Reload the event in its new PROCESSING state and return it.
      return tx.outboxEvent.findUnique({
        where: { id: next.id },
      });
    });
  }

  private async processEvent(eventId: string, eventType: string, payload: unknown): Promise<void> {
    try {
      switch (eventType) {
        case 'reservation.checked_out':
          await this.handleReservationCheckedOut(payload);
          break;
        case 'reservation.checked_in':
          await this.handleReservationCheckedIn(payload);
          break;
        case 'reservation.no_show':
          await this.handleReservationNoShow(payload);
          break;
        case 'room.occupied':
          await this.handleRoomOccupied(payload);
          break;
        case 'room.vacated':
          await this.handleRoomVacated(payload);
          break;
        case 'room.upgraded':
          await this.handleRoomUpgraded(payload);
          break;
        case 'maintenance.request_created':
          await this.handleMaintenanceRequestCreated(payload);
          break;
        case 'maintenance.ooo_set':
          await this.handleMaintenanceOooSet(payload);
          break;
        case 'maintenance.ooo_cleared':
          await this.handleMaintenanceOooCleared(payload);
          break;
        case 'maintenance.completed':
          await this.handleMaintenanceCompleted(payload);
          break;
        case 'maintenance.escalated':
          await this.handleMaintenanceEscalated(payload);
          break;
        case 'maintenance.guest_charge':
          await this.handleMaintenanceGuestCharge(payload);
          break;
        case 'inventory.low_stock':
          await this.handleInventoryLowStock(payload);
          break;
        case 'night_audit.completed':
          await this.handleNightAuditCompleted(payload);
          break;
        case 'night_audit.failed':
          await this.handleNightAuditFailed(payload);
          break;
        case 'night_audit.rolled_back':
          await this.handleNightAuditRolledBack(payload);
          break;
        default:
          logger.warn('Unhandled outbox event type', { eventType, eventId });
          break;
      }

      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.markFailed(eventId, error);
    }
  }

  private async handleReservationCheckedOut(payload: unknown): Promise<void> {
    const parsed = ReservationCheckedOutPayloadSchema.parse(payload);
    const scheduledFor = this.asDateOnly(parsed.checkedOutAt);

    const existing = await prisma.housekeepingTask.findFirst({
      where: {
        organizationId: parsed.organizationId,
        hotelId: parsed.hotelId,
        roomId: parsed.roomId,
        taskType: 'CLEANING_DEPARTURE',
        scheduledFor,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED', 'COMPLETED', 'VERIFIED'],
        },
      },
      select: { id: true },
    });

    if (existing) {
      logger.info('Skipping departure task creation because task already exists', {
        taskId: existing.id,
        roomId: parsed.roomId,
        reservationId: parsed.reservationId,
      });
      return;
    }

    const room = await prisma.room.findFirst({
      where: {
        id: parsed.roomId,
        organizationId: parsed.organizationId,
        hotelId: parsed.hotelId,
      },
      select: {
        cleaningPriority: true,
      },
    });

    await prisma.housekeepingTask.create({
      data: {
        organizationId: parsed.organizationId,
        hotelId: parsed.hotelId,
        roomId: parsed.roomId,
        taskType: 'CLEANING_DEPARTURE',
        status: 'PENDING',
        priority: room?.cleaningPriority ?? 1,
        scheduledFor,
        notes: parsed.lateCheckOut
          ? 'Auto-created after late checkout'
          : 'Auto-created after checkout event',
        createdBy: SYSTEM_ACTOR_ID,
      },
    });

    logger.info('Departure housekeeping task created from checkout event', {
      reservationId: parsed.reservationId,
      roomId: parsed.roomId,
    });
  }

  private async handleReservationCheckedIn(payload: unknown): Promise<void> {
    const parsed = ReservationCheckedInPayloadSchema.parse(payload);

    logger.info('Reservation checked-in event processed', {
      reservationId: parsed.reservationId,
      roomId: parsed.roomId,
      earlyCheckIn: parsed.earlyCheckIn ?? false,
      assignmentType: parsed.assignmentType ?? 'INITIAL',
    });
  }

  private async handleReservationNoShow(payload: unknown): Promise<void> {
    const parsed = ReservationNoShowPayloadSchema.parse(payload);

    logger.info('Reservation no-show event processed', {
      reservationId: parsed.reservationId,
      chargeNoShowFee: parsed.chargeNoShowFee ?? false,
      noShowFee: parsed.noShowFee ?? null,
    });
  }

  private async handleRoomOccupied(payload: unknown): Promise<void> {
    const parsed = RoomOccupiedPayloadSchema.parse(payload);

    logger.info('Room occupied event processed', {
      reservationId: parsed.reservationId,
      roomId: parsed.roomId,
    });
  }

  private async handleRoomVacated(payload: unknown): Promise<void> {
    const parsed = RoomVacatedPayloadSchema.parse(payload);

    logger.info('Room vacated event processed', {
      reservationId: parsed.reservationId,
      roomId: parsed.roomId,
      lateCheckOut: parsed.lateCheckOut ?? false,
    });
  }

  private async handleRoomUpgraded(payload: unknown): Promise<void> {
    const parsed = RoomUpgradedPayloadSchema.parse(payload);

    logger.info('Room upgraded event processed', {
      reservationId: parsed.reservationId,
      fromRoomId: parsed.fromRoomId,
      toRoomId: parsed.toRoomId,
    });
  }

  private async handleMaintenanceRequestCreated(payload: unknown): Promise<void> {
    const parsed = MaintenanceRequestCreatedPayloadSchema.parse(payload);

    logger.info('Maintenance request created event processed', {
      requestId: parsed.requestId,
      roomId: parsed.roomId ?? null,
      assetId: parsed.assetId ?? null,
      priority: parsed.priority ?? null,
      source: parsed.source ?? 'MANUAL',
    });
  }

  private async handleMaintenanceOooSet(payload: unknown): Promise<void> {
    const parsed = MaintenanceOooSetPayloadSchema.parse(payload);

    logger.info('Maintenance room OOO set event processed', {
      requestId: parsed.requestId,
      roomId: parsed.roomId,
      oooUntil: parsed.oooUntil?.toISOString() ?? null,
    });
  }

  private async handleMaintenanceOooCleared(payload: unknown): Promise<void> {
    const parsed = MaintenanceOooClearedPayloadSchema.parse(payload);
    const scheduledFor = this.asDateOnly(parsed.clearedAt);

    const existing = await prisma.housekeepingTask.findFirst({
      where: {
        organizationId: parsed.organizationId,
        hotelId: parsed.hotelId,
        roomId: parsed.roomId,
        taskType: 'DEEP_CLEAN',
        scheduledFor,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED', 'COMPLETED', 'VERIFIED'],
        },
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.housekeepingTask.create({
        data: {
          organizationId: parsed.organizationId,
          hotelId: parsed.hotelId,
          roomId: parsed.roomId,
          taskType: 'DEEP_CLEAN',
          status: 'PENDING',
          scheduledFor,
          priority: 1,
          notes: 'Auto-created after maintenance room OOO clear event',
          createdBy: SYSTEM_ACTOR_ID,
        },
      });
    }

    logger.info('Maintenance room OOO cleared event processed', {
      requestId: parsed.requestId,
      roomId: parsed.roomId,
      housekeepingTaskCreated: !existing,
    });
  }

  private async handleMaintenanceCompleted(payload: unknown): Promise<void> {
    const parsed = MaintenanceCompletedPayloadSchema.parse(payload);

    logger.info('Maintenance completed event processed', {
      requestId: parsed.requestId,
      roomId: parsed.roomId ?? null,
      totalCost: parsed.totalCost ?? null,
    });
  }

  private async handleMaintenanceEscalated(payload: unknown): Promise<void> {
    const parsed = MaintenanceEscalatedPayloadSchema.parse(payload);

    logger.warn('Maintenance escalated event processed', {
      requestId: parsed.requestId,
      fromPriority: parsed.fromPriority,
      toPriority: parsed.toPriority,
      escalationLevel: parsed.escalationLevel,
      reason: parsed.reason ?? null,
    });
  }

  private async handleMaintenanceGuestCharge(payload: unknown): Promise<void> {
    const parsed = MaintenanceGuestChargePayloadSchema.parse(payload);

    logger.info('Maintenance guest charge event processed', {
      requestId: parsed.requestId,
      reservationId: parsed.reservationId,
      folioItemId: parsed.folioItemId,
      amount: parsed.amount,
      taxAmount: parsed.taxAmount ?? 0,
    });
  }

  private async handleInventoryLowStock(payload: unknown): Promise<void> {
    const parsed = InventoryLowStockPayloadSchema.parse(payload);

    logger.warn('Inventory low stock event processed', {
      itemId: parsed.itemId,
      sku: parsed.sku,
      availableStock: parsed.availableStock,
      reorderPoint: parsed.reorderPoint,
      refType: parsed.refType ?? null,
      refId: parsed.refId ?? null,
    });
  }

  private async handleNightAuditCompleted(payload: unknown): Promise<void> {
    const parsed = NightAuditCompletedPayloadSchema.parse(payload);

    logger.info('Night audit completed event processed', {
      organizationId: parsed.organizationId,
      hotelId: parsed.hotelId,
      auditId: parsed.auditId ?? null,
      businessDate: parsed.businessDate.toISOString(),
      completedAt: parsed.completedAt?.toISOString() ?? null,
      nextBusinessDate: parsed.nextBusinessDate?.toISOString() ?? null,
      warningCount: parsed.warningCount ?? 0,
    });
  }

  private async handleNightAuditFailed(payload: unknown): Promise<void> {
    const parsed = NightAuditFailedPayloadSchema.parse(payload);

    logger.warn('Night audit failed event processed', {
      organizationId: parsed.organizationId,
      hotelId: parsed.hotelId,
      auditId: parsed.auditId ?? null,
      businessDate: parsed.businessDate?.toISOString() ?? null,
      failedAt: parsed.failedAt?.toISOString() ?? null,
      reason: parsed.reason ?? null,
    });
  }

  private async handleNightAuditRolledBack(payload: unknown): Promise<void> {
    const parsed = NightAuditRolledBackPayloadSchema.parse(payload);

    logger.info('Night audit rollback event processed', {
      organizationId: parsed.organizationId,
      hotelId: parsed.hotelId,
      auditId: parsed.auditId ?? null,
      businessDate: parsed.businessDate.toISOString(),
      rolledBackAt: parsed.rolledBackAt?.toISOString() ?? null,
      rolledBackBy: parsed.rolledBackBy ?? null,
      reason: parsed.reason ?? null,
    });
  }

  private async markFailed(eventId: string, error: unknown): Promise<void> {
    const current = await prisma.outboxEvent.findUnique({
      where: { id: eventId },
      select: {
        attempts: true,
        maxAttempts: true,
      },
    });

    if (!current) {
      return;
    }

    const nextAttempts = current.attempts + 1;
    const shouldDeadLetter = nextAttempts >= current.maxAttempts;
    const nextAttemptAt = this.getNextAttemptAt(nextAttempts);
    const message = error instanceof Error ? error.message : String(error);

    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: shouldDeadLetter ? 'DEAD_LETTER' : 'PENDING',
        attempts: nextAttempts,
        nextAttemptAt,
        lastError: message,
      },
    });

    logger.error('Outbox event processing failed', {
      eventId,
      attempts: nextAttempts,
      shouldDeadLetter,
      error: message,
    });
  }

  private getNextAttemptAt(attempts: number): Date {
    // Exponential backoff capped at 30 minutes.
    const backoffMs = Math.min(30 * 60 * 1000, 1000 * 2 ** attempts);
    return new Date(Date.now() + backoffMs);
  }

  private asDateOnly(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}

const outboxWorker = new OutboxWorker();

export const startOutboxWorker = (intervalMs?: number): void => {
  outboxWorker.start(intervalMs);
};

export const stopOutboxWorker = (): void => {
  outboxWorker.stop();
};
