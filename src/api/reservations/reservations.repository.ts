import { prisma } from '../../database/prisma';
import type { $Enums, Prisma } from '../../generated/prisma';
import type { Reservation, ReservationStatus } from './reservations.types';

export type ReservationWhereInput = Prisma.ReservationWhereInput;
export type ReservationCreateInput = Prisma.ReservationCreateInput;
export type ReservationUpdateInput = Prisma.ReservationUpdateInput;

export class ReservationsRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async findById(id: string, include?: Prisma.ReservationInclude): Promise<Reservation | null> {
    return prisma.reservation.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            roomType: true,
            room: true,
          },
        },
        guest: true,
        ratePlan: true,
        ...include,
      },
    }) as Promise<Reservation | null>;
  }

  async findByExternalRef(externalRef: string, hotelId: string): Promise<Reservation | null> {
    return prisma.reservation.findFirst({
      where: {
        externalRef,
        hotelId,
        deletedAt: null,
      },
      include: {
        rooms: {
          include: {
            roomType: true,
            room: true,
          },
        },
        guest: true,
      },
    }) as Promise<Reservation | null>;
  }

  async search(
    hotelId: string,
    filters: {
      status?: ReservationStatus;
      checkInFrom?: Date;
      checkInTo?: Date;
      checkOutFrom?: Date;
      checkOutTo?: Date;
      guestName?: string;
      confirmationNumber?: string;
      roomNumber?: string;
      bookingSource?: string;
      createdFrom?: Date;
      createdTo?: Date;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ reservations: Reservation[]; total: number }> {
    const where: Prisma.ReservationWhereInput = {
      hotelId,
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.checkInFrom || filters.checkInTo) {
      where.checkInDate = {};
      if (filters.checkInFrom) where.checkInDate.gte = filters.checkInFrom;
      if (filters.checkInTo) where.checkInDate.lte = filters.checkInTo;
    }

    if (filters.checkOutFrom || filters.checkOutTo) {
      where.checkOutDate = {};
      if (filters.checkOutFrom) where.checkOutDate.gte = filters.checkOutFrom;
      if (filters.checkOutTo) where.checkOutDate.lte = filters.checkOutTo;
    }

    if (filters.guestName) {
      where.guest = {
        OR: [
          { firstName: { contains: filters.guestName, mode: 'insensitive' } },
          { lastName: { contains: filters.guestName, mode: 'insensitive' } },
        ],
      };
    }

    if (filters.confirmationNumber) {
      where.confirmationNumber = {
        contains: filters.confirmationNumber.toUpperCase(),
      };
    }

    if (filters.bookingSource) {
      where.source = filters.bookingSource as $Enums.BookingSource;
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              vipStatus: true,
            },
          },
          rooms: {
            include: {
              roomType: {
                select: {
                  code: true,
                  name: true,
                },
              },
              room: {
                select: {
                  roomNumber: true,
                },
              },
            },
          },
        },
        ...(pagination
          ? { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }
          : {}),
        orderBy: { checkInDate: 'asc' as const },
      }),
      prisma.reservation.count({ where }),
    ]);

    return { reservations: reservations as unknown as Reservation[], total };
  }

  async create(
    data: ReservationCreateInput,
    roomData: Prisma.ReservationRoomUncheckedCreateWithoutReservationInput
  ): Promise<Reservation> {
    return prisma.$transaction(async (tx) => {
      // Create reservation
      const reservation = await tx.reservation.create({
        data,
      });

      // Create reservation room
      await tx.reservationRoom.create({
        data: {
          ...roomData,
          reservationId: reservation.id,
        },
      });

      return tx.reservation.findUnique({
        where: { id: reservation.id },
        include: {
          rooms: {
            include: {
              roomType: true,
              room: true,
            },
          },
          guest: true,
        },
      }) as unknown as Promise<Reservation>;
    });
  }

  async update(id: string, data: ReservationUpdateInput): Promise<Reservation> {
    return prisma.reservation.update({
      where: { id },
      data: {
        ...data,
        modifiedAt: new Date(),
      },
      include: {
        rooms: {
          include: {
            roomType: true,
            room: true,
          },
        },
        guest: true,
      },
    }) as unknown as Promise<Reservation>;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.reservation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'CANCELLED',
      },
    });
  }

  // ============================================================================
  // STATUS MANAGEMENT
  // ============================================================================

  async updateStatus(id: string, status: ReservationStatus): Promise<void> {
    await prisma.reservation.update({
      where: { id },
      data: { status },
    });
  }

  async checkIn(
    reservationId: string,
    reservationRoomId: string,
    roomId: string,
    earlyCheckIn: boolean = false
  ): Promise<void> {
    const now = new Date();

    await prisma.$transaction([
      // Update reservation
      prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CHECKED_IN',
          checkInStatus: earlyCheckIn ? 'EARLY_CHECK_IN' : 'CHECKED_IN',
          modifiedAt: now,
        },
      }),

      // Update reservation room
      prisma.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          roomId,
          status: 'OCCUPIED',
          assignedAt: now,
          checkInAt: now,
        },
      }),

      // Update room status
      prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'OCCUPIED_CLEAN',
        },
      }),
    ]);
  }

  async checkOut(
    reservationId: string,
    reservationRoomId: string,
    roomId: string,
    lateCheckOut: boolean = false
  ): Promise<void> {
    const now = new Date();

    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CHECKED_OUT',
          checkInStatus: lateCheckOut ? 'LATE_CHECK_OUT' : 'CHECKED_OUT',
          modifiedAt: now,
        },
      }),

      prisma.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          status: 'CHECKED_OUT',
          checkOutAt: now,
        },
      }),

      prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'VACANT_DIRTY',
        },
      }),
    ]);
  }

  async cancel(id: string, reason: string, cancelledBy: string, fee?: number): Promise<void> {
    await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason,
        cancellationFee: fee || null,
        modifiedAt: new Date(),
      },
    });
  }

  async markNoShow(id: string, chargeFee: boolean): Promise<void> {
    await prisma.reservation.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        noShow: true,
        ...(chargeFee ? {} : { cancellationFee: null }),
        modifiedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // ROOM ASSIGNMENT
  // ============================================================================

  async assignRoom(reservationRoomId: string, roomId: string, assignedBy: string): Promise<void> {
    await prisma.reservationRoom.update({
      where: { id: reservationRoomId },
      data: {
        roomId,
        assignedAt: new Date(),
        assignedBy,
        status: 'ASSIGNED',
      },
    });
  }

  async unassignRoom(reservationRoomId: string): Promise<void> {
    await prisma.reservationRoom.update({
      where: { id: reservationRoomId },
      data: {
        roomId: null,
        assignedAt: null,
        assignedBy: null,
        status: 'RESERVED',
      },
    });
  }

  async autoAssignRoom(reservationId: string, roomTypeId: string): Promise<string | null> {
    // Find best available room
    const availableRoom = await prisma.room.findFirst({
      where: {
        roomTypeId,
        status: { in: ['VACANT_CLEAN', 'VACANT_DIRTY'] },
        isOutOfOrder: false,
        deletedAt: null,
      },
      orderBy: [
        { status: 'asc' }, // VACANT_CLEAN first
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
    });

    if (!availableRoom) return null;

    // Get reservation room ID
    const resRoom = await prisma.reservationRoom.findFirst({
      where: { reservationId },
    });

    if (!resRoom) return null;

    await this.assignRoom(resRoom.id, availableRoom.id, 'SYSTEM_AUTO');

    return availableRoom.id;
  }

  // ============================================================================
  // AVAILABILITY CHECKS
  // ============================================================================

  async checkAvailability(
    hotelId: string,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<{ available: boolean; roomsAvailable: number }> {
    const totalRooms = await prisma.room.count({
      where: {
        hotelId,
        roomTypeId,
        deletedAt: null,
        isOutOfOrder: false,
      },
    });

    // Count overlapping reservations
    const occupied = await prisma.reservationRoom.count({
      where: {
        roomTypeId,
        reservation: {
          hotelId,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
        },
      },
    });

    // Check inventory overrides
    const inventory = await prisma.roomInventory.findMany({
      where: {
        roomTypeId,
        date: {
          gte: checkIn,
          lt: checkOut,
        },
      },
    });

    const inventoryBlocked = inventory.some((inv) => inv.stopSell);
    const minAvailability =
      inventory.length > 0
        ? Math.min(...inventory.map((inv) => inv.available))
        : totalRooms - occupied;

    return {
      available: !inventoryBlocked && minAvailability > 0,
      roomsAvailable: Math.max(0, minAvailability),
    };
  }

  // ============================================================================
  // DASHBOARD QUERIES
  // ============================================================================

  async getTodayArrivals(hotelId: string, date: Date): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: {
        hotelId,
        checkInDate: date,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        deletedAt: null,
      },
      include: {
        guest: {
          select: {
            firstName: true,
            lastName: true,
            vipStatus: true,
          },
        },
        rooms: {
          include: {
            room: true,
            roomType: true,
          },
        },
      },
      orderBy: { arrivalTime: 'asc' },
    }) as unknown as Promise<Reservation[]>;
  }

  async getTodayDepartures(hotelId: string, date: Date): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: {
        hotelId,
        checkOutDate: date,
        status: 'CHECKED_IN',
        deletedAt: null,
      },
      include: {
        guest: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        rooms: {
          include: {
            room: true,
          },
        },
      },
      orderBy: { departureTime: 'asc' },
    }) as unknown as Promise<Reservation[]>;
  }

  async getInHouseGuests(hotelId: string): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        deletedAt: null,
      },
      include: {
        guest: {
          select: {
            firstName: true,
            lastName: true,
            vipStatus: true,
          },
        },
        rooms: {
          include: {
            room: true,
            roomType: true,
          },
        },
      },
      orderBy: { checkInDate: 'desc' },
    }) as unknown as Promise<Reservation[]>;
  }

  // ============================================================================
  // CONFIRMATION NUMBER GENERATION
  // ============================================================================

  async generateConfirmationNumber(hotelId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Get count for today to ensure uniqueness
    const count = await prisma.reservation.count({
      where: {
        hotelId,
        bookedAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
        },
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `${year}${month}${sequence}`;
  }

  // ============================================================================
  // SPLIT/MERGE
  // ============================================================================

  async splitReservation(
    reservationId: string,
    splitDate: Date,
    newReservationData: Prisma.ReservationUncheckedCreateInput
  ): Promise<{ original: Reservation; new: Reservation }> {
    return prisma.$transaction(async (tx) => {
      const original = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { rooms: true },
      });

      if (!original) throw new Error('Reservation not found');

      // Update original to end at split date
      const updatedOriginal = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          checkOutDate: splitDate,
          nights: Math.ceil(
            (splitDate.getTime() - original.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
          modifiedAt: new Date(),
        },
      });

      // Create new reservation from split date
      const newReservation = await tx.reservation.create({
        data: {
          ...newReservationData,
          checkInDate: splitDate,
          checkOutDate: original.checkOutDate,
          nights: Math.ceil(
            (original.checkOutDate.getTime() - splitDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
      });

      return {
        original: updatedOriginal as unknown as Reservation,
        new: newReservation as unknown as Reservation,
      };
    });
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  async hasActiveReservation(roomId: string, excludeReservationId?: string): Promise<boolean> {
    const count = await prisma.reservationRoom.count({
      where: {
        roomId,
        status: { in: ['ASSIGNED', 'OCCUPIED'] },
        reservation: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          ...(excludeReservationId && { id: { not: excludeReservationId } }),
        },
      },
    });
    return count > 0;
  }
}

export const reservationRepository = new ReservationsRepository();
