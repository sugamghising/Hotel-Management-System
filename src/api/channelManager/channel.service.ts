import type { Request } from 'express';
import { config } from '../../config';
import {
  BadRequestError,
  ChannelNotActiveError,
  ConflictError,
  MappingNotFoundError,
  NotFoundError,
  logger,
} from '../../core';
import { encrypt } from '../../core/utils/crypto';
import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
import { communicationsService } from '../communications';
import { guestsRepository, guestsService } from '../guests';
import { hotelRepository } from '../hotel';
import { notificationService } from '../notification';
import { ratePlansRepository, ratePlansService } from '../ratePlans';
import { reservationsRepository, reservationsService } from '../reservations';
import { roomTypesRepository, roomTypesService } from '../roomTypes';
import { type IChannelAdapter, getAdapterByChannelCode } from './adapters';
import {
  type ChannelConnectionRecord,
  type ChannelSyncLogRecord,
  channelRepository,
} from './channel.repository';
import type {
  ChannelConnectionResponse,
  ChannelReservation,
  ChannelSyncLogListResponse,
  ChannelTriggerSource,
  CreateChannelConnectionInput,
  MapRatesInput,
  MapRoomsInput,
  RatePlanMapping,
  RoomMapping,
  SyncAllResult,
  SyncExecutionResult,
  SyncInput,
  SyncLogQueryFilters,
  UpdateChannelConnectionInput,
  WebhookProcessingResult,
} from './channel.types';

const CHANNEL_EVENT_ACTOR = config.system.userId;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateOnly = (value: Date): Date => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const asErrorDetails = (error: unknown): Prisma.InputJsonValue => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
};

const toBookingSource = (
  channelCode: string
): 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'AGODA' | 'TRIPADVISOR' | 'METASEARCH' => {
  const normalized = channelCode.trim().toUpperCase();

  switch (normalized) {
    case 'BOOKING_COM':
      return 'BOOKING_COM';
    case 'EXPEDIA':
      return 'EXPEDIA';
    case 'AIRBNB':
      return 'AIRBNB';
    case 'AGODA':
      return 'AGODA';
    case 'TRIPADVISOR':
      return 'TRIPADVISOR';
    default:
      return 'METASEARCH';
  }
};

export class ChannelService {
  async createConnection(
    organizationId: string,
    hotelId: string,
    input: CreateChannelConnectionInput
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const channelCode = input.channelCode.trim().toUpperCase();
    const existing = await channelRepository.findConnectionByHotelAndCode(hotelId, channelCode);
    if (existing) {
      throw new ConflictError(`Channel connection already exists for code ${channelCode}`);
    }

    const connection = await channelRepository.createConnection({
      hotel: { connect: { id: hotelId } },
      channelCode,
      channelName: input.channelName.trim(),
      isActive: false,
      apiKey: input.apiKey ? encrypt(input.apiKey) : null,
      apiSecret: input.apiSecret ? encrypt(input.apiSecret) : null,
      propertyId: input.propertyId?.trim() ?? null,
      ratePlanMappings: [],
      roomMappings: [],
    });

    return channelRepository.mapConnection(connection);
  }

  async listConnections(
    organizationId: string,
    hotelId: string
  ): Promise<ChannelConnectionResponse[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const rows = await channelRepository.findConnectionsByHotel(hotelId);
    return rows.map((row) => channelRepository.mapConnection(row));
  }

  async getConnection(
    organizationId: string,
    hotelId: string,
    connectionId: string
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const connection = await this.getConnectionOrThrow(connectionId, hotelId);
    return channelRepository.mapConnection(connection);
  }

  async updateConnection(
    organizationId: string,
    hotelId: string,
    connectionId: string,
    input: UpdateChannelConnectionInput
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const existing = await this.getConnectionOrThrow(connectionId, hotelId);

    const updateData: Prisma.ChannelConnectionUpdateInput = {};
    if (input.channelName !== undefined) {
      updateData.channelName = input.channelName.trim();
    }
    if (input.apiKey !== undefined) {
      updateData.apiKey = input.apiKey ? encrypt(input.apiKey) : null;
    }
    if (input.apiSecret !== undefined) {
      updateData.apiSecret = input.apiSecret ? encrypt(input.apiSecret) : null;
    }
    if (input.propertyId !== undefined) {
      updateData.propertyId = input.propertyId?.trim() || null;
    }

    const updated = await channelRepository.updateConnection(existing.id, updateData);
    return channelRepository.mapConnection(updated);
  }

