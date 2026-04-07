import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  ChannelConnectionResponse,
  ChannelSyncLogResponse,
  RatePlanMapping,
  RoomMapping,
  SyncLogQueryFilters,
} from './channel.types';

export type ChannelConnectionRecord = Prisma.ChannelConnectionGetPayload<Record<string, never>>;
export type ChannelSyncLogRecord = Prisma.ChannelSyncLogGetPayload<Record<string, never>>;

/**
 * Checks whether a JSON value is a non-null object record.
 *
 * @param value - JSON value from persisted mapping columns.
 * @returns `true` when value can be treated as a key-value object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Converts persisted room-mapping JSON into validated domain mappings.
 *
 * Invalid rows are skipped when required fields are missing so callers receive
 * only usable internal-to-external room mapping entries.
 *
 * @param value - Raw Prisma JSON value from `roomMappings`.
 * @returns Normalized room mapping array.
 */
const parseRoomMappings = (value: Prisma.JsonValue): RoomMapping[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const mappings: RoomMapping[] = [];

  for (const row of value) {
    if (!isRecord(row) || Array.isArray(row)) {
      continue;
    }

    const internalRoomTypeId = String(row['internalRoomTypeId'] ?? '');
    const externalRoomTypeCode = String(row['externalRoomTypeCode'] ?? '');

    if (internalRoomTypeId.length === 0 || externalRoomTypeCode.length === 0) {
      continue;
    }

    mappings.push({
      internalRoomTypeId,
      externalRoomTypeCode,
    });
  }

  return mappings;
};

/**
 * Converts persisted rate-plan mapping JSON into validated domain mappings.
 *
 * Rows without required IDs/codes are ignored. Optional markup is coerced to
 * number to align with outbound pricing calculations.
 *
 * @param value - Raw Prisma JSON value from `ratePlanMappings`.
 * @returns Normalized rate mapping array.
 */
const parseRateMappings = (value: Prisma.JsonValue): RatePlanMapping[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const mappings: RatePlanMapping[] = [];

  for (const row of value) {
    if (!isRecord(row) || Array.isArray(row)) {
      continue;
    }

    const internalRatePlanId = String(row['internalRatePlanId'] ?? '');
    const externalRatePlanCode = String(row['externalRatePlanCode'] ?? '');

    if (internalRatePlanId.length === 0 || externalRatePlanCode.length === 0) {
      continue;
    }

    mappings.push({
      internalRatePlanId,
      externalRatePlanCode,
      ...(row['markup'] !== undefined ? { markup: Number(row['markup']) } : {}),
    });
  }

  return mappings;
};

