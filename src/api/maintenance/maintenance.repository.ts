import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  CreateAssetInput,
  CreatePreventiveScheduleInput,
  ListAssetsQueryInput,
  ListMaintenanceRequestsQueryInput,
  ListPreventiveSchedulesQueryInput,
  UpdateAssetInput,
} from './maintenance.schema';

const maintenanceRequestInclude = {
  room: true,
  asset: true,
  preventiveSchedule: true,
} satisfies Prisma.MaintenanceRequestInclude;

const preventiveScheduleInclude = {
  room: true,
  asset: true,
} satisfies Prisma.PreventiveScheduleInclude;

const assetInclude = {
  room: true,
} satisfies Prisma.AssetInclude;

export class MaintenanceRepository {
  private getDb(tx?: Prisma.TransactionClient) {
    return tx ?? prisma;
  }

  async findRoomForScope(roomId: string, organizationId: string, hotelId: string) {
    return prisma.room.findFirst({
      where: {
        id: roomId,
        organizationId,
        hotelId,
        deletedAt: null,
      },
      select: {
        id: true,
        roomNumber: true,
        status: true,
        isOutOfOrder: true,
      },
    });
  }

  async findRequestById(id: string, organizationId: string, hotelId: string) {
    return prisma.maintenanceRequest.findFirst({
      where: {
        id,
        organizationId,
        hotelId,
      },
      include: maintenanceRequestInclude,
    });
  }

  async listRequests(
    organizationId: string,
    hotelId: string,
    filters: ListMaintenanceRequestsQueryInput,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.MaintenanceRequestWhereInput = {
      organizationId,
      hotelId,
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.priority?.length ? { priority: { in: filters.priority } } : {}),
      ...(filters.category?.length ? { category: { in: filters.category } } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.overdue
        ? {
            status: {
              in: ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_PARTS'],
            },
            targetCompletionAt: {
              lt: new Date(),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: maintenanceRequestInclude,
        orderBy: [{ priority: 'desc' }, { reportedAt: 'desc' }],
        skip,
        take: pagination.limit,
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return { items, total };
  }

  async createRequest(
    data: Prisma.MaintenanceRequestUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).maintenanceRequest.create({
      data,
      include: maintenanceRequestInclude,
    });
  }

  async updateRequest(
    id: string,
    data: Prisma.MaintenanceRequestUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).maintenanceRequest.update({
      where: { id },
      data,
      include: maintenanceRequestInclude,
    });
  }

  async findOooConflicts(
    roomId: string,
    organizationId: string,
    hotelId: string,
    from: Date,
    until: Date
  ) {
    return prisma.reservationRoom.findMany({
      where: {
        roomId,
        reservation: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [{ checkInDate: { lte: until } }, { checkOutDate: { gte: from } }],
        },
      },
      select: {
        reservationId: true,
        reservation: {
          select: {
            confirmationNumber: true,
            checkInDate: true,
            checkOutDate: true,
            status: true,
          },
        },
      },
    });
  }

