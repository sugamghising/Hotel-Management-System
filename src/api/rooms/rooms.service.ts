import { BadRequestError, logger } from '../../core';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core';
import { type HotelRepository, hotelRepository } from '../hotel';
import { type RoomTypesRepository, roomTypesRepository } from '../roomTypes';
import { type RoomsRepository, roomsRepository } from './rooms.repository';
import type {
  AvailableRoomItem,
  BulkStatusUpdateInput,
  CleaningTaskItem,
  CreateRoomInput,
  Room,
  RoomConflict,
  RoomGridResponse,
  RoomHistoryEntry,
  RoomListResponse,
  RoomMaintenanceRecord,
  RoomQueryFilters,
  RoomReservationDetail,
  RoomResponse,
  RoomStatus,
  RoomStatusHistoryEntry,
  RoomTypeInfo,
  RoomWithType,
  SetOutOfOrderInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
} from './rooms.types';

export class RoomsService {
  private roomRepo: RoomsRepository;
  private roomTypeRepo: RoomTypesRepository;
  private hotelRepo: HotelRepository;

  constructor(
    roomRepo: RoomsRepository = roomsRepository,
    roomTypeRepo: RoomTypesRepository = roomTypesRepository,
    hotelRepo: HotelRepository = hotelRepository
  ) {
    this.roomRepo = roomRepo;
    this.roomTypeRepo = roomTypeRepo;
    this.hotelRepo = hotelRepo;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  async create(
    organizationId: string,
    hotelId: string,
    input: CreateRoomInput,
    _createdBy?: string
  ): Promise<RoomResponse> {
    // Verify hotel access
    await this.verifyHotelAccess(organizationId, hotelId);

    // Verify room type exists in this hotel
    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || roomType.deletedAt || roomType.hotelId !== hotelId) {
      throw new NotFoundError(`Room type '${input.roomTypeId}' not found`);
    }

    // Check room number uniqueness
    const existing = await this.roomRepo.findByRoomNumber(hotelId, input.roomNumber);
    if (existing) {
      throw new ConflictError(`Room number '${input.roomNumber}' already exists in this hotel`);
    }

    // Check organization room limits
    const hotel = await this.hotelRepo.findById(hotelId);
    if (!hotel) {
      throw new NotFoundError(`Hotel '${hotelId}' not found`);
    }

    const currentRoomCount = await this.roomRepo.countByHotel(hotelId);
    const orgLimits = await this.checkOrgLimits(organizationId, currentRoomCount + 1);
    if (!orgLimits.valid) {
      throw new BadRequestError(orgLimits.message ?? 'Organization room limit exceeded');
    }

    const room = await this.roomRepo.create({
      organizationId,
      hotelId,
      roomTypeId: input.roomTypeId,
      roomNumber: input.roomNumber.toUpperCase(),
      floor: input.floor ?? null,
      building: input.building || null,
      wing: input.wing || null,
      status: input.status || 'VACANT_CLEAN',
      isOutOfOrder: false,
      oooReason: null,
      oooFrom: null,
      oooUntil: null,
      isSmoking: input.isSmoking || false,
      isAccessible: input.isAccessible || false,
      viewType: input.viewType || null,
      lastCleanedAt: null,
      cleaningPriority: 0,
      maintenanceStatus: 'NONE',
      rackRate: input.rackRate || null,
    });

    // Update hotel total room count
    await this.hotelRepo.updateRoomCount(hotelId);

    logger.info(`Room created: ${room.roomNumber}`, {
      roomId: room.id,
      hotelId,
      roomTypeId: input.roomTypeId,
    });

    const roomTypeInfo: RoomTypeInfo = {
      id: roomType.id,
      code: roomType.code,
      name: roomType.name,
      baseOccupancy: roomType.baseOccupancy,
      maxOccupancy: roomType.maxOccupancy,
    };

    return this.mapToResponse(room, roomTypeInfo);
  }

  // ============================================================================
  // READ
  // ============================================================================

