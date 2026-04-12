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

/**
 * Converts unknown input into a plain object used by webhook parsing helpers.
 *
 * @param value - Raw value from request payload parsing.
 * @returns A record when the input is a non-null object, otherwise an empty object.
 */
const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
};

/**
 * Normalizes primitive values into a trimmed string-compatible representation.
 *
 * @param value - Input that may be string, number, boolean, or unknown.
 * @param fallback - Value returned when input cannot be converted safely.
 * @returns A string value suitable for channel payload mapping.
 */
const asString = (value: unknown, fallback: string = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

/**
 * Parses integer-like payload fields while preserving a deterministic fallback.
 *
 * @param value - Incoming value from webhook payloads.
 * @param fallback - Integer returned when parsing fails.
 * @returns A truncated integer value derived from the payload or fallback.
 */
const asInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(asString(value, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Parses date-like payload values and falls back to a known timestamp on failure.
 *
 * @param value - Incoming date value from webhook payloads.
 * @param fallback - Date returned when parsing fails or input is invalid.
 * @returns A valid `Date` instance used by reservation mapping flows.
 */
const asDate = (value: unknown, fallback: Date): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(asString(value, ''));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export class GenericChannelAdapter implements IChannelAdapter {
  channelCode: string;

  /**
   * Creates a generic channel adapter instance bound to a channel identifier.
   *
   * @param channelCode - Canonical channel code attached to mapped webhook records.
   */
  constructor(channelCode: string = 'GENERIC') {
    this.channelCode = channelCode;
  }

  /**
   * Emits a stub outbound availability sync log entry for integration testing.
   *
   * This implementation does not call external provider APIs. It only writes a
   * structured log entry containing date range and record count so sync orchestration
   * can be exercised safely in local and CI environments.
   *
   * @param connection - Channel connection metadata used for trace identifiers.
   * @param payload - Availability records already mapped to external room codes.
   * @returns Resolves after logging the simulated dispatch operation.
   */
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

  /**
   * Emits a stub outbound rate sync log entry for integration testing.
   *
   * No provider HTTP request is performed. The method logs payload dimensions so
   * retry and sync-log behavior can be validated without channel credentials.
   *
   * @param connection - Channel connection metadata used for trace identifiers.
   * @param payload - Rate rows that already include mapped room and plan codes.
   * @returns Resolves after logging the simulated rate push.
   */
  async pushRates(connection: ChannelConnectionRecord, payload: RatesPayload): Promise<void> {
    logger.info('[CHANNEL STUB] pushRates', {
      channelCode: this.channelCode,
      connectionId: connection.id,
      records: payload.items.length,
      dateFrom: payload.dateFrom.toISOString(),
      dateTo: payload.dateTo.toISOString(),
    });
  }

  /**
   * Returns an empty reservation list for generic adapters with no pull integration.
   *
   * @param _connection - Connection context retained for interface compatibility.
   * @returns Always returns an empty array in stub mode.
   */
  async pullReservations(_connection: ChannelConnectionRecord): Promise<ChannelReservation[]> {
    return [];
  }

  /**
   * Maps a reservation webhook payload into the normalized channel reservation contract.
   *
   * The mapper applies resilient field fallbacks across common key aliases, enforces
   * sane occupant defaults (`adults >= 1`, `children >= 0`), parses monetary values
   * as `Prisma.Decimal`, and injects runtime timestamps when channel dates are missing.
   * This method is pure and has no network or database side effects.
   *
   * @param body - Raw webhook body from the inbound channel request.
   * @returns A normalized reservation payload ready for service-layer persistence.
   */
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

  /**
   * Maps a reservation-modification webhook into a partial update contract.
   *
   * Only provided fields are included in the response so callers can apply
   * selective updates. Date and occupancy values are normalized and bounded using
   * the same rules as reservation ingestion.
   *
   * @param body - Raw modification webhook payload.
   * @returns A normalized modification object with optional changed attributes.
   */
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

  /**
   * Maps a cancellation webhook payload into the normalized cancellation contract.
   *
   * @param body - Raw cancellation webhook payload.
   * @returns A cancellation object containing the external reference and optional reason.
   */
  parseWebhookCancellation(body: unknown): ChannelCancellation {
    const data = asRecord(body);
    const cancellationReason = asString(data['cancellationReason'] ?? data['reason']);

    return {
      externalRef: asString(data['externalRef'] ?? data['reservationId'] ?? data['id']),
      channelCode: this.channelCode,
      ...(cancellationReason ? { cancellationReason } : {}),
    };
  }

  /**
   * Verifies webhook signatures for generic adapters.
   *
   * This stub currently trusts every request and returns `true`. Real adapters
   * should override this method to validate provider-specific signatures/HMACs.
   *
   * @param _req - Incoming Express request containing headers and raw body.
   * @returns Always returns `true` in generic stub mode.
   */
  verifyWebhookSignature(_req: Request): boolean {
    return true;
  }
}
