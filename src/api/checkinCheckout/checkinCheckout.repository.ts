import { prisma } from '../../database/prisma';

export class CheckinCheckoutRepository {
  /**
   * Lists currently available rooms for check-in within an organization and hotel scope.
   *
   * @param organizationId - Organization UUID that owns the rooms.
   * @param hotelId - Hotel UUID where availability is queried.
   * @param take - Maximum number of rooms to return, defaulting to 30.
   * @returns Rooms in `'VACANT_CLEAN'` or `'VACANT_DIRTY'` status ordered by floor and room number.
   */
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

  /**
   * Retrieves a reservation and its room assignments by reservation ID.
   *
   * @param reservationId - Reservation UUID to load.
   * @returns The reservation with related rooms, or `null` when no record exists.
   */
  async findReservationWithRooms(reservationId: string) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        rooms: true,
      },
    });
  }

  /**
   * Retrieves a reservation record by ID without additional relations.
   *
   * @param reservationId - Reservation UUID to load.
   * @returns The reservation record or `null` when not found.
   */
  async findReservationById(reservationId: string) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
    });
  }

  /**
   * Finds the first clean vacant room for a specific room type within hotel scope.
   *
   * @param organizationId - Organization UUID that owns the room inventory.
   * @param hotelId - Hotel UUID where the room must exist.
   * @param roomTypeId - Room type UUID requested for assignment.
   * @returns The first matching room ordered by floor and room number, or `null` if unavailable.
   */
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

  /**
   * Reinstates a cancelled or no-show reservation and appends a reinstatement note.
   *
   * @param reservationId - Reservation UUID to reinstate.
   * @param reason - Human-readable reinstatement reason saved to internal notes.
   * @param modifiedBy - User ID recorded as the modifying actor.
   * @param existingInternalNotes - Existing internal notes that are preserved and appended.
   * @returns The updated reservation after status and audit fields are reset.
   */
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
        cancellationFee: null,
        modifiedAt: new Date(),
        modifiedBy,
        internalNotes: existingInternalNotes
          ? `${existingInternalNotes}\nReinstated: ${reason}`
          : `Reinstated: ${reason}`,
      },
    });
  }

  /**
   * Computes front-desk dashboard counters for a single business date.
   *
   * The method runs multiple room and reservation aggregate queries in parallel and
   * returns occupancy, arrivals, departures, and in-house movement counters used by
   * front-desk dashboards.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID to aggregate.
   * @param businessDate - Business date normalized by callers for arrival/departure matching.
   * @returns A count object containing room inventory and stay movement totals.
   * @remarks Complexity: O(1) application work with 9 independent aggregate DB calls.
   */
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
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      }),
      prisma.reservation.count({
        where: {
          organizationId,
          hotelId,
          deletedAt: null,
          checkOutDate: businessDate,
          status: 'CHECKED_IN',
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

  /**
   * Retrieves all active rooms for the front-desk room grid.
   *
   * @param organizationId - Organization UUID that owns the room inventory.
   * @param hotelId - Hotel UUID whose rooms are listed.
   * @returns Ordered room records with room type code relation data for grid rendering.
   */
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
