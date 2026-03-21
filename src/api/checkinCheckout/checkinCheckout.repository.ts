import { prisma } from '../../database/prisma';

export class CheckinCheckoutRepository {
  async findAvailableRooms(organizationId: string, hotelId: string, take: number = 30) {
    return prisma.room.findMany({
      where: {
        organizationId,
        hotelId,
        status: { in: ['VACANT_CLEAN', 'VACANT_DIRTY'] },
        deletedAt: null,
      },
      select: {
        id: true,
        roomNumber: true,
        floor: true,
        status: true,
        roomTypeId: true,
      },
      take,
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });
  }

  async findReservationWithRooms(reservationId: string) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        rooms: true,
      },
    });
  }

  async findReservationById(reservationId: string) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
    });
  }

  async findFirstVacantCleanRoomByType(
    organizationId: string,
    hotelId: string,
    roomTypeId: string
  ) {
    return prisma.room.findFirst({
      where: {
        organizationId,
        hotelId,
        roomTypeId,
        status: 'VACANT_CLEAN',
        deletedAt: null,
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });
  }

  async reinstateReservation(
    reservationId: string,
    reason: string,
    modifiedBy: string,
    existingInternalNotes: string | null
  ) {
    return prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
        noShow: false,
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
        modifiedAt: new Date(),
        modifiedBy,
        internalNotes: existingInternalNotes
          ? `${existingInternalNotes}\nReinstated: ${reason}`
          : `Reinstated: ${reason}`,
      },
    });
  }

  async getFrontDeskCounts(organizationId: string, hotelId: string, businessDate: Date) {
    const [
      totalRooms,
      occupied,
      available,
      outOfOrder,
      arrivals,
      departures,
      inHouse,
      checkedInToday,
      checkedOutToday,
    ] = await Promise.all([
      prisma.room.count({ where: { organizationId, hotelId, deletedAt: null } }),
      prisma.room.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: { in: ['OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'] },
        },
      }),
      prisma.room.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: { in: ['VACANT_CLEAN', 'VACANT_DIRTY'] },
        },
      }),
      prisma.room.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: 'OUT_OF_ORDER',
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          checkInDate: businessDate,
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          checkOutDate: businessDate,
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: 'CHECKED_IN',
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: 'CHECKED_IN',
          checkInDate: businessDate,
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          status: 'CHECKED_OUT',
          checkOutDate: businessDate,
        },
      }),
    ]);

    return {
      totalRooms,
      occupied,
      available,
      outOfOrder,
      arrivals,
      departures,
      inHouse,
      checkedInToday,
      checkedOutToday,
    };
  }

  async findRoomGrid(organizationId: string, hotelId: string) {
    return prisma.room.findMany({
      where: {
        organizationId,
        hotelId,
        deletedAt: null,
      },
      include: {
        roomType: {
          select: {
            code: true,
          },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });
  }
}

export const checkinCheckoutRepository = new CheckinCheckoutRepository();