  async findById(
    id: string,
    organizationId: string,
    includeReservations: boolean = false
  ): Promise<RoomResponse> {
    const room = await this.roomRepo.findById(id, {
      roomType: true,
    });

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this room');
    }

    let currentReservation: RoomReservationDetail | null = null;
    let nextReservation: RoomReservationDetail | null = null;

    if (includeReservations) {
      [currentReservation, nextReservation] = await Promise.all([
        this.roomRepo.getCurrentReservation(id),
        this.roomRepo.getNextReservation(id),
      ]);
    }

    const roomTypeInfo = this.extractRoomTypeInfo(room);

    return this.mapToResponse(
      room,
      roomTypeInfo,
      currentReservation ?? undefined,
      nextReservation ?? undefined
    );
  }

  async findByHotel(
    hotelId: string,
    organizationId: string,
    filters: RoomQueryFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<RoomListResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const { rooms, total } = await this.roomRepo.findByHotel(hotelId, filters, pagination);

    // Get current guests for occupied rooms in a single batch to avoid N+1 queries
    const occupiedRoomIds = rooms
      .filter((room) => room.status.startsWith('OCCUPIED'))
      .map((room) => room.id);

    const reservationsByRoomId =
      occupiedRoomIds.length > 0
        ? await this.roomRepo.getCurrentReservationsByRoomIds(occupiedRoomIds)
        : new Map<string, RoomReservationDetail>();

    const roomsWithGuests = rooms.map((room) => {
      let currentGuest: string | undefined;

      if (room.status.startsWith('OCCUPIED')) {
        const current = reservationsByRoomId.get(room.id);
        if (current) {
          currentGuest = `${current.reservation.guest.firstName} ${current.reservation.guest.lastName}`;
        }
      }

      return {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        roomType: this.extractRoomTypeInfo(room),
        isOutOfOrder: room.isOutOfOrder,
        cleaningPriority: room.cleaningPriority,
        ...(currentGuest ? { currentGuest } : {}),
      };
    });

    return {
      rooms: roomsWithGuests,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getGrid(hotelId: string, organizationId: string): Promise<RoomGridResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const gridData = await this.roomRepo.getGridByHotel(hotelId);
    const counts = await this.roomRepo.getStatusCounts(hotelId);

    // Group by floor
    type GridRoomItem = RoomGridResponse['floors'][number]['rooms'][number];
    const floorsMap = new Map<number | null, GridRoomItem[]>();

    for (const row of gridData) {
      const floor = row.floor;
      if (!floorsMap.has(floor)) {
        floorsMap.set(floor, []);
      }

      const rooms = floorsMap.get(floor);
      if (rooms) {
        rooms.push({
          id: row.id,
          roomNumber: row.roomNumber,
          status: row.status,
          roomTypeCode: row.roomTypeCode,
          roomTypeName: row.roomTypeName,
          isOutOfOrder: row.isOutOfOrder,
          cleaningPriority: row.cleaningPriority,
          ...(row.currentGuest ? { currentGuest: row.currentGuest } : {}),
          ...(row.nextArrival
            ? { nextArrival: new Date(row.nextArrival).toISOString().split('T')[0] }
            : {}),
        });
      }
    }

    // Convert to array and sort
    const floors = Array.from(floorsMap.entries())
      .map(([floor, rooms]) => ({
        floor,
        rooms: rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
      }))
      .sort((a, b) => (a.floor ?? -1) - (b.floor ?? -1));

    const occupied =
      (counts['OCCUPIED_CLEAN'] || 0) +
      (counts['OCCUPIED_DIRTY'] || 0) +
      (counts['OCCUPIED_CLEANING'] || 0);

    return {
      floors,
      stats: {
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        vacantClean: counts['VACANT_CLEAN'] || 0,
        vacantDirty: counts['VACANT_DIRTY'] || 0,
        occupied,
        outOfOrder: counts['OUT_OF_ORDER'] || 0,
      },
    };
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  async update(
    id: string,
    organizationId: string,
    input: UpdateRoomInput,
    _updatedBy?: string
  ): Promise<RoomResponse> {
    const room = await this.roomRepo.findById(id);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this room');
    }

    // Check room number uniqueness if changing
    if (input.roomNumber && input.roomNumber !== room.roomNumber) {
      const existing = await this.roomRepo.findByRoomNumber(room.hotelId, input.roomNumber);
      if (existing) {
        throw new ConflictError(`Room number '${input.roomNumber}' already exists`);
      }
    }

    // Verify new room type if changing
    if (input.roomTypeId && input.roomTypeId !== room.roomTypeId) {
      const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
      if (!roomType || roomType.deletedAt || roomType.hotelId !== room.hotelId) {
        throw new NotFoundError(`Room type '${input.roomTypeId}' not found`);
      }

      // Check for active reservations
      const hasReservations = await this.roomRepo.getCurrentReservation(id);
      if (hasReservations) {
        throw new BadRequestError('Cannot change room type while room has active reservations');
      }
    }

    const updated = await this.roomRepo.update(id, {
      ...input,
      updatedAt: new Date(),
    });

    // Reload with room type
    const withType = await this.roomRepo.findById(id, { roomType: true });
    const roomTypeInfo = this.extractRoomTypeInfo(withType);

    logger.info(`Room updated: ${updated.roomNumber}`, { roomId: id });

    return this.mapToResponse(updated, roomTypeInfo);
  }

  // ============================================================================
  // STATUS MANAGEMENT
  // ============================================================================

  async updateStatus(
    id: string,
    organizationId: string,
    input: UpdateRoomStatusInput,
    _updatedBy?: string
  ): Promise<RoomResponse> {
    const room = await this.roomRepo.findById(id);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Validate status transitions
    this.validateStatusTransition(room.status, input.status);

    const lastCleanedAt = ['VACANT_CLEAN', 'OCCUPIED_CLEAN'].includes(input.status)
      ? new Date()
      : undefined;

    const updated = await this.roomRepo.updateStatus(
      id,
      input.status,
      input.priority,
      lastCleanedAt
    );

    // Create audit log entry
    // await auditService.logRoomStatusChange(...)

    logger.info(`Room status changed: ${room.roomNumber} ${room.status} -> ${input.status}`, {
      roomId: id,
      previousStatus: room.status,
      newStatus: input.status,
    });

    const withType = await this.roomRepo.findById(id, { roomType: true });
    const statusRoomTypeInfo = this.extractRoomTypeInfo(withType);
    return this.mapToResponse(updated, statusRoomTypeInfo);
  }

  async setOutOfOrder(
    id: string,
    organizationId: string,
    input: SetOutOfOrderInput,
    _setBy?: string
  ): Promise<RoomResponse> {
    const room = await this.roomRepo.findById(id);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Check for current guest
    const currentReservation = await this.roomRepo.getCurrentReservation(id);
    if (currentReservation) {
      throw new BadRequestError(
        'Cannot set room out of order while occupied. Please check out guest first.'
      );
    }

    // Check for imminent arrivals
    const nextReservation = await this.roomRepo.getNextReservation(id, new Date());
    if (nextReservation) {
      const checkInDate = nextReservation.reservation['checkInDate'];
      if (checkInDate instanceof Date) {
        const hoursUntilArrival = (checkInDate.getTime() - Date.now()) / (1000 * 60 * 60);

        if (hoursUntilArrival < 24) {
          throw new BadRequestError(
            `Cannot set room out of order: reservation arriving in ${Math.round(hoursUntilArrival)} hours`
          );
        }
      }
    }

    const maintenanceStatus = input.maintenanceRequired ? 'SCHEDULED' : 'NONE';

    const updated = await this.roomRepo.setOutOfOrder(
      id,
      input.reason,
      input.from,
      input.until,
      maintenanceStatus
    );

    // Create maintenance request if needed
    if (input.maintenanceRequired) {
      // await maintenanceService.createFromOOO(...)
    }

    logger.warn(`Room set OOO: ${room.roomNumber}`, {
      roomId: id,
      reason: input.reason,
      from: input.from,
      until: input.until,
    });

    const withType = await this.roomRepo.findById(id, { roomType: true });
    const oooRoomTypeInfo = this.extractRoomTypeInfo(withType);
    return this.mapToResponse(updated, oooRoomTypeInfo);
  }

  async removeOutOfOrder(
    id: string,
    organizationId: string,
    reason?: string,
    _removedBy?: string
  ): Promise<RoomResponse> {
    const room = await this.roomRepo.findById(id);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (!room.isOutOfOrder) {
      throw new BadRequestError('Room is not out of order');
    }

    // Determine appropriate status based on cleaning needs
    const newStatus: RoomStatus = 'VACANT_DIRTY'; // Assume needs inspection/cleaning

    const updated = await this.roomRepo.removeOutOfOrder(id, newStatus);

    logger.info(`Room OOO removed: ${room.roomNumber}`, { roomId: id, reason });

    const withType = await this.roomRepo.findById(id, { roomType: true });
    const removeOooTypeInfo = this.extractRoomTypeInfo(withType);
    return this.mapToResponse(updated, removeOooTypeInfo);
  }

  async bulkUpdateStatus(
    organizationId: string,
    hotelId: string,
    input: BulkStatusUpdateInput,
    _updatedBy?: string
  ): Promise<{ updatedCount: number }> {
    await this.verifyHotelAccess(organizationId, hotelId);

    // Verify all rooms exist in this hotel with a single query
    const updatedCount = await this.roomRepo.bulkUpdateStatus(input.roomIds, input.status, hotelId);

    if (updatedCount !== input.roomIds.length) {
      throw new NotFoundError('One or more rooms not found in hotel');
    }

    logger.info(`Bulk room status update: ${updatedCount} rooms to ${input.status}`, {
      hotelId,
      roomCount: input.roomIds.length,
    });

    return { updatedCount };
  }

  // ============================================================================
  // AVAILABILITY & ASSIGNMENT
  // ============================================================================

  async checkAvailability(
    roomId: string,
    organizationId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string
  ): Promise<{ available: boolean; conflicts: RoomConflict[] }> {
    const room = await this.roomRepo.findById(roomId);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${roomId}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (room.isOutOfOrder) {
      return {
        available: false,
        conflicts: [
          {
            reservationId: null,
            guestName: 'OUT_OF_ORDER',
            checkIn: room.oooFrom ?? new Date(),
            checkOut: room.oooUntil ?? new Date(),
          },
        ],
      };
    }

    return this.roomRepo.checkAvailability(roomId, checkIn, checkOut, excludeReservationId);
  }

  async findAvailable(
    hotelId: string,
    organizationId: string,
    checkIn: Date,
    checkOut: Date,
    roomTypeId?: string,
    limit: number = 10
  ): Promise<AvailableRoomItem[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const rooms = await this.roomRepo.findAvailableRooms(
      hotelId,
      checkIn,
      checkOut,
      roomTypeId,
      limit
    );

    return rooms.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      floor: r.floor,
      roomType: this.extractRoomTypeInfo(r),
      features: {
        isSmoking: r.isSmoking,
        isAccessible: r.isAccessible,
        viewType: r.viewType,
      },
    }));
  }

  // ============================================================================
  // HISTORY
  // ============================================================================

  async getHistory(
    roomId: string,
    organizationId: string,
    limit: number = 50
  ): Promise<RoomHistoryEntry[]> {
    const room = await this.roomRepo.findById(roomId);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${roomId}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const history = await this.roomRepo.getStatusHistory(roomId, limit);

    return history.map((h: RoomStatusHistoryEntry) => {
      const changes = h.changes as Record<string, Record<string, unknown>> | null;
      const metadata = h.metadata as Record<string, unknown> | null;
      const previousStatus = changes?.['before']?.['status'] as RoomStatus | undefined;
      const newStatus = changes?.['after']?.['status'] as RoomStatus | undefined;
      const notes = metadata?.['notes'] as string | undefined;
      return {
        id: h.id,
        timestamp: h.timestamp,
        action: h.action,
        ...(previousStatus ? { previousStatus } : {}),
        ...(newStatus ? { newStatus } : {}),
        userId: h.userId ?? 'system',
        userName: h.user ? `${h.user.firstName} ${h.user.lastName}` : 'System',
        ...(notes ? { notes } : {}),
      };
    });
  }

  async getMaintenanceHistory(
    roomId: string,
    organizationId: string
  ): Promise<RoomMaintenanceRecord[]> {
    const room = await this.roomRepo.findById(roomId);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${roomId}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return this.roomRepo.getMaintenanceHistory(roomId);
  }

  // ============================================================================
  // HOUSEKEEPING
  // ============================================================================

  async getCleaningTasks(
    hotelId: string,
    organizationId: string,
    status?: string
  ): Promise<CleaningTaskItem[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const rooms = await this.roomRepo.getCleaningTasks(hotelId, status);

    return rooms.map((r) => {
      const roomData = r as Room & {
        roomType: { code: string; name: string; defaultCleaningTime: number };
        hkTasks: unknown[];
      };
      return {
        id: roomData.id,
        roomNumber: roomData.roomNumber,
        floor: roomData.floor,
        status: roomData.status,
        roomType: roomData.roomType,
        cleaningPriority: roomData.cleaningPriority,
        estimatedMinutes: roomData.roomType.defaultCleaningTime,
        currentTask: roomData.hkTasks[0] ?? null,
      };
    });
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  async delete(id: string, organizationId: string, deletedBy?: string): Promise<void> {
    const room = await this.roomRepo.findById(id);

    if (!room || room.deletedAt) {
      throw new NotFoundError(`Room '${id}' not found`);
    }

    if (room.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Check for active or future reservations
    const currentReservation = await this.roomRepo.getCurrentReservation(id);
    if (currentReservation) {
      throw new BadRequestError('Cannot delete room with current guest');
    }

    const nextReservation = await this.roomRepo.getNextReservation(id);
    if (nextReservation) {
      throw new BadRequestError(
        'Cannot delete room with future reservations. Please reassign or cancel first.'
      );
    }

    await this.roomRepo.softDelete(id);

    // Update hotel room count
    await this.hotelRepo.updateRoomCount(room.hotelId);

    logger.warn(`Room deleted: ${room.roomNumber}`, {
      roomId: id,
      deletedBy,
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel '${hotelId}' not found`);
    }
  }

  private async checkOrgLimits(
    _organizationId: string,
    _proposedCount: number
  ): Promise<{ valid: boolean; message?: string }> {
    const rawMax = process.env['ORG_MAX_ROOMS'] ?? process.env['ORGANIZATION_MAX_ROOMS'];
    const maxRooms = rawMax ? Number(rawMax) : undefined;

    if (!maxRooms || !Number.isFinite(maxRooms) || maxRooms <= 0) {
      return { valid: true };
    }

    if (_proposedCount > maxRooms) {
      return {
        valid: false,
        message: `Organization has reached the maximum allowed number of rooms (${maxRooms}).`,
      };
    }

    return { valid: true };
  }

  private validateStatusTransition(current: string, next: string): void {
    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
      VACANT_CLEAN: ['VACANT_DIRTY', 'OCCUPIED_CLEAN', 'RESERVED', 'BLOCKED', 'OUT_OF_ORDER'],
      VACANT_DIRTY: ['VACANT_CLEANING', 'VACANT_CLEAN', 'BLOCKED', 'OUT_OF_ORDER'],
      VACANT_CLEANING: ['VACANT_CLEAN', 'VACANT_DIRTY'],
      OCCUPIED_CLEAN: ['OCCUPIED_DIRTY', 'VACANT_DIRTY', 'OCCUPIED_CLEANING'],
      OCCUPIED_DIRTY: ['OCCUPIED_CLEANING', 'OCCUPIED_CLEAN'],
      OCCUPIED_CLEANING: ['OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'],
      RESERVED: ['OCCUPIED_CLEAN', 'VACANT_CLEAN', 'BLOCKED'],
      BLOCKED: ['VACANT_CLEAN', 'VACANT_DIRTY'],
      OUT_OF_ORDER: ['VACANT_DIRTY'], // Must go through cleaning/inspection
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestError(`Invalid status transition: ${current} -> ${next}`);
    }
  }

  private extractRoomTypeInfo(room: Room | null): RoomTypeInfo {
    if (!room) {
      return { id: '', code: 'UNKNOWN', name: 'Unknown', baseOccupancy: 2, maxOccupancy: 2 };
    }
    const roomWithType = room as unknown as RoomWithType;
    return (
      roomWithType.roomType ?? {
        id: room.roomTypeId,
        code: 'UNKNOWN',
        name: 'Unknown',
        baseOccupancy: 2,
        maxOccupancy: 2,
      }
    );
  }

  private mapToResponse(
    room: Room,
    roomType?: RoomTypeInfo,
    currentReservation?: RoomReservationDetail,
    nextReservation?: RoomReservationDetail
  ): RoomResponse {
    return {
      id: room.id,
      organizationId: room.organizationId,
      hotelId: room.hotelId,

      identification: {
        roomNumber: room.roomNumber,
        floor: room.floor,
        building: room.building,
        wing: room.wing,
        fullLocation: [
          room.building,
          room.wing ? `Wing ${room.wing}` : null,
          room.floor !== null ? `Floor ${room.floor}` : null,
          `Room ${room.roomNumber}`,
        ]
          .filter(Boolean)
          .join(', '),
      },

      type: roomType
        ? {
            id: roomType.id,
            code: roomType.code,
            name: roomType.name,
            baseOccupancy: roomType.baseOccupancy,
            maxOccupancy: roomType.maxOccupancy,
          }
        : {
            id: room.roomTypeId,
            code: 'UNKNOWN',
            name: 'Unknown',
            baseOccupancy: 2,
            maxOccupancy: 2,
          },

      status: {
        current: room.status,
        isOutOfOrder: room.isOutOfOrder,
        oooDetails: room.isOutOfOrder
          ? {
              reason: room.oooReason,
              from: room.oooFrom,
              until: room.oooUntil,
            }
          : null,
        lastCleanedAt: room.lastCleanedAt,
        cleaningPriority: room.cleaningPriority,
        maintenanceStatus: room.maintenanceStatus,
      },

      features: {
        isSmoking: room.isSmoking,
        isAccessible: room.isAccessible,
        viewType: room.viewType,
      },

      financial: {
        rackRate: room.rackRate,
      },

      currentReservation: currentReservation
        ? {
            id: currentReservation.reservationId,
            guestName: `${currentReservation.reservation.guest.firstName} ${currentReservation.reservation.guest.lastName}`,
            checkIn: currentReservation.checkInAt ?? new Date(),
            checkOut: (currentReservation.reservation['checkOutDate'] as Date) ?? new Date(),
            nights: Math.ceil(
              (((currentReservation.reservation['checkOutDate'] as Date) ?? new Date()).getTime() -
                (currentReservation.checkInAt ?? new Date()).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          }
        : null,

      nextReservation: nextReservation
        ? {
            id: nextReservation.reservationId,
            guestName: `${nextReservation.reservation.guest.firstName} ${nextReservation.reservation.guest.lastName}`,
            checkIn: (nextReservation.reservation['checkInDate'] as Date) ?? new Date(),
            nights: (nextReservation.reservation['nights'] as number) ?? 1,
          }
        : null,

      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}

export const roomsService = new RoomsService();