export class ChannelRepository {
  /**
   * Inserts a new channel connection row.
   *
   * @param data - Prisma create payload with scoped hotel linkage and credentials.
   * @returns Persisted channel connection record.
   */
  async createConnection(
    data: Prisma.ChannelConnectionCreateInput
  ): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.create({ data });
  }

  /**
   * Lists all channel connections for a hotel ordered by channel display name.
   *
   * @param hotelId - Hotel identifier used for tenancy scoping.
   * @returns Connection rows for the requested hotel.
   */
  async findConnectionsByHotel(hotelId: string): Promise<ChannelConnectionRecord[]> {
    return prisma.channelConnection.findMany({
      where: { hotelId },
      orderBy: [{ channelName: 'asc' }],
    });
  }

  /**
   * Finds a channel connection by primary ID.
   *
   * @param id - Channel connection ID.
   * @returns Connection row when found, otherwise `null`.
   */
  async findConnectionById(id: string): Promise<ChannelConnectionRecord | null> {
    return prisma.channelConnection.findUnique({ where: { id } });
  }

  /**
   * Finds a channel connection by hotel and normalized channel code.
   *
   * @param hotelId - Hotel identifier.
   * @param channelCode - Canonical channel code.
   * @returns Matching connection row or `null` when absent.
   */
  async findConnectionByHotelAndCode(
    hotelId: string,
    channelCode: string
  ): Promise<ChannelConnectionRecord | null> {
    return prisma.channelConnection.findUnique({
      where: {
        uq_channel_hotel_code: {
          hotelId,
          channelCode,
        },
      },
    });
  }

  /**
   * Lists active channel connections for a hotel.
   *
   * @param hotelId - Hotel identifier.
   * @returns Active connection rows sorted by channel name.
   */
  async findActiveConnectionsByHotel(hotelId: string): Promise<ChannelConnectionRecord[]> {
    return prisma.channelConnection.findMany({
      where: {
        hotelId,
        isActive: true,
      },
      orderBy: [{ channelName: 'asc' }],
    });
  }

  /**
   * Resolves the most recently updated active connection for webhook routing.
   *
   * This query supports fallback matching by `hotelId` or `propertyId` depending
   * on what identifiers are available in provider webhook payloads.
   *
   * @param channelCode - Canonical channel code from the route.
   * @param hotelId - Optional hotel ID extracted from headers/body.
   * @param propertyId - Optional provider property identifier from payload.
   * @returns Matching active connection row or `null`.
   */
  async findActiveConnectionForWebhook(
    channelCode: string,
    hotelId?: string,
    propertyId?: string
  ): Promise<ChannelConnectionRecord | null> {
    return prisma.channelConnection.findFirst({
      where: {
        channelCode,
        isActive: true,
        ...(hotelId ? { hotelId } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  /**
   * Updates a channel connection row.
   *
   * @param id - Channel connection ID.
   * @param data - Prisma update payload.
   * @returns Updated connection record.
   */
  async updateConnection(
    id: string,
    data: Prisma.ChannelConnectionUpdateInput
  ): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.update({
      where: { id },
      data,
    });
  }

  /**
   * Permanently removes a channel connection row.
   *
   * @param id - Channel connection ID.
   * @returns Resolves after deletion completes.
   */
  async deleteConnection(id: string): Promise<void> {
    await prisma.channelConnection.delete({ where: { id } });
  }

  /**
   * Replaces all persisted room mappings for a connection.
   *
   * @param id - Channel connection ID.
   * @param mappings - Internal/external room mapping entries.
   * @returns Updated connection record containing new JSON mappings.
   */
  async replaceRoomMappings(id: string, mappings: RoomMapping[]): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.update({
      where: { id },
      data: {
        roomMappings: mappings as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Replaces all persisted rate-plan mappings for a connection.
   *
   * @param id - Channel connection ID.
   * @param mappings - Internal/external rate mapping entries with optional markup.
   * @returns Updated connection record containing new JSON mappings.
   */
  async replaceRateMappings(
    id: string,
    mappings: RatePlanMapping[]
  ): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.update({
      where: { id },
      data: {
        ratePlanMappings: mappings as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Inserts a channel sync log row.
   *
   * @param data - Sync log payload describing direction, status, and metrics.
   * @returns Persisted sync log record.
   */
  async createSyncLog(
    data: Prisma.ChannelSyncLogUncheckedCreateInput
  ): Promise<ChannelSyncLogRecord> {
    return prisma.channelSyncLog.create({ data });
  }

  /**
   * Updates a channel sync log row.
   *
   * @param id - Sync log identifier.
   * @param data - Partial sync log updates.
   * @returns Updated sync log record.
   */
  async updateSyncLog(
    id: string,
    data: Prisma.ChannelSyncLogUpdateInput
  ): Promise<ChannelSyncLogRecord> {
    return prisma.channelSyncLog.update({
      where: { id },
      data,
    });
  }

  /**
   * Retrieves paginated sync logs and total count for a connection.
   *
   * The method runs `findMany` and `count` in parallel to keep pagination metadata
   * consistent with applied filters.
   *
   * @param connectionId - Channel connection ID.
   * @param filters - Optional sync type, status, date range, and pagination values.
   * @returns Sync log rows plus total count for pagination.
   */
  async getSyncLogs(
    connectionId: string,
    filters: SyncLogQueryFilters
  ): Promise<{ logs: ChannelSyncLogRecord[]; total: number }> {
    const where: Prisma.ChannelSyncLogWhereInput = {
      connectionId,
      ...(filters.syncType ? { syncType: filters.syncType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            startedAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [logs, total] = await Promise.all([
      prisma.channelSyncLog.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }],
        skip,
        take: filters.limit,
      }),
      prisma.channelSyncLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Maps a raw channel connection database row into API response shape.
   *
   * @param row - Persisted connection row.
   * @returns Normalized connection response with parsed mappings.
   */
  mapConnection(row: ChannelConnectionRecord): ChannelConnectionResponse {
    return {
      id: row.id,
      hotelId: row.hotelId,
      channelCode: row.channelCode,
      channelName: row.channelName,
      isActive: row.isActive,
      propertyId: row.propertyId,
      ratePlanMappings: parseRateMappings(row.ratePlanMappings),
      roomMappings: parseRoomMappings(row.roomMappings),
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      syncErrors: row.syncErrors,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Maps a raw sync log row into API response shape.
   *
   * @param row - Persisted sync log row.
   * @returns Sync log response object for controller output.
   */
  mapSyncLog(row: ChannelSyncLogRecord): ChannelSyncLogResponse {
    return {
      id: row.id,
      connectionId: row.connectionId,
      hotelId: row.hotelId,
      syncType: row.syncType,
      direction: row.direction,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      recordsProcessed: row.recordsProcessed,
      recordsFailed: row.recordsFailed,
      errorDetails: row.errorDetails,
      triggeredBy: row.triggeredBy,
    };
  }
}

export const channelRepository = new ChannelRepository();
