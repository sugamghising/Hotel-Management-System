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
  /**
   * Resolves the Prisma client context for repository operations.
   *
   * @param tx - Optional transaction client for callers already running inside `prisma.$transaction`.
   * @returns The provided transaction client, or the shared prisma client when `tx` is undefined.
   */
  private getDb(tx?: Prisma.TransactionClient) {
    return tx ?? prisma;
  }

  /**
   * Finds a room only when it belongs to the requested organization and hotel scope.
   *
   * @param roomId - Room UUID to look up.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Scoped room snapshot with operational status fields, or null when not found.
   */
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

  /**
   * Retrieves one maintenance request and its core relations within organization and hotel scope.
   *
   * @param id - Maintenance request UUID to retrieve.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Scoped maintenance request with room, asset, and preventive schedule relations, or null.
   */
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

  /**
   * Lists maintenance requests using scoped filters and pagination inputs.
   *
   * Builds one Prisma `where` tree (status, priority, category, assignee, room, overdue, and search),
   * then executes `findMany` and `count` together so callers receive page rows and total count
   * derived from the same logical filter set.
   *
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param filters - Query filters applied to request lifecycle and text fields.
   * @param pagination - Pagination controls with 1-based page and page size limit.
   * @returns Matching request page and total row count for pagination metadata.
   * @remarks Complexity: O(m + p) DB work where m is matching rows considered for count/order and p is page size returned.
   */
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

  /**
   * Creates a maintenance request row using transaction context when provided.
   *
   * @param data - Prisma unchecked create payload for `maintenanceRequest`.
   * @param tx - Optional transaction client used to keep writes atomic with caller operations.
   * @returns Newly created maintenance request including configured relation includes.
   */
  async createRequest(
    data: Prisma.MaintenanceRequestUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).maintenanceRequest.create({
      data,
      include: maintenanceRequestInclude,
    });
  }

  /**
   * Updates a maintenance request by identifier using the active Prisma client context.
   *
   * @param id - Maintenance request UUID to update.
   * @param data - Prisma unchecked update payload containing changed fields.
   * @param tx - Optional transaction client used when part of a wider transaction.
   * @returns Updated maintenance request including configured relation includes.
   */
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

  /**
   * Finds active reservation overlaps for a room across an out-of-order time window.
   *
   * @param roomId - Room UUID being evaluated for out-of-order conflicts.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param from - Inclusive lower bound of the OOO window.
   * @param until - Inclusive upper bound of the OOO window.
   * @returns Reservation-room conflicts limited to `CONFIRMED` and `CHECKED_IN` reservations.
   */
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

  /**
   * Persists a single outbox event within the caller transaction.
   *
   * @param tx - Active transaction client used to atomically write the outbox row.
   * @param input - Event envelope containing type, aggregate identity, and JSON payload.
   * @returns Created outbox event row.
   */
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

  /**
   * Persists multiple outbox events with one batched insert operation.
   *
   * Empty input arrays are ignored to avoid unnecessary database work.
   *
   * @param tx - Active transaction client used to atomically write outbox rows.
   * @param events - Outbox event envelopes to insert.
   * @returns Nothing. Returns early when `events` is empty.
   * @remarks Complexity: O(e) where e is number of events in the batch payload.
   */
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

  /**
   * Retrieves one preventive schedule with relations inside organization and hotel scope.
   *
   * @param id - Preventive schedule UUID to retrieve.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Scoped preventive schedule with room and asset relations, or null when absent.
   */
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

  /**
   * Creates a preventive schedule in organization and hotel scope.
   *
   * @param organizationId - Organization UUID assigned to the new schedule.
   * @param hotelId - Hotel UUID assigned to the new schedule.
   * @param input - Validated schedule payload including recurrence and optional room/asset links.
   * @returns Created preventive schedule with room and asset relations.
   */
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

  /**
   * Lists preventive schedules for one organization and hotel with optional filters.
   *
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param filters - Query filters for activation state, room, asset, and frequency.
   * @param pagination - Pagination controls with 1-based page and page size limit.
   * @returns Matching preventive schedule page and total row count.
   * @remarks Complexity: O(m + p) DB work where m is matching rows evaluated and p is returned page size.
   */
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

  /**
   * Returns active schedules due on or before a UTC cutoff timestamp.
   *
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param untilDate - Inclusive UTC cutoff for `nextRunAt`.
   * @param scheduleId - Optional schedule UUID to restrict results to one schedule.
   * @returns Due active schedules sorted by earliest `nextRunAt`.
   */
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

  /**
   * Checks whether a preventive schedule already generated a request for the same UTC day.
   *
   * Normalizes the supplied date into `[start, end)` UTC day boundaries to keep preventive generation
   * idempotent within an organization and hotel boundary.
   *
   * @param preventiveScheduleId - Preventive schedule UUID being checked.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param date - UTC timestamp whose calendar day should be checked.
   * @returns Existing generated request identifier when found; otherwise null.
   */
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

  /**
   * Updates a preventive schedule by identifier using transaction context when provided.
   *
   * @param id - Preventive schedule UUID to update.
   * @param data - Prisma unchecked update payload containing changed schedule fields.
   * @param tx - Optional transaction client used when part of a wider transaction.
   * @returns Updated preventive schedule with room and asset relations.
   */
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

  /**
   * Retrieves an asset and its room relation inside organization and hotel scope.
   *
   * @param id - Asset UUID to retrieve.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Scoped asset with room relation, or null when absent.
   */
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

  /**
   * Looks up an asset identifier by unique tag inside organization and hotel scope.
   *
   * @param assetTag - Asset tag expected to be unique per scope.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Matching asset identifier when found, or null when the tag is unused in scope.
   */
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

  /**
   * Creates an asset row scoped to organization and hotel identifiers.
   *
   * @param organizationId - Organization UUID assigned to the new asset.
   * @param hotelId - Hotel UUID assigned to the new asset.
   * @param input - Validated asset payload including identifying and lifecycle metadata.
   * @returns Created asset with optional room relation loaded.
   */
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

  /**
   * Applies partial asset updates by identifier.
   *
   * @param id - Asset UUID to update.
   * @param data - Partial asset update payload.
   * @returns Updated asset row with room relation loaded.
   */
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

  /**
   * Lists assets for one organization and hotel with optional filters and pagination.
   *
   * Executes `findMany` and `count` together so callers can render a paginated page with an
   * accurate total under the same filter set.
   *
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @param filters - Query filters for active flag, room binding, and asset category.
   * @param pagination - Pagination controls with 1-based page and page size limit.
   * @returns Matching asset page and total row count.
   * @remarks Complexity: O(m + p) DB work where m is matching rows evaluated and p is returned page size.
   */
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