  async createOutboxEvent(
    tx: Prisma.TransactionClient,
    input: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Prisma.InputJsonValue;
    }
  ) {
    return tx.outboxEvent.create({
      data: {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
      },
    });
  }

  async createOutboxEvents(
    tx: Prisma.TransactionClient,
    events: Array<{
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Prisma.InputJsonValue;
    }>
  ) {
    if (events.length === 0) {
      return;
    }

    await tx.outboxEvent.createMany({
      data: events,
    });
  }

  async findPreventiveScheduleById(id: string, organizationId: string, hotelId: string) {
    return prisma.preventiveSchedule.findFirst({
      where: {
        id,
        organizationId,
        hotelId,
      },
      include: preventiveScheduleInclude,
    });
  }

  async createPreventiveSchedule(
    organizationId: string,
    hotelId: string,
    input: CreatePreventiveScheduleInput
  ) {
    return prisma.preventiveSchedule.create({
      data: {
        organizationId,
        hotelId,
        ...(input.roomId ? { roomId: input.roomId } : {}),
        ...(input.assetId ? { assetId: input.assetId } : {}),
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        category: input.category,
        priority: input.priority,
        frequency: input.frequency,
        frequencyValue: input.frequencyValue,
        startDate: input.startDate,
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        nextRunAt: input.startDate,
        ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
        ...(input.defaultTitle !== undefined ? { defaultTitle: input.defaultTitle } : {}),
        ...(input.defaultDescription !== undefined
          ? { defaultDescription: input.defaultDescription }
          : {}),
        ...(input.autoAssignTo !== undefined ? { autoAssignTo: input.autoAssignTo } : {}),
      },
      include: preventiveScheduleInclude,
    });
  }

  async listPreventiveSchedules(
    organizationId: string,
    hotelId: string,
    filters: ListPreventiveSchedulesQueryInput,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.PreventiveScheduleWhereInput = {
      organizationId,
      hotelId,
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.assetId ? { assetId: filters.assetId } : {}),
      ...(filters.frequency ? { frequency: filters.frequency } : {}),
    };

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      prisma.preventiveSchedule.findMany({
        where,
        include: preventiveScheduleInclude,
        orderBy: [{ nextRunAt: 'asc' }],
        skip,
        take: pagination.limit,
      }),
      prisma.preventiveSchedule.count({ where }),
    ]);

    return { items, total };
  }

  async listDuePreventiveSchedules(
    organizationId: string,
    hotelId: string,
    untilDate: Date,
    scheduleId?: string
  ) {
    return prisma.preventiveSchedule.findMany({
      where: {
        organizationId,
        hotelId,
        isActive: true,
        nextRunAt: {
          lte: untilDate,
        },
        ...(scheduleId ? { id: scheduleId } : {}),
      },
      include: preventiveScheduleInclude,
      orderBy: [{ nextRunAt: 'asc' }],
    });
  }

  async findGeneratedRequestForScheduleDate(
    preventiveScheduleId: string,
    organizationId: string,
    hotelId: string,
    date: Date
  ) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return prisma.maintenanceRequest.findFirst({
      where: {
        organizationId,
        hotelId,
        preventiveScheduleId,
        scheduledFor: {
          gte: start,
          lt: end,
        },
      },
      select: { id: true },
    });
  }

  async updatePreventiveSchedule(
    id: string,
    data: Prisma.PreventiveScheduleUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).preventiveSchedule.update({
      where: { id },
      data,
      include: preventiveScheduleInclude,
    });
  }

  async findAssetById(id: string, organizationId: string, hotelId: string) {
    return prisma.asset.findFirst({
      where: {
        id,
        organizationId,
        hotelId,
      },
      include: assetInclude,
    });
  }

  async findAssetByTag(assetTag: string, organizationId: string, hotelId: string) {
    return prisma.asset.findFirst({
      where: {
        assetTag,
        organizationId,
        hotelId,
      },
      select: {
        id: true,
      },
    });
  }

  async createAsset(organizationId: string, hotelId: string, input: CreateAssetInput) {
    return prisma.asset.create({
      data: {
        organizationId,
        hotelId,
        assetTag: input.assetTag,
        name: input.name,
        category: input.category,
        ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
        ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
        ...(input.modelNumber !== undefined ? { modelNumber: input.modelNumber } : {}),
        ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
        ...(input.purchaseDate !== undefined ? { purchaseDate: input.purchaseDate } : {}),
        ...(input.installDate !== undefined ? { installDate: input.installDate } : {}),
        ...(input.warrantyUntil !== undefined ? { warrantyUntil: input.warrantyUntil } : {}),
        ...(input.lifeExpectancyMonths !== undefined
          ? { lifeExpectancyMonths: input.lifeExpectancyMonths }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: assetInclude,
    });
  }

  async updateAsset(id: string, data: UpdateAssetInput) {
    return prisma.asset.update({
      where: { id },
      data: {
        ...(data.roomId !== undefined ? { roomId: data.roomId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer } : {}),
        ...(data.modelNumber !== undefined ? { modelNumber: data.modelNumber } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate } : {}),
        ...(data.installDate !== undefined ? { installDate: data.installDate } : {}),
        ...(data.warrantyUntil !== undefined ? { warrantyUntil: data.warrantyUntil } : {}),
        ...(data.lifeExpectancyMonths !== undefined
          ? { lifeExpectancyMonths: data.lifeExpectancyMonths }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: assetInclude,
    });
  }

  async listAssets(
    organizationId: string,
    hotelId: string,
    filters: ListAssetsQueryInput,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.AssetWhereInput = {
      organizationId,
      hotelId,
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    };

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: assetInclude,
        orderBy: [{ name: 'asc' }],
        skip,
        take: pagination.limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return { items, total };
  }
}

export const maintenanceRepository = new MaintenanceRepository();

export type MaintenanceRepositoryType = MaintenanceRepository;
