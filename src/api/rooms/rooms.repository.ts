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
  async findById(id: string, include?: Prisma.RoomInclude): Promise<Room | null> {
    return prisma.room.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    }) as Promise<Room | null>;
  }

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

  async create(data: RoomCreateInput): Promise<Room> {
    return prisma.room.create({
      data,
    }) as Promise<Room>;
  }

  async update(id: string, data: RoomUpdateInput): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data,
    }) as Promise<Room>;
  }

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

  async bulkUpdateStatus(roomIds: string[], status: RoomStatus): Promise<number> {
    const result = await prisma.room.updateMany({
      where: { id: { in: roomIds } },
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
        SELECT check_in_date 
        FROM reservations 
        WHERE hotel_id = ${hotelId}::uuid
          AND status IN ('CONFIRMED', 'CHECKED_IN')
          AND check_in_date > CURRENT_DATE
        ORDER BY check_in_date
        LIMIT 1
      ) next_res ON true
      WHERE r.hotel_id = ${hotelId}::uuid
        AND r.deleted_at IS NULL
      ORDER BY r.floor, r.room_number
    `;
  }

  // ============================================================================
  // AVAILABILITY & ASSIGNMENT
  // ============================================================================

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

  async countByHotel(hotelId: string): Promise<number> {
    return prisma.room.count({
      where: {
        hotelId,
        deletedAt: null,
      },
    });
  }

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