  async deleteConnection(
    organizationId: string,
    hotelId: string,
    connectionId: string
  ): Promise<void> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const existing = await this.getConnectionOrThrow(connectionId, hotelId);
    await channelRepository.deleteConnection(existing.id);
  }

  async activateConnection(
    organizationId: string,
    hotelId: string,
    connectionId: string
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const existing = await this.getConnectionOrThrow(connectionId, hotelId);

    const updated = await channelRepository.updateConnection(existing.id, {
      isActive: true,
      lastSyncStatus: existing.lastSyncStatus,
    });

    return channelRepository.mapConnection(updated);
  }

  async deactivateConnection(
    organizationId: string,
    hotelId: string,
    connectionId: string
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const existing = await this.getConnectionOrThrow(connectionId, hotelId);

    const updated = await channelRepository.updateConnection(existing.id, {
      isActive: false,
    });

    return channelRepository.mapConnection(updated);
  }

  async mapRooms(
    organizationId: string,
    hotelId: string,
    connectionId: string,
    input: MapRoomsInput
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);
    const connection = await this.getConnectionOrThrow(connectionId, hotelId);

    for (const mapping of input.mappings) {
      const roomType = await roomTypesService.findById(mapping.internalRoomTypeId, organizationId);
      if (roomType.hotelId !== hotelId) {
        throw new NotFoundError(`Room type ${mapping.internalRoomTypeId} not found in hotel`);
      }
    }

    const updated = await channelRepository.replaceRoomMappings(connection.id, input.mappings);
    return channelRepository.mapConnection(updated);
  }

  async mapRates(
    organizationId: string,
    hotelId: string,
    connectionId: string,
    input: MapRatesInput
  ): Promise<ChannelConnectionResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);
    const connection = await this.getConnectionOrThrow(connectionId, hotelId);

    for (const mapping of input.mappings) {
      const ratePlan = await ratePlansService.findById(mapping.internalRatePlanId, organizationId);
      if (ratePlan.hotelId !== hotelId) {
        throw new NotFoundError(`Rate plan ${mapping.internalRatePlanId} not found in hotel`);
      }
      if (mapping.markup !== undefined && (mapping.markup < -50 || mapping.markup > 200)) {
        throw new BadRequestError('Markup must be between -50 and 200');
      }
    }

    const normalized: RatePlanMapping[] = input.mappings.map((mapping) => ({
      internalRatePlanId: mapping.internalRatePlanId,
      externalRatePlanCode: mapping.externalRatePlanCode,
      ...(mapping.markup !== undefined ? { markup: mapping.markup } : {}),
    }));

    const updated = await channelRepository.replaceRateMappings(connection.id, normalized);
    return channelRepository.mapConnection(updated);
  }

  async getMappings(
    organizationId: string,
    hotelId: string,
    connectionId: string
  ): Promise<{ roomMappings: RoomMapping[]; ratePlanMappings: RatePlanMapping[] }> {
    await this.verifyHotelAccess(organizationId, hotelId);
    const connection = await this.getConnectionOrThrow(connectionId, hotelId);
    const mapped = channelRepository.mapConnection(connection);

    return {
      roomMappings: mapped.roomMappings,
      ratePlanMappings: mapped.ratePlanMappings,
    };
  }

  async pushAvailabilityAndRates(
    organizationId: string,
    hotelId: string,
    connectionId: string,
    input: SyncInput,
    triggeredBy: ChannelTriggerSource = 'USER'
  ): Promise<SyncExecutionResult> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const connection = await this.getConnectionOrThrow(connectionId, hotelId);
    if (!connection.isActive) {
      throw new ChannelNotActiveError();
    }

    const mappedConnection = channelRepository.mapConnection(connection);
    const adapter = this.getAdapter(mappedConnection.channelCode);
    const dateFrom = toDateOnly(input.dateFrom);
    const dateTo = toDateOnly(input.dateTo);

    const syncLog = await channelRepository.createSyncLog({
      connectionId: connection.id,
      hotelId,
      syncType: 'FULL_SYNC',
      direction: 'OUTBOUND',
      status: 'FAILED',
      startedAt: new Date(),
      triggeredBy,
      recordsProcessed: 0,
      recordsFailed: 0,
    });

    let recordsProcessed = 0;
    let recordsFailed = 0;
    const syncErrors: Array<Record<string, unknown>> = [];

    try {
      const availabilityItems: Array<{
        date: Date;
        externalRoomCode: string;
        available: number;
        stopSell: boolean;
      }> = [];

      for (const roomMapping of mappedConnection.roomMappings) {
        try {
          const roomType = await roomTypesService.findById(
            roomMapping.internalRoomTypeId,
            organizationId
          );
          if (roomType.hotelId !== hotelId) {
            throw new NotFoundError(`Room type ${roomType.id} not found in hotel`);
          }

          const inventory = await roomTypesRepository.getInventory(
            roomMapping.internalRoomTypeId,
            dateFrom,
            dateTo
          );

          for (const row of inventory) {
            availabilityItems.push({
              date: row.date,
              externalRoomCode: roomMapping.externalRoomTypeCode,
              available: row.available,
              stopSell: row.stopSell,
            });
          }
        } catch (error) {
          recordsFailed += 1;
          syncErrors.push({
            type: 'availability_mapping_error',
            roomMapping,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const rateItems: Array<{
        date: Date;
        externalRoomCode: string;
        externalRateCode: string;
        rate: Prisma.Decimal;
      }> = [];

      for (const rateMapping of mappedConnection.ratePlanMappings) {
        try {
          const ratePlan = await ratePlansService.findById(
            rateMapping.internalRatePlanId,
            organizationId
          );
          if (ratePlan.hotelId !== hotelId) {
            throw new NotFoundError(`Rate plan ${ratePlan.id} not found in hotel`);
          }

          const roomMapping = mappedConnection.roomMappings.find(
            (item) => item.internalRoomTypeId === ratePlan.roomTypeId
          );

          if (!roomMapping) {
            throw new MappingNotFoundError(
              mappedConnection.channelCode,
              ratePlan.roomTypeId,
              'room'
            );
          }

          const overrides = await ratePlansRepository.getOverrides(
            rateMapping.internalRatePlanId,
            dateFrom,
            dateTo
          );

          const overridesByDate = new Map<string, number>();
          for (const override of overrides) {
            const key = toDateOnly(override.date).toISOString();
            overridesByDate.set(key, override.rate);
          }

          let cursor = new Date(dateFrom);
          while (cursor <= dateTo) {
            const key = toDateOnly(cursor).toISOString();
            const baseRate = overridesByDate.get(key) ?? ratePlan.pricing.baseRate;

            const baseDecimal = new Prisma.Decimal(baseRate);
            const markupDecimal = new Prisma.Decimal(rateMapping.markup ?? 0);
            const multiplier = new Prisma.Decimal(1).add(markupDecimal.div(100));
            const grossRate = baseDecimal.mul(multiplier).toDecimalPlaces(2);

            rateItems.push({
              date: new Date(cursor),
              externalRoomCode: roomMapping.externalRoomTypeCode,
              externalRateCode: rateMapping.externalRatePlanCode,
              rate: grossRate,
            });

            cursor = addDays(cursor, 1);
          }
        } catch (error) {
          recordsFailed += 1;
          syncErrors.push({
            type: 'rate_mapping_error',
            rateMapping,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await adapter.pushAvailability(connection, {
        dateFrom,
        dateTo,
        items: availabilityItems,
      });

      await adapter.pushRates(connection, {
        dateFrom,
        dateTo,
        items: rateItems,
      });

      recordsProcessed = availabilityItems.length + rateItems.length;
      const status = recordsFailed > 0 ? 'PARTIAL' : 'SUCCESS';

      const errorDetailsJson =
        syncErrors.length > 0 ? (syncErrors as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

      await channelRepository.updateSyncLog(syncLog.id, {
        completedAt: new Date(),
        status,
        recordsProcessed,
        recordsFailed,
        errorDetails: errorDetailsJson,
      });

      await channelRepository.updateConnection(connection.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        syncErrors: status === 'SUCCESS' ? 0 : connection.syncErrors + 1,
      });

      await this.emitOutboxEvent('channel.sync_completed', connection.id, {
        connectionId: connection.id,
        channelCode: mappedConnection.channelCode,
        syncType: 'FULL_SYNC',
        recordsProcessed,
        recordsFailed,
      });

      return {
        connectionId: connection.id,
        channelCode: mappedConnection.channelCode,
        status: 'success',
        recordsProcessed,
        recordsFailed,
      };
    } catch (error) {
      await channelRepository.updateSyncLog(syncLog.id, {
        completedAt: new Date(),
        status: 'FAILED',
        recordsProcessed,
        recordsFailed,
        errorDetails: asErrorDetails(error),
      });

      await channelRepository.updateConnection(connection.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'FAILED',
        syncErrors: connection.syncErrors + 1,
      });

      await this.emitOutboxEvent('channel.sync_failed', connection.id, {
        connectionId: connection.id,
        channelCode: mappedConnection.channelCode,
        error: error instanceof Error ? error.message : String(error),
        hotelId,
      });

      throw error;
    }
  }

  async syncAll(
    organizationId: string,
    hotelId: string,
    input: SyncInput,
    triggeredBy: ChannelTriggerSource = 'USER'
  ): Promise<SyncAllResult> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const activeConnections = await channelRepository.findActiveConnectionsByHotel(hotelId);

    const results = await Promise.allSettled(
      activeConnections.map((connection) =>
        this.pushAvailabilityAndRates(organizationId, hotelId, connection.id, input, triggeredBy)
      )
    );

    const summary: SyncAllResult = {
      totalConnections: activeConnections.length,
      successful: 0,
      failed: 0,
      results: [],
    };

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const connection = activeConnections[i];

      if (!connection) {
        continue;
      }

      if (result?.status === 'fulfilled') {
        summary.successful += 1;
        summary.results.push(result.value);
      } else {
        summary.failed += 1;
        summary.results.push({
          connectionId: connection.id,
          channelCode: connection.channelCode,
          status: 'failed',
          recordsProcessed: 0,
          recordsFailed: 1,
          error: result?.reason instanceof Error ? result.reason.message : String(result?.reason),
        });
      }
    }

    return summary;
  }

  async getSyncLogs(
    organizationId: string,
    hotelId: string,
    connectionId: string,
    filters: SyncLogQueryFilters
  ): Promise<ChannelSyncLogListResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const connection = await this.getConnectionOrThrow(connectionId, hotelId);
    const { logs, total } = await channelRepository.getSyncLogs(connection.id, filters);

    return {
      logs: logs.map((row) => channelRepository.mapSyncLog(row)),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  verifyWebhookSignature(channelCode: string, req: Request): boolean {
    const adapter = this.getAdapter(channelCode);
    return adapter.verifyWebhookSignature(req);
  }

  async handleInboundReservation(
    channelCode: string,
    rawBody: unknown,
    hotelId?: string
  ): Promise<WebhookProcessingResult> {
    const connection = await this.resolveInboundConnection(channelCode, rawBody, hotelId);
    if (!connection || !connection.isActive) {
      return { handled: false, reason: 'connection_not_found' };
    }

    const syncLog = await this.beginInboundSyncLog(connection, 'RESERVATION_PULL');

    try {
      const adapter = this.getAdapter(channelCode);
      const parsed = adapter.parseWebhookReservation(rawBody);

      if (typeof parsed.externalRef !== 'string' || parsed.externalRef.trim().length === 0) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          error: 'Invalid or empty externalRef in inbound reservation',
        });
        return { handled: false, reason: 'invalid_external_ref' };
      }

      const existing = await reservationsRepository.findByExternalRef(
        parsed.externalRef,
        connection.hotelId
      );

      if (existing) {
        await this.completeInboundSyncLog(syncLog, 'SUCCESS', 1, 0);
        return { handled: true, reservationId: existing.id };
      }

      const mappedConnection = channelRepository.mapConnection(connection);
      const roomMapping = this.findRoomMapping(
        mappedConnection.roomMappings,
        parsed.externalRoomTypeCode,
        mappedConnection.channelCode
      );
      const rateMapping = this.findRateMapping(
        mappedConnection.ratePlanMappings,
        parsed.externalRatePlanCode,
        mappedConnection.channelCode
      );

      const hotel = await hotelRepository.findById(connection.hotelId);
      if (!hotel || hotel.deletedAt) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'hotel_not_found',
        });
        return { handled: false, reason: 'hotel_not_found' };
      }

      const organizationId = hotel.organizationId;

      const roomType = await roomTypesService.findById(
        roomMapping.internalRoomTypeId,
        organizationId
      );
      const ratePlan = await ratePlansService.findById(
        rateMapping.internalRatePlanId,
        organizationId
      );

      if (roomType.hotelId !== connection.hotelId || ratePlan.hotelId !== connection.hotelId) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'mapping_hotel_mismatch',
        });
        return { handled: false, reason: 'mapping_hotel_mismatch' };
      }

      const guestId = await this.findOrCreateGuest(organizationId, parsed, hotel.defaultLanguage);

      const reservation = await reservationsService.create(
        organizationId,
        connection.hotelId,
        {
          guestId,
          checkInDate: parsed.checkInDate,
          checkOutDate: parsed.checkOutDate,
          adultCount: parsed.adults,
          childCount: parsed.children,
          roomTypeId: roomMapping.internalRoomTypeId,
          ratePlanId: rateMapping.internalRatePlanId,
          source: toBookingSource(parsed.channelCode),
          channelCode: parsed.channelCode,
          externalRef: parsed.externalRef,
          ...(parsed.specialRequests ? { specialRequests: parsed.specialRequests } : {}),
        },
        CHANNEL_EVENT_ACTOR
      );

      await communicationsService.sendForReservation(
        reservation.id,
        'RESERVATION_CONFIRMATION',
        undefined,
        CHANNEL_EVENT_ACTOR
      );

      await this.emitOutboxEvent('channel.reservation_received', connection.id, {
        connectionId: connection.id,
        channelCode: connection.channelCode,
        externalRef: parsed.externalRef,
        reservationId: reservation.id,
        hotelId: connection.hotelId,
      });

      await this.completeInboundSyncLog(syncLog, 'SUCCESS', 1, 0);
      return { handled: true, reservationId: reservation.id };
    } catch (error) {
      await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { handled: false, reason: 'reservation_processing_failed' };
    }
  }

  async handleInboundModification(
    channelCode: string,
    rawBody: unknown,
    hotelId?: string
  ): Promise<WebhookProcessingResult> {
    const connection = await this.resolveInboundConnection(channelCode, rawBody, hotelId);
    if (!connection || !connection.isActive) {
      return { handled: false, reason: 'connection_not_found' };
    }

    const syncLog = await this.beginInboundSyncLog(connection, 'RESERVATION_PULL');

    try {
      const adapter = this.getAdapter(channelCode);
      const parsed = adapter.parseWebhookModification(rawBody);

      const reservation = await reservationsRepository.findByExternalRef(
        parsed.externalRef,
        connection.hotelId
      );

      if (!reservation) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'reservation_not_found',
          externalRef: parsed.externalRef,
        });
        return { handled: false, reason: 'reservation_not_found' };
      }

      const hotel = await hotelRepository.findById(connection.hotelId);
      if (!hotel || hotel.deletedAt) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'hotel_not_found',
        });
        return { handled: false, reason: 'hotel_not_found' };
      }

      const updateInput: {
        checkInDate?: Date;
        checkOutDate?: Date;
        adultCount?: number;
        childCount?: number;
      } = {};

      if (parsed.checkInDate) updateInput.checkInDate = parsed.checkInDate;
      if (parsed.checkOutDate) updateInput.checkOutDate = parsed.checkOutDate;
      if (parsed.adults !== undefined) updateInput.adultCount = parsed.adults;
      if (parsed.children !== undefined) updateInput.childCount = parsed.children;

      await reservationsService.update(
        reservation.id,
        hotel.organizationId,
        connection.hotelId,
        updateInput,
        CHANNEL_EVENT_ACTOR
      );

      await communicationsService.sendForReservation(
        reservation.id,
        'MODIFICATION',
        undefined,
        CHANNEL_EVENT_ACTOR
      );

      await this.completeInboundSyncLog(syncLog, 'SUCCESS', 1, 0);
      return { handled: true, reservationId: reservation.id };
    } catch (error) {
      await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { handled: false, reason: 'modification_processing_failed' };
    }
  }

  async handleInboundCancellation(
    channelCode: string,
    rawBody: unknown,
    hotelId?: string
  ): Promise<WebhookProcessingResult> {
    const connection = await this.resolveInboundConnection(channelCode, rawBody, hotelId);
    if (!connection || !connection.isActive) {
      return { handled: false, reason: 'connection_not_found' };
    }

    const syncLog = await this.beginInboundSyncLog(connection, 'RESERVATION_PULL');

    try {
      const adapter = this.getAdapter(channelCode);
      const parsed = adapter.parseWebhookCancellation(rawBody);

      const reservation = await reservationsRepository.findByExternalRef(
        parsed.externalRef,
        connection.hotelId
      );

      if (!reservation) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'reservation_not_found',
          externalRef: parsed.externalRef,
        });
        return { handled: false, reason: 'reservation_not_found' };
      }

      if (reservation.status === 'CANCELLED') {
        await this.completeInboundSyncLog(syncLog, 'SUCCESS', 1, 0);
        return { handled: true, reservationId: reservation.id };
      }

      const hotel = await hotelRepository.findById(connection.hotelId);
      if (!hotel || hotel.deletedAt) {
        await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
          reason: 'hotel_not_found',
        });
        return { handled: false, reason: 'hotel_not_found' };
      }

      await reservationsService.cancel(
        reservation.id,
        hotel.organizationId,
        connection.hotelId,
        parsed.cancellationReason ?? 'Cancellation received from channel',
        true,
        CHANNEL_EVENT_ACTOR
      );

      await communicationsService.sendForReservation(
        reservation.id,
        'CANCELLATION',
        undefined,
        CHANNEL_EVENT_ACTOR
      );

      await this.completeInboundSyncLog(syncLog, 'SUCCESS', 1, 0);
      return { handled: true, reservationId: reservation.id };
    } catch (error) {
      await this.completeInboundSyncLog(syncLog, 'FAILED', 0, 1, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { handled: false, reason: 'cancellation_processing_failed' };
    }
  }

  async handleNightAuditCompleted(organizationId: string, hotelId: string): Promise<void> {
    const today = toDateOnly(new Date());
    const dateTo = addDays(today, 30);

    try {
      await this.syncAll(
        organizationId,
        hotelId,
        {
          dateFrom: today,
          dateTo,
        },
        'NIGHT_AUDIT'
      );
    } catch (error) {
      logger.error('Failed to sync channels after night audit completion', {
        organizationId,
        hotelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async handleRateOrInventoryUpdated(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<void> {
    try {
      await this.syncAll(
        organizationId,
        hotelId,
        {
          dateFrom,
          dateTo,
        },
        'SYSTEM'
      );
    } catch (error) {
      logger.error('Failed to sync channels after pricing/inventory event', {
        organizationId,
        hotelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async handleSyncFailedNotification(payload: {
    connectionId: string;
    channelCode: string;
    error: string;
    hotelId?: string | undefined;
  }): Promise<void> {
    if (!payload.hotelId) {
      return;
    }

    const userRoles = await prisma.userRole.findMany({
      where: {
        hotelId: payload.hotelId,
        role: {
          code: {
            in: ['REV_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'SUPER_ADMIN'],
          },
        },
      },
      select: {
        userId: true,
      },
    });

    const recipients = Array.from(new Set(userRoles.map((row) => row.userId)));
    if (recipients.length === 0) {
      return;
    }

    await notificationService.send(recipients, {
      type: 'ERROR',
      title: 'Channel sync failed',
      message: `${payload.channelCode} sync failed: ${payload.error}`,
      metadata: payload,
    });
  }

  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await hotelRepository.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel ${hotelId} not found`);
    }
  }

  private async getConnectionOrThrow(
    connectionId: string,
    hotelId: string
  ): Promise<ChannelConnectionRecord> {
    const connection = await channelRepository.findConnectionById(connectionId);
    if (!connection || connection.hotelId !== hotelId) {
      throw new NotFoundError(`Channel connection ${connectionId} not found`);
    }
    return connection;
  }

  private getAdapter(channelCode: string): IChannelAdapter {
    return getAdapterByChannelCode(channelCode);
  }

  private async beginInboundSyncLog(
    connection: ChannelConnectionRecord,
    syncType: string
  ): Promise<ChannelSyncLogRecord> {
    return channelRepository.createSyncLog({
      connectionId: connection.id,
      hotelId: connection.hotelId,
      syncType,
      direction: 'INBOUND',
      status: 'FAILED',
      startedAt: new Date(),
      triggeredBy: 'WEBHOOK',
      recordsProcessed: 0,
      recordsFailed: 0,
    });
  }

  private async completeInboundSyncLog(
    log: ChannelSyncLogRecord,
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL',
    recordsProcessed: number,
    recordsFailed: number,
    errorDetails?: Prisma.InputJsonValue
  ): Promise<void> {
    await channelRepository.updateSyncLog(log.id, {
      completedAt: new Date(),
      status,
      recordsProcessed,
      recordsFailed,
      ...(errorDetails !== undefined ? { errorDetails } : {}),
    });
  }

  private async emitOutboxEvent(
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.outboxEvent.create({
        data: {
          eventType,
          aggregateType: 'ChannelConnection',
          aggregateId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error('Failed to emit channel outbox event', {
        eventType,
        aggregateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolveInboundConnection(
    channelCode: string,
    rawBody: unknown,
    hotelId?: string
  ): Promise<ChannelConnectionRecord | null> {
    const normalizedCode = channelCode.trim().toUpperCase();
    const body = asObject(rawBody);
    const bodyPropertyId = asString(body['propertyId']);
    const bodyHotelId = asString(body['hotelId']);

    const resolvedHotelId = hotelId ?? bodyHotelId;

    if (resolvedHotelId) {
      return channelRepository.findConnectionByHotelAndCode(resolvedHotelId, normalizedCode);
    }

    return channelRepository.findActiveConnectionForWebhook(
      normalizedCode,
      undefined,
      bodyPropertyId
    );
  }

  private findRoomMapping(
    mappings: RoomMapping[],
    externalCode: string,
    channelCode: string
  ): RoomMapping {
    const match = mappings.find(
      (mapping) =>
        mapping.externalRoomTypeCode.trim().toUpperCase() === externalCode.trim().toUpperCase()
    );

    if (!match) {
      throw new MappingNotFoundError(channelCode, externalCode, 'room');
    }

    return match;
  }

  private findRateMapping(
    mappings: RatePlanMapping[],
    externalCode: string,
    channelCode: string
  ): RatePlanMapping {
    const match = mappings.find(
      (mapping) =>
        mapping.externalRatePlanCode.trim().toUpperCase() === externalCode.trim().toUpperCase()
    );

    if (!match) {
      throw new MappingNotFoundError(channelCode, externalCode, 'rate');
    }

    return match;
  }

  private async findOrCreateGuest(
    organizationId: string,
    reservation: ChannelReservation,
    defaultLanguage: string
  ): Promise<string> {
    const email = reservation.guestEmail?.toLowerCase();

    if (email) {
      const existing = await guestsRepository.findByEmail(organizationId, email);
      if (existing) {
        return existing.id;
      }
    }

    const created = await guestsService.create(organizationId, {
      firstName: reservation.guestFirstName,
      lastName: reservation.guestLastName,
      ...(email ? { email } : {}),
      ...(reservation.guestPhone
        ? { phone: reservation.guestPhone, mobile: reservation.guestPhone }
        : {}),
      languageCode: defaultLanguage || 'en',
      marketingConsent: false,
      emailOptIn: Boolean(email),
      smsOptIn: Boolean(reservation.guestPhone),
    });

    return created.id;
  }
}

export const channelService = new ChannelService();
