import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { logger } from '../logger';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

const ReservationCheckedOutPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  reservationId: z.string().uuid(),
  reservationRoomId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkedOutAt: z.coerce.date(),
  lateCheckOut: z.boolean().default(false),
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
      if (eventType === 'reservation.checked_out') {
        await this.handleReservationCheckedOut(payload);
      } else {
        logger.warn('Unhandled outbox event type', { eventType, eventId });
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
