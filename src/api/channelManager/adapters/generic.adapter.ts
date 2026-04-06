import type { Request } from 'express';
import { logger } from '../../../core';
import { Prisma } from '../../../generated/prisma';
import type {
  AvailabilityPayload,
  ChannelCancellation,
  ChannelModification,
  ChannelReservation,
  RatesPayload,
} from '../channel.types';
import type { ChannelConnectionRecord, IChannelAdapter } from './adapter.interface';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown, fallback: string = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const asInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(asString(value, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const asDate = (value: unknown, fallback: Date): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(asString(value, ''));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export class GenericChannelAdapter implements IChannelAdapter {
  channelCode: string;

  constructor(channelCode: string = 'GENERIC') {
    this.channelCode = channelCode;
  }

  async pushAvailability(
    connection: ChannelConnectionRecord,
    payload: AvailabilityPayload
  ): Promise<void> {
    logger.info('[CHANNEL STUB] pushAvailability', {
      channelCode: this.channelCode,
      connectionId: connection.id,
      records: payload.items.length,
      dateFrom: payload.dateFrom.toISOString(),
      dateTo: payload.dateTo.toISOString(),
    });
  }

  async pushRates(connection: ChannelConnectionRecord, payload: RatesPayload): Promise<void> {
    logger.info('[CHANNEL STUB] pushRates', {
      channelCode: this.channelCode,
      connectionId: connection.id,
      records: payload.items.length,
      dateFrom: payload.dateFrom.toISOString(),
      dateTo: payload.dateTo.toISOString(),
    });
  }

  async pullReservations(_connection: ChannelConnectionRecord): Promise<ChannelReservation[]> {
    return [];
  }

  parseWebhookReservation(body: unknown): ChannelReservation {
    const data = asRecord(body);
    const now = new Date();
    const guestEmail = asString(data['guestEmail'] ?? data['email']);
    const guestPhone = asString(data['guestPhone'] ?? data['phone']);
    const specialRequests = asString(data['specialRequests']);

    return {
      externalRef: asString(data['externalRef'] ?? data['reservationId'] ?? data['id']),
      channelCode: this.channelCode,
      externalRoomTypeCode: asString(data['externalRoomTypeCode'] ?? data['roomTypeCode']),
      externalRatePlanCode: asString(data['externalRatePlanCode'] ?? data['ratePlanCode']),
      guestFirstName: asString(data['guestFirstName'] ?? data['firstName'] ?? 'Guest'),
      guestLastName: asString(data['guestLastName'] ?? data['lastName'] ?? 'FromChannel'),
      ...(guestEmail ? { guestEmail } : {}),
      ...(guestPhone ? { guestPhone } : {}),
      checkInDate: asDate(data['checkInDate'], now),
      checkOutDate: asDate(data['checkOutDate'], now),
      adults: Math.max(1, asInt(data['adults'], 1)),
      children: Math.max(0, asInt(data['children'], 0)),
      totalAmount: new Prisma.Decimal(asString(data['totalAmount'], '0')),
      currencyCode: asString(data['currencyCode'], 'USD'),
      ...(specialRequests ? { specialRequests } : {}),
      bookedAt: asDate(data['bookedAt'], now),
    };
  }

  parseWebhookModification(body: unknown): ChannelModification {
    const data = asRecord(body);

    const checkInDate =
      data['checkInDate'] !== undefined ? asDate(data['checkInDate'], new Date()) : undefined;
    const checkOutDate =
      data['checkOutDate'] !== undefined ? asDate(data['checkOutDate'], new Date()) : undefined;

    return {
      externalRef: asString(data['externalRef'] ?? data['reservationId'] ?? data['id']),
      channelCode: this.channelCode,
      ...(checkInDate ? { checkInDate } : {}),
      ...(checkOutDate ? { checkOutDate } : {}),
      ...(data['adults'] !== undefined ? { adults: Math.max(1, asInt(data['adults'], 1)) } : {}),
      ...(data['children'] !== undefined
        ? { children: Math.max(0, asInt(data['children'], 0)) }
        : {}),
      ...(data['totalAmount'] !== undefined
        ? { totalAmount: new Prisma.Decimal(asString(data['totalAmount'], '0')) }
        : {}),
    };
  }

  parseWebhookCancellation(body: unknown): ChannelCancellation {
    const data = asRecord(body);
    const cancellationReason = asString(data['cancellationReason'] ?? data['reason']);

    return {
      externalRef: asString(data['externalRef'] ?? data['reservationId'] ?? data['id']),
      channelCode: this.channelCode,
      ...(cancellationReason ? { cancellationReason } : {}),
    };
  }

  verifyWebhookSignature(_req: Request): boolean {
    return true;
  }
}
