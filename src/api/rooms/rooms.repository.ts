import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  MaintenanceStatus,
  Room,
  RoomConflict,
  RoomGridRow,
  RoomMaintenanceRecord,
  RoomReservationDetail,
  RoomStatus,
  RoomStatusHistoryEntry,
} from './rooms.types';

export type RoomWhereInput = Prisma.RoomWhereInput;
export type RoomCreateInput = Prisma.RoomUncheckedCreateInput;
export type RoomUpdateInput = Prisma.RoomUpdateInput;

export class RoomsRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================
  /**
   * Retrieves a room by its UUID and optionally expands related entities.
   *
   * @param id - Room UUID.
   * @param include - Optional Prisma include graph for related records.
   * @returns The room when found; otherwise `null`.
   */
  async findById(id: string, include?: Prisma.RoomInclude): Promise<Room | null> {
    return prisma.room.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    }) as Promise<Room | null>;
  }

  /**
   * Retrieves a room by hotel and room number using the canonical uppercase key.
   *
   * @param hotelId - Hotel UUID that scopes the uniqueness check.
   * @param roomNumber - Human-facing room number; normalized to uppercase before lookup.
   * @returns The matching room or `null` when no room exists for that key.
   */
  async findByRoomNumber(hotelId: string, roomNumber: string): Promise<Room | null> {
    return prisma.room.findUnique({
      where: {
        uq_room_hotel_number: {
          hotelId,
          roomNumber: roomNumber.toUpperCase(),
        },
      },
    }) as Promise<Room | null>;
  }

  /**
   * Lists rooms for a hotel with optional operational filters and pagination metadata.
   *
   * Builds a dynamic `where` clause from status, location, room type, and free-text inputs,
   * then executes `findMany` and `count` concurrently so list data and totals stay aligned.
   * Search terms match room number, building, and wing case-insensitively.
   *
   * @param hotelId - Hotel UUID that scopes the query.
   * @param filters - Optional room-state and location filters.
   * @param pagination - Optional pagination configuration (`page`, `limit`).
   * @returns Filtered room rows and the total number of matching records.
   * @remarks Complexity: O(R) for result processing plus two DB queries (`findMany` + `count`).
   */
  async findByHotel(
    hotelId: string,
    filters?: {
      status?: RoomStatus;
      roomTypeId?: string;
      floor?: number;
      building?: string;
      isOutOfOrder?: boolean;
      viewType?: string;
      search?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ rooms: Room[]; total: number }> {
    const where: Prisma.RoomWhereInput = {
      hotelId,
      deletedAt: null,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.roomTypeId) {
      where.roomTypeId = filters.roomTypeId;
    }

    if (filters?.floor !== undefined) {
      where.floor = filters.floor;
    }

    if (filters?.building) {
      where.building = { equals: filters.building, mode: 'insensitive' };
    }

    if (filters?.isOutOfOrder !== undefined) {
      where.isOutOfOrder = filters.isOutOfOrder;
    }

    if (filters?.viewType) {
      where.viewType = filters.viewType;
    }

    if (filters?.search) {
      where.OR = [
        { roomNumber: { contains: filters.search, mode: 'insensitive' } },
        { building: { contains: filters.search, mode: 'insensitive' } },
        { wing: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          roomType: {
            select: {
              id: true,
              code: true,
              name: true,
              baseOccupancy: true,
              maxOccupancy: true,
            },
          },
        },
        ...(pagination
          ? { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }
          : {}),
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      }),
      prisma.room.count({ where }),
    ]);

    return { rooms: rooms as Room[], total };
  }

  /**
   * Creates a room row with the provided persistence payload.
   *
   * @param data - Prisma unchecked create input for the room.
   * @returns The created room record.
   */
  async create(data: RoomCreateInput): Promise<Room> {
    return prisma.room.create({
      data,
    }) as Promise<Room>;
  }

  /**
   * Updates a room by UUID using partial room fields.
   *
   * @param id - Room UUID.
   * @param data - Prisma update payload containing changed columns.
   * @returns The updated room record.
   */
  async update(id: string, data: RoomUpdateInput): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data,
    }) as Promise<Room>;
  }

  /**
   * Soft-deletes a room and marks it unavailable for assignment.
   *
   * @param id - Room UUID.
   * @returns Resolves when the soft-delete update is persisted.
   */
  async softDelete(id: string): Promise<void> {
    await prisma.room.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'OUT_OF_ORDER',
        isOutOfOrder: true,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // STATUS MANAGEMENT
  // ============================================================================

  /**
   * Updates room status and housekeeping metadata in one write operation.
   *
   * When the next status is not an out-of-order state, this method clears out-of-order
   * flags and time windows to keep operational flags consistent with occupancy status.
   *
   * @param id - Room UUID.
   * @param status - Target room status literal.
   * @param cleaningPriority - Optional housekeeping priority override.
   * @param lastCleanedAt - Optional timestamp for latest cleaning completion.
   * @returns The updated room record.
   */
  async updateStatus(
    id: string,
    status: RoomStatus,
    cleaningPriority?: number,
    lastCleanedAt?: Date
  ): Promise<Room> {
    const updateData: RoomUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    if (cleaningPriority !== undefined) {
      updateData.cleaningPriority = cleaningPriority;
    }

    if (lastCleanedAt) {
      updateData.lastCleanedAt = lastCleanedAt;
    }

    // Auto-clear OOO if moving to non-OOO status
    if (!status.startsWith('OUT_OF_ORDER') && status !== 'BLOCKED') {
      updateData.isOutOfOrder = false;
      updateData.oooReason = null;
      updateData.oooFrom = null;
      updateData.oooUntil = null;
    }

    return prisma.room.update({
      where: { id },
      data: updateData,
    }) as Promise<Room>;
  }

  /**
   * Marks a room as out of order for a defined maintenance window.
   *
   * @param id - Room UUID.
   * @param reason - Human-readable reason shown to operations teams.
   * @param from - Start timestamp for the out-of-order window.
   * @param until - End timestamp for the out-of-order window.
   * @param maintenanceStatus - Optional maintenance workflow status override.
   * @returns The updated room record in `OUT_OF_ORDER` state.
   */
  async setOutOfOrder(
    id: string,
    reason: string,
    from: Date,
    until: Date,
    maintenanceStatus?: MaintenanceStatus
  ): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data: {
        status: 'OUT_OF_ORDER',
        isOutOfOrder: true,
        oooFrom: from,
        oooReason: reason,
        oooUntil: until,
        maintenanceStatus: maintenanceStatus || 'SCHEDULED',
        updatedAt: new Date(),
      },
    }) as Promise<Room>;
  }

  /**
   * Clears out-of-order flags and restores a new operational status.
   *
   * @param id - Room UUID.
   * @param newStatus - Post-recovery status, defaulting to `VACANT_DIRTY`.
   * @returns The updated room record.
   */
  async removeOutOfOrder(id: string, newStatus: RoomStatus = 'VACANT_DIRTY'): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data: {
        status: newStatus,
        isOutOfOrder: false,
        oooFrom: null,
        oooReason: null,
        oooUntil: null,
        updatedAt: new Date(),
      },
    }) as Promise<Room>;
  }

  /**
   * Applies the same status to multiple rooms, optionally constrained to one hotel.
   *
   * @param roomIds - Room UUIDs to update.
   * @param status - Target room status literal.
   * @param hotelId - Optional hotel UUID guard for multi-tenant safety.
   * @returns Number of rows updated.
   */
  async bulkUpdateStatus(roomIds: string[], status: RoomStatus, hotelId?: string): Promise<number> {
    const result = await prisma.room.updateMany({
      where: { id: { in: roomIds }, ...(hotelId ? { hotelId, deletedAt: null } : {}) },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  // ============================================================================
  // GRID / FLOOR PLAN
  // ============================================================================
  /**
   * Returns floor-plan rows enriched with current guest and next-arrival context.
   *
   * Uses a raw SQL query with joins against room type and reservation tables plus a
   * lateral subquery to compute the next future arrival date per room.
   *
   * @param hotelId - Hotel UUID whose room grid should be generated.
   * @returns Flattened grid rows ordered by floor and room number.
   * @remarks Complexity: O(R + J) in DB execution, where `R` is rooms in hotel and `J` reflects joined reservation rows.
   */
  async getGridByHotel(hotelId: string): Promise<RoomGridRow[]> {
    return prisma.$queryRaw`
      SELECT 
        r.floor,
        r.id,
        r.room_number as "roomNumber",
        r.status,
        r.is_out_of_order as "isOutOfOrder",
        r.cleaning_priority as "cleaningPriority",
        rt.code as "roomTypeCode",
        rt.name as "roomTypeName",
        res.id as "currentReservationId",
        res_g.first_name || ' ' || res_g.last_name as "currentGuest",
        next_res.check_in_date as "nextArrival"
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN reservation_rooms rr ON rr.room_id = r.id 
        AND rr.status IN ('ASSIGNED', 'OCCUPIED')
        AND rr.check_in_at IS NOT NULL
        AND rr.check_out_at IS NULL
      LEFT JOIN reservations res ON res.id = rr.reservation_id 
        AND res.status = 'CHECKED_IN'
      LEFT JOIN guests res_g ON res.guest_id = res_g.id
      LEFT JOIN LATERAL (
        SELECT 
          MIN(res_next.check_in_date) AS check_in_date
        FROM reservations res_next
        JOIN reservation_rooms rr_next ON rr_next.reservation_id = res_next.id
        WHERE rr_next.room_id = r.id
          AND res_next.hotel_id = ${hotelId}::uuid
          AND res_next.status IN ('CONFIRMED', 'CHECKED_IN')
          AND rr_next.status IN ('ASSIGNED', 'OCCUPIED')
          AND res_next.check_in_date > CURRENT_DATE
      ) next_res ON true
      WHERE r.hotel_id = ${hotelId}::uuid
        AND r.deleted_at IS NULL
      ORDER BY r.floor, r.room_number
    `;
  }

  // ============================================================================
  // AVAILABILITY & ASSIGNMENT
  // ============================================================================

  /**
   * Checks whether a room is free for a date range and returns overlapping stays.
   *
   * Conflicts are detected with overlap logic (`existing.checkIn < checkOut` and
   * `existing.checkOut > checkIn`) against reservations in `CONFIRMED` or `CHECKED_IN`
   * status while considering only assigned/occupied reservation-room links.
   *
   * @param roomId - Room UUID to inspect.
   * @param checkIn - Requested arrival timestamp.
   * @param checkOut - Requested departure timestamp.
   * @param excludeReservationId - Optional reservation UUID to exclude during reassignment flows.
   * @returns Availability flag and normalized conflict details.
   * @remarks Complexity: O(C) where `C` is the number of conflicting reservation-room rows returned by the DB.
   */
  async checkAvailability(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string
  ): Promise<{ available: boolean; conflicts: RoomConflict[] }> {
    const conflicts = await prisma.reservationRoom.findMany({
      where: {
        roomId,
        status: { in: ['ASSIGNED', 'OCCUPIED'] },
        reservation: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          ...(excludeReservationId && { id: { not: excludeReservationId } }),
          AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
        },
      },
      include: {
        reservation: {
          include: {
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map((c) => ({
        reservationId: c.reservationId,
        guestName: `${c.reservation.guest.firstName} ${c.reservation.guest.lastName}`,
        checkIn: c.reservation.checkInDate,
        checkOut: c.reservation.checkOutDate,
      })),
    };
  }

  /**
   * Finds sellable rooms for a stay window after excluding overlapping assignments.
   *
   * Starts from operationally available rooms (`VACANT_CLEAN`/`VACANT_DIRTY`, not out of
   * order), then removes room IDs returned by a raw SQL overlap query for active
   * reservations. This prevents double allocation during booking and assignment flows.
   *
   * @param hotelId - Hotel UUID used to scope inventory.
   * @param checkIn - Requested arrival timestamp.
   * @param checkOut - Requested departure timestamp.
   * @param roomTypeId - Optional room type UUID filter.
   * @param limit - Maximum number of rooms to return.
   * @returns Candidate rooms ordered by room number.
   * @remarks Complexity: O(O + R) where `O` is overlapping reservation rows and `R` is returned rooms.
   */
  async findAvailableRooms(
    hotelId: string,
    checkIn: Date,
    checkOut: Date,
    roomTypeId?: string,
    limit: number = 10
  ): Promise<Room[]> {
    const where: Prisma.RoomWhereInput = {
      hotelId,
      deletedAt: null,
      isOutOfOrder: false,
      status: { in: ['VACANT_CLEAN', 'VACANT_DIRTY'] },
    };

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    // Exclude rooms with conflicting reservations
    const occupiedRoomIds = await prisma.$queryRaw<{ room_id: string }[]>`
      SELECT DISTINCT rr.room_id
      FROM reservation_rooms rr
      JOIN reservations r ON r.id = rr.reservation_id
      WHERE r.hotel_id = ${hotelId}::uuid
        AND r.status IN ('CONFIRMED', 'CHECKED_IN')
        AND rr.room_id IS NOT NULL
        AND r.check_in_date < ${checkOut}::timestamp
        AND r.check_out_date > ${checkIn}::timestamp
    `;

    const excludedIds = occupiedRoomIds.map((r) => r.room_id);

    if (excludedIds.length > 0) {
      where.id = { notIn: excludedIds };
    }

    return prisma.room.findMany({
      where,
      include: {
        roomType: {
          select: {
            id: true,
            code: true,
            name: true,
            maxOccupancy: true,
          },
        },
      },
      take: limit,
      orderBy: { roomNumber: 'asc' },
    }) as Promise<Room[]>;
  }

  // ============================================================================
  // CURRENT / NEXT RESERVATION
  // ============================================================================

  /**
   * Gets the currently checked-in reservation details for a room.
   *
   * @param roomId - Room UUID.
   * @returns Active reservation-room detail or `null` when the room is not occupied.
   */
  async getCurrentReservation(roomId: string): Promise<RoomReservationDetail | null> {
    return prisma.reservationRoom.findFirst({
      where: {
        roomId,
        status: { in: ['ASSIGNED', 'OCCUPIED'] },
        checkInAt: { not: null },
        checkOutAt: null,
        reservation: {
          status: 'CHECKED_IN',
        },
      },
      include: {
        reservation: {
          include: {
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    }) as Promise<RoomReservationDetail | null>;
  }

  /**
   * Gets current checked-in reservation details for a batch of rooms.
   *
   * @param roomIds - Room UUIDs to inspect.
   * @returns Map keyed by room UUID for rooms that currently have a checked-in reservation.
   * @remarks Complexity: O(R) to build the map after one DB query, where `R` is result rows.
   */
  async getCurrentReservationsByRoomIds(
    roomIds: string[]
  ): Promise<Map<string, RoomReservationDetail>> {
    const records = (await prisma.reservationRoom.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: ['ASSIGNED', 'OCCUPIED'] },
        checkInAt: { not: null },
        checkOutAt: null,
        reservation: {
          status: 'CHECKED_IN',
        },
      },
      include: {
        reservation: {
          include: {
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })) as RoomReservationDetail[];

    const map = new Map<string, RoomReservationDetail>();
    for (const record of records) {
      if (record.roomId) {
        map.set(record.roomId, record);
      }
    }
    return map;
  }

  /**
   * Gets the next confirmed reservation for a room after a reference timestamp.
   *
   * @param roomId - Room UUID.
   * @param afterDate - Lower bound for reservation check-in date.
   * @returns Earliest upcoming reservation assignment or `null`.
   */
  async getNextReservation(
    roomId: string,
    afterDate: Date = new Date()
  ): Promise<RoomReservationDetail | null> {
    return prisma.reservationRoom.findFirst({
      where: {
        roomId,
        status: 'RESERVED',
        reservation: {
          status: 'CONFIRMED',
          checkInDate: { gt: afterDate },
        },
      },
      include: {
        reservation: {
          include: {
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        reservation: {
          checkInDate: 'asc',
        },
      },
    }) as Promise<RoomReservationDetail | null>;
  }

  // ============================================================================
  // HISTORY & AUDIT
  // ============================================================================

  /**
   * Retrieves recent room status-related audit entries.
   *
   * @param roomId - Room UUID.
   * @param limit - Maximum number of audit records to fetch.
   * @returns Status history entries ordered from newest to oldest.
   */
  async getStatusHistory(roomId: string, limit: number = 50): Promise<RoomStatusHistoryEntry[]> {
    // This would typically query a room_status_history table
    // For now, using audit logs as fallback
    return prisma.auditLog.findMany({
      where: {
        resourceType: 'ROOM',
        resourceId: roomId,
        action: { in: ['ROOM_STATUS_CHANGE', 'ROOM_OOO_SET', 'ROOM_OOO_REMOVE'] },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves maintenance requests associated with a room.
   *
   * @param roomId - Room UUID.
   * @returns Maintenance records ordered by report time descending.
   */
  async getMaintenanceHistory(roomId: string): Promise<RoomMaintenanceRecord[]> {
    return prisma.maintenanceRequest.findMany({
      where: {
        roomId,
      },
      orderBy: { reportedAt: 'desc' },
      select: {
        id: true,
        category: true,
        priority: true,
        title: true,
        status: true,
        reportedAt: true,
        completedAt: true,
      },
    });
  }

  // ============================================================================
  // HOUSEKEEPING INTEGRATION
  // ============================================================================

  /**
   * Lists rooms relevant to housekeeping workflows by operational state.
   *
   * @param hotelId - Hotel UUID.
   * @param status - Optional filter bucket (`dirty`, `cleaning`, or `priority`).
   * @returns Rooms with room type context and active housekeeping task preview.
   */
  async getCleaningTasks(hotelId: string, status?: string): Promise<Room[]> {
    const where: Prisma.RoomWhereInput = {
      hotelId,
      deletedAt: null,
    };

    if (status === 'dirty') {
      where.OR = [{ status: 'VACANT_DIRTY' }, { status: 'OCCUPIED_DIRTY' }];
    } else if (status === 'cleaning') {
      where.OR = [{ status: 'VACANT_CLEANING' }, { status: 'OCCUPIED_CLEANING' }];
    } else if (status === 'priority') {
      where.cleaningPriority = { gt: 0 };
    }

    return prisma.room.findMany({
      where,
      include: {
        roomType: {
          select: {
            code: true,
            name: true,
            defaultCleaningTime: true,
          },
        },
        hkTasks: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          orderBy: { scheduledFor: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ cleaningPriority: 'desc' }, { floor: 'asc' }, { roomNumber: 'asc' }],
    }) as Promise<Room[]>;
  }

  // ============================================================================
  // STATS
  // ============================================================================

  /**
   * Counts rooms by status for a hotel.
   *
   * @param hotelId - Hotel UUID.
   * @returns Object keyed by room status literal with count values.
   */
  async getStatusCounts(hotelId: string): Promise<Record<string, number>> {
    const results = await prisma.room.groupBy({
      by: ['status'],
      where: {
        hotelId,
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    });

    return results.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      {} as Record<string, number>
    );
  }
  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Checks whether a room exists in a hotel and is not soft-deleted.
   *
   * @param hotelId - Hotel UUID.
   * @param roomId - Room UUID.
   * @returns `true` when the room is present and active; otherwise `false`.
   */
  async existsInHotel(hotelId: string, roomId: string): Promise<boolean> {
    const count = await prisma.room.count({
      where: {
        id: roomId,
        hotelId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  /**
   * Counts active rooms for a hotel.
   *
   * @param hotelId - Hotel UUID.
   * @returns Number of non-deleted rooms in the hotel.
   */
  async countByHotel(hotelId: string): Promise<number> {
    return prisma.room.count({
      where: {
        hotelId,
        deletedAt: null,
      },
    });
  }

  /**
   * Counts active rooms for a room type.
   *
   * @param roomTypeId - Room type UUID.
   * @returns Number of non-deleted rooms linked to the room type.
   */
  async countByRoomType(roomTypeId: string): Promise<number> {
    return prisma.room.count({
      where: {
        roomTypeId,
        deletedAt: null,
      },
    });
  }
}

export const roomsRepository = new RoomsRepository();
