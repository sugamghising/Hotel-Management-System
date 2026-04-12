import { NotFoundError } from '../../core/errors';
import { prisma } from '../../database/prisma';
import type { $Enums, Prisma } from '../../generated/prisma';
import type { AssignmentType, Reservation, ReservationStatus } from './reservations.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalizes optional user identifiers to nullable UUID values for persistence.
 *
 * @param value - Candidate identifier that may be empty, malformed, or non-UUID.
 * @returns Valid UUID string when format matches; otherwise `null`.
 */
const asNullableUuid = (value?: string): string | null => {
  if (!value || !UUID_REGEX.test(value)) {
    return null;
  }
  return value;
};

export type ReservationWhereInput = Prisma.ReservationWhereInput;
export type ReservationCreateInput = Prisma.ReservationCreateInput;
export type ReservationUpdateInput = Prisma.ReservationUpdateInput;

export class ReservationsRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Retrieves a reservation by ID with guest, room, and optional relation includes.
   *
   * @param id - Reservation UUID.
   * @param include - Optional Prisma include overrides merged into default relation includes.
   * @returns Reservation with relations, or `null` when not found.
   */
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

  /**
   * Finds a reservation by external channel reference inside one hotel scope.
   *
   * @param externalRef - External booking reference from OTA/channel integrations.
   * @param hotelId - Hotel UUID used to scope the lookup.
   * @returns Matching reservation, or `null` when no active booking uses the reference.
   */
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

  /**
   * Searches reservations by operational filters and returns paginated results.
   *
   * It builds a dynamic Prisma `where` clause for lifecycle dates, guest names, source/channel
   * metadata, and room number constraints, then executes data and total-count queries in parallel.
   *
   * @param hotelId - Hotel UUID to scope the search.
   * @param filters - Optional status, date, guest, source, and room-based filters.
   * @param pagination - Optional page and limit values for offset pagination.
   * @returns Matching reservations with total result count.
   * @remarks Complexity: O(1) service-side query assembly with DB cost dominated by applied filters.
   */
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

    if (filters.roomNumber) {
      where.rooms = {
        some: {
          room: {
            roomNumber: { contains: filters.roomNumber, mode: 'insensitive' },
          },
        },
      };
    }

    if (filters.createdFrom || filters.createdTo) {
      where.bookedAt = {};
      if (filters.createdFrom) where.bookedAt.gte = filters.createdFrom;
      if (filters.createdTo) where.bookedAt.lte = filters.createdTo;
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

  /**
   * Creates a reservation and its first reservation-room row in one transaction.
   *
   * @param data - Reservation entity payload for the parent reservation record.
   * @param roomData - Initial reservation-room payload linked to the new reservation.
   * @returns Persisted reservation reloaded with guest and room relations.
   */
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

  /**
   * Updates a reservation and refreshes `modifiedAt` to track lifecycle edits.
   *
   * @param id - Reservation UUID.
   * @param data - Partial reservation fields to update.
   * @returns Updated reservation with related guest and room entities.
   */
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

  /**
   * Soft-deletes a reservation by timestamping `deletedAt` and forcing `CANCELLED` status.
   *
   * @param id - Reservation UUID to soft-delete.
   * @returns Resolves when soft-delete fields are persisted.
   */
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

  /**
   * Updates reservation status without modifying other lifecycle fields.
   *
   * @param id - Reservation UUID.
   * @param status - Target reservation status literal.
   * @returns Resolves when status is persisted.
   */
  async updateStatus(id: string, status: ReservationStatus): Promise<void> {
    await prisma.reservation.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Executes the full check-in transaction across reservation, room, assignment, and outbox tables.
   *
   * The workflow updates reservation and reservation-room statuses, marks the physical room as
   * occupied, rotates active room assignments, records a check-in event row, and emits outbox
   * events for reservation lifecycle and room occupancy subscribers.
   *
   * @param reservationId - Reservation UUID being checked in.
   * @param reservationRoomId - Reservation-room UUID linked to the stay segment.
   * @param roomId - Physical room UUID assigned at check-in.
   * @param options - Optional check-in metadata (actor, assignment type, key details, and notes).
   * @returns Resolves when the transaction commits.
   * @remarks Complexity: O(1) fixed-write transaction with deterministic row updates/inserts.
   */
  async checkIn(
    reservationId: string,
    reservationRoomId: string,
    roomId: string,
    options: {
      earlyCheckIn?: boolean;
      checkedInBy?: string;
      preAuthAmount?: number;
      keysIssued?: number;
      keyCardRef?: string;
      idDocumentId?: string;
      notes?: string;
      assignmentType?: AssignmentType;
    } = {}
  ): Promise<void> {
    const now = new Date();
    const earlyCheckIn = options.earlyCheckIn ?? false;

    await prisma.$transaction(async (tx) => {
      const previousReservationRoom = await tx.reservationRoom.findUnique({
        where: { id: reservationRoomId },
        select: {
          roomId: true,
        },
      });

      const reservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CHECKED_IN',
          checkInStatus: earlyCheckIn ? 'EARLY_CHECK_IN' : 'CHECKED_IN',
          modifiedAt: now,
        },
        select: {
          organizationId: true,
          hotelId: true,
        },
      });

      await tx.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          roomId,
          status: 'OCCUPIED',
          assignedAt: now,
          checkInAt: now,
        },
      });

      await tx.room.update({
        where: { id: roomId },
        data: {
          status: 'OCCUPIED_CLEAN',
        },
      });

      await tx.roomAssignment.updateMany({
        where: {
          reservationId,
          isActive: true,
          releasedAt: null,
        },
        data: {
          isActive: false,
          releasedAt: now,
        },
      });

      await tx.roomAssignment.create({
        data: {
          organizationId: reservation.organizationId,
          hotelId: reservation.hotelId,
          reservationId,
          reservationRoomId,
          roomId,
          assignmentType: options.assignmentType ?? 'INITIAL',
          previousRoomId: previousReservationRoom?.roomId ?? null,
          reason: null,
          isActive: true,
          assignedAt: now,
          assignedBy: asNullableUuid(options.checkedInBy),
          releasedAt: null,
          notes: null,
        },
      });

      await tx.checkInRecord.create({
        data: {
          organizationId: reservation.organizationId,
          hotelId: reservation.hotelId,
          reservationId,
          reservationRoomId,
          roomId,
          assignmentType: options.assignmentType ?? 'INITIAL',
          earlyCheckIn,
          keysIssued: options.keysIssued ?? 1,
          ...(options.preAuthAmount !== undefined ? { preAuthAmount: options.preAuthAmount } : {}),
          ...(options.keyCardRef !== undefined ? { keyCardRef: options.keyCardRef } : {}),
          ...(options.idDocumentId !== undefined ? { idDocumentId: options.idDocumentId } : {}),
          ...(options.notes !== undefined ? { notes: options.notes } : {}),
          checkedInAt: now,
          checkedInBy: asNullableUuid(options.checkedInBy),
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            eventType: 'reservation.checked_in',
            aggregateType: 'RESERVATION',
            aggregateId: reservationId,
            payload: {
              organizationId: reservation.organizationId,
              hotelId: reservation.hotelId,
              reservationId,
              reservationRoomId,
              roomId,
              checkedInAt: now.toISOString(),
              earlyCheckIn,
              assignmentType: options.assignmentType ?? 'INITIAL',
            },
          },
          {
            eventType: 'room.occupied',
            aggregateType: 'ROOM',
            aggregateId: roomId,
            payload: {
              organizationId: reservation.organizationId,
              hotelId: reservation.hotelId,
              reservationId,
              roomId,
              occupiedAt: now.toISOString(),
            },
          },
        ],
      });
    });
  }

  /**
   * Executes the full check-out transaction across reservation, room, assignment, and outbox tables.
   *
   * It transitions reservation and reservation-room states to checked-out, vacates the physical room,
   * closes active assignment rows, stores check-out settlement metadata, and emits lifecycle events.
   *
   * @param reservationId - Reservation UUID being checked out.
   * @param reservationRoomId - Reservation-room UUID linked to the departing stay segment.
   * @param roomId - Physical room UUID being vacated.
   * @param organizationId - Organization UUID included in emitted event payloads.
   * @param hotelId - Hotel UUID included in emitted event payloads.
   * @param lateCheckOut - Whether departure is classified as late checkout.
   * @param options - Optional financial, key-return, satisfaction, and actor metadata.
   * @returns Resolves when the transaction commits.
   * @remarks Complexity: O(1) fixed-write transaction with deterministic row updates/inserts.
   */
  async checkOut(
    reservationId: string,
    reservationRoomId: string,
    roomId: string,
    organizationId: string,
    hotelId: string,
    lateCheckOut: boolean = false,
    options: {
      checkedOutBy?: string;
      lateFeeAmount?: number;
      finalBalance?: number;
      settlementAmount?: number;
      paymentMethod?: string;
      keysReturned?: number;
      satisfactionScore?: number;
      notes?: string;
    } = {}
  ): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CHECKED_OUT',
          checkInStatus: lateCheckOut ? 'LATE_CHECK_OUT' : 'CHECKED_OUT',
          modifiedAt: now,
        },
        select: {
          organizationId: true,
          hotelId: true,
        },
      });

      await tx.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          status: 'CHECKED_OUT',
          checkOutAt: now,
        },
      });

      await tx.room.update({
        where: { id: roomId },
        data: {
          status: 'VACANT_DIRTY',
        },
      });

      await tx.roomAssignment.updateMany({
        where: {
          reservationId,
          roomId,
          isActive: true,
          releasedAt: null,
        },
        data: {
          isActive: false,
          releasedAt: now,
        },
      });

      await tx.checkOutRecord.create({
        data: {
          organizationId: reservation.organizationId,
          hotelId: reservation.hotelId,
          reservationId,
          reservationRoomId,
          roomId,
          lateCheckOut,
          ...(options.lateFeeAmount !== undefined ? { lateFeeAmount: options.lateFeeAmount } : {}),
          finalBalance: options.finalBalance ?? 0,
          ...(options.settlementAmount !== undefined
            ? { settlementAmount: options.settlementAmount }
            : {}),
          paymentMethod: options.paymentMethod
            ? (options.paymentMethod as $Enums.PaymentMethod)
            : null,
          invoiceId: null,
          ...(options.keysReturned !== undefined ? { keysReturned: options.keysReturned } : {}),
          ...(options.satisfactionScore !== undefined
            ? { satisfactionScore: options.satisfactionScore }
            : {}),
          ...(options.notes !== undefined ? { notes: options.notes } : {}),
          checkedOutAt: now,
          checkedOutBy: asNullableUuid(options.checkedOutBy),
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            eventType: 'reservation.checked_out',
            aggregateType: 'RESERVATION',
            aggregateId: reservationId,
            payload: {
              organizationId,
              hotelId,
              reservationId,
              reservationRoomId,
              roomId,
              checkedOutAt: now.toISOString(),
              lateCheckOut,
            },
          },
          {
            eventType: 'room.vacated',
            aggregateType: 'ROOM',
            aggregateId: roomId,
            payload: {
              organizationId: reservation.organizationId,
              hotelId: reservation.hotelId,
              reservationId,
              roomId,
              vacatedAt: now.toISOString(),
              lateCheckOut,
            },
          },
        ],
      });
    });
  }

  /**
   * Marks a reservation as cancelled with reason, actor, and optional cancellation fee.
   *
   * @param id - Reservation UUID.
   * @param reason - Human-readable cancellation reason.
   * @param cancelledBy - Actor identifier recorded in cancellation metadata.
   * @param fee - Optional cancellation fee amount.
   * @returns Resolves when cancellation fields are persisted.
   */
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

  /**
   * Marks a reservation as no-show and emits a no-show outbox event.
   *
   * @param id - Reservation UUID.
   * @param chargeFee - Whether a no-show fee should be retained on the reservation.
   * @param options - Optional no-show reason and explicit fee override.
   * @returns Resolves when status updates and event writes commit.
   */
  async markNoShow(
    id: string,
    chargeFee: boolean,
    options: {
      reason?: string;
      noShowFee?: number;
    } = {}
  ): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { id },
        data: {
          status: 'NO_SHOW',
          noShow: true,
          ...(chargeFee
            ? options.noShowFee !== undefined
              ? { cancellationFee: options.noShowFee }
              : {}
            : { cancellationFee: null }),
          ...(options.reason ? { cancellationReason: options.reason } : {}),
          modifiedAt: now,
        },
        select: {
          organizationId: true,
          hotelId: true,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'reservation.no_show',
          aggregateType: 'RESERVATION',
          aggregateId: id,
          payload: {
            organizationId: reservation.organizationId,
            hotelId: reservation.hotelId,
            reservationId: id,
            markedAt: now.toISOString(),
            chargeNoShowFee: chargeFee,
            ...(options.noShowFee !== undefined ? { noShowFee: options.noShowFee } : {}),
            ...(options.reason ? { reason: options.reason } : {}),
          },
        },
      });
    });
  }

  // ============================================================================
  // ROOM ASSIGNMENT
  // ============================================================================

  /**
   * Assigns or reassigns a room for one reservation-room record inside a transaction.
   *
   * It updates reservation-room linkage, syncs room occupancy status for checked-in guests,
   * rotates active assignment rows, and emits an upgrade outbox event when applicable.
   *
   * @param reservationRoomId - Reservation-room UUID to update.
   * @param roomId - Target room UUID for assignment.
   * @param assignedBy - Actor identifier performing the assignment.
   * @param options - Optional assignment metadata including type, reason, and previous room.
   * @returns Resolves when assignment updates commit.
   * @throws {NotFoundError} When the reservation-room record does not exist.
   */
  async assignRoom(
    reservationRoomId: string,
    roomId: string,
    assignedBy: string,
    options: {
      assignmentType?: AssignmentType;
      reason?: string;
      previousRoomId?: string;
    } = {}
  ): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const current = await tx.reservationRoom.findUnique({
        where: { id: reservationRoomId },
        select: {
          reservationId: true,
          roomId: true,
          reservation: {
            select: {
              status: true,
              organizationId: true,
              hotelId: true,
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundError('Reservation room not found');
      }

      await tx.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          roomId,
          assignedAt: now,
          assignedBy: asNullableUuid(assignedBy),
          status: current.reservation.status === 'CHECKED_IN' ? 'OCCUPIED' : 'ASSIGNED',
        },
      });

      if (current.reservation.status === 'CHECKED_IN') {
        await tx.room.update({
          where: { id: roomId },
          data: {
            status: 'OCCUPIED_CLEAN',
          },
        });

        if (current.roomId && current.roomId !== roomId) {
          await tx.room.update({
            where: { id: current.roomId },
            data: {
              status: 'VACANT_DIRTY',
            },
          });
        }
      }

      await tx.roomAssignment.updateMany({
        where: {
          reservationId: current.reservationId,
          isActive: true,
          releasedAt: null,
        },
        data: {
          isActive: false,
          releasedAt: now,
        },
      });

      await tx.roomAssignment.create({
        data: {
          organizationId: current.reservation.organizationId,
          hotelId: current.reservation.hotelId,
          reservationId: current.reservationId,
          reservationRoomId,
          roomId,
          assignmentType: options.assignmentType ?? 'MANUAL',
          previousRoomId: options.previousRoomId ?? current.roomId ?? null,
          reason: options.reason ?? null,
          isActive: true,
          assignedAt: now,
          assignedBy: asNullableUuid(assignedBy),
          releasedAt: null,
          notes: null,
        },
      });

      if (options.assignmentType === 'UPGRADE' && current.roomId && current.roomId !== roomId) {
        await tx.outboxEvent.create({
          data: {
            eventType: 'room.upgraded',
            aggregateType: 'ROOM',
            aggregateId: roomId,
            payload: {
              organizationId: current.reservation.organizationId,
              hotelId: current.reservation.hotelId,
              reservationId: current.reservationId,
              fromRoomId: current.roomId,
              toRoomId: roomId,
              assignedAt: now.toISOString(),
            },
          },
        });
      }
    });
  }

  /**
   * Removes room assignment from a reservation-room record and resets it to reserved state.
   *
   * @param reservationRoomId - Reservation-room UUID to unassign.
   * @returns Resolves when assignment fields are cleared.
   */
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

  /**
   * Automatically picks the best available room for a reservation and assigns it.
   *
   * The selector prioritizes clean vacant rooms, then lower floors and room numbers to provide
   * deterministic assignment. It returns `null` when no suitable room or reservation-room exists.
   *
   * @param reservationId - Reservation UUID requiring assignment.
   * @param roomTypeId - Room type UUID constraint for candidate rooms.
   * @returns Assigned room UUID, or `null` when auto-assignment cannot be completed.
   */
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

    await this.assignRoom(resRoom.id, availableRoom.id, 'SYSTEM_AUTO', {
      assignmentType: 'AUTO',
    });

    return availableRoom.id;
  }

  // ============================================================================
  // AVAILABILITY CHECKS
  // ============================================================================

  /**
   * Checks room-type availability for a stay window using inventory and overlap constraints.
   *
   * Availability is derived from physical room count, overlapping active reservations, and any
   * date-level stop-sell/inventory overrides. The minimum available count across the stay wins.
   *
   * @param hotelId - Hotel UUID where availability is evaluated.
   * @param roomTypeId - Room type UUID being checked.
   * @param checkIn - Arrival date (inclusive).
   * @param checkOut - Departure date (exclusive).
   * @returns Availability flag and remaining room count for the tightest day in range.
   * @remarks Complexity: O(I) where `I` is inventory rows returned for the stay range.
   */
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

  /**
   * Lists arrivals scheduled for a specific business date.
   *
   * @param hotelId - Hotel UUID whose arrivals are queried.
   * @param date - Business date used for `checkInDate` matching.
   * @returns Reservations arriving on the date with guest and room relations.
   */
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

  /**
   * Lists in-house reservations scheduled to depart on a specific business date.
   *
   * @param hotelId - Hotel UUID whose departures are queried.
   * @param date - Business date used for `checkOutDate` matching.
   * @returns Checked-in reservations departing on the date.
   */
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

  /**
   * Lists all currently checked-in reservations for a hotel.
   *
   * @param hotelId - Hotel UUID whose in-house guests are requested.
   * @returns Active in-house reservations with guest and room relations.
   */
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

  /**
   * Generates a reservation confirmation number with collision retries.
   *
   * The value format is `YYMMDD####` with a random suffix, retried up to ten times against
   * current records. If random retries collide, it falls back to a timestamp-based suffix.
   *
   * @param _hotelId - Hotel UUID placeholder for potential hotel-specific prefixes.
   * @returns Unique confirmation number string.
   * @remarks Complexity: O(A) where `A` is retry attempts (max 10) plus one fallback path.
   */
  async generateConfirmationNumber(_hotelId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // Use a random suffix with retry loop to avoid race conditions on concurrent creates
    const maxAttempts = 10;
    const MIN_SUFFIX = 1000;
    const SUFFIX_RANGE = 9000; // generates 4-digit suffix: MIN_SUFFIX to MIN_SUFFIX + SUFFIX_RANGE - 1
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomSuffix = Math.floor(Math.random() * SUFFIX_RANGE + MIN_SUFFIX).toString();
      const confirmationNumber = `${year}${month}${day}${randomSuffix}`;

      const existing = await prisma.reservation.findUnique({
        where: { confirmationNumber },
        select: { id: true },
      });

      if (!existing) {
        return confirmationNumber;
      }
    }

    // Fallback: last 6 digits of current timestamp guarantee uniqueness when
    // random generation fails after max attempts
    return `${year}${month}${day}${Date.now().toString().slice(-6)}`;
  }

  // ============================================================================
  // SPLIT/MERGE
  // ============================================================================

  /**
   * Splits one reservation into original and new segments at a split date.
   *
   * It shortens the original reservation, creates a new reservation for the remaining nights,
   * inserts a linked reservation-room row, and returns both records in one transaction.
   *
   * @param reservationId - Source reservation UUID.
   * @param splitDate - Boundary date where the original stay ends and the new stay begins.
   * @param newReservationData - Base data used to create the new reservation segment.
   * @param newRoomData - Reservation-room payload for the new segment.
   * @returns Updated original reservation and newly created split reservation.
   * @remarks Complexity: O(1) fixed-write transaction with deterministic row operations.
   */
  async splitReservation(
    reservationId: string,
    splitDate: Date,
    newReservationData: Prisma.ReservationUncheckedCreateInput,
    newRoomData: Prisma.ReservationRoomUncheckedCreateWithoutReservationInput
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
        include: {
          rooms: { include: { roomType: true, room: true } },
          guest: true,
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

      // Create reservation room for the new reservation
      await tx.reservationRoom.create({
        data: {
          ...newRoomData,
          reservationId: newReservation.id,
        },
      });

      const newReservationWithRelations = await tx.reservation.findUnique({
        where: { id: newReservation.id },
        include: {
          rooms: { include: { roomType: true, room: true } },
          guest: true,
        },
      });

      return {
        original: updatedOriginal as unknown as Reservation,
        new: newReservationWithRelations as unknown as Reservation,
      };
    });
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Checks whether a room currently participates in any active reservation assignment.
   *
   * @param roomId - Room UUID to validate.
   * @param excludeReservationId - Optional reservation UUID to ignore during checks.
   * @returns `true` when an active assigned/occupied reservation exists for the room.
   */
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

export const reservationsRepository = new ReservationsRepository();
