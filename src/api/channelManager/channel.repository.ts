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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
  async createConnection(
    data: Prisma.ChannelConnectionCreateInput
  ): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.create({ data });
  }

  async findConnectionsByHotel(hotelId: string): Promise<ChannelConnectionRecord[]> {
    return prisma.channelConnection.findMany({
      where: { hotelId },
      orderBy: [{ channelName: 'asc' }],
    });
  }

  async findConnectionById(id: string): Promise<ChannelConnectionRecord | null> {
    return prisma.channelConnection.findUnique({ where: { id } });
  }

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

  async findActiveConnectionsByHotel(hotelId: string): Promise<ChannelConnectionRecord[]> {
    return prisma.channelConnection.findMany({
      where: {
        hotelId,
        isActive: true,
      },
      orderBy: [{ channelName: 'asc' }],
    });
  }

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

  async updateConnection(
    id: string,
    data: Prisma.ChannelConnectionUpdateInput
  ): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.update({
      where: { id },
      data,
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await prisma.channelConnection.delete({ where: { id } });
  }

  async replaceRoomMappings(id: string, mappings: RoomMapping[]): Promise<ChannelConnectionRecord> {
    return prisma.channelConnection.update({
      where: { id },
      data: {
        roomMappings: mappings as unknown as Prisma.InputJsonValue,
      },
    });
  }

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

  async createSyncLog(
    data: Prisma.ChannelSyncLogUncheckedCreateInput
  ): Promise<ChannelSyncLogRecord> {
    return prisma.channelSyncLog.create({ data });
  }

  async updateSyncLog(
    id: string,
    data: Prisma.ChannelSyncLogUpdateInput
  ): Promise<ChannelSyncLogRecord> {
    return prisma.channelSyncLog.update({
      where: { id },
      data,
    });
  }

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
