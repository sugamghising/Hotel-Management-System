import {
  BadRequestError,
  ConflictError,
  DuplicateChannelBookingError,
  ForbiddenError,
  NotFoundError,
  logger,
} from '../../core';
import { prisma } from '../../database/prisma';
import { type HotelRepository, hotelRepository } from '../hotel';
import { type RatePlansRepository, ratePlansRepository } from '../ratePlans';
import { type RoomTypesRepository, roomTypesRepository } from '../roomTypes';
import { type RoomsRepository, roomsRepository } from '../rooms';
import type { RoomConflict } from '../rooms/rooms.types';
import {
  type ReservationUpdateInput,
  type ReservationsRepository,
  reservationsRepository,
} from './reservations.repository';
import type {
  CheckInInput,
  CheckOutInput,
  CreateReservationInput,
  InHouseGuestResponse,
  NoShowInput,
  RateBreakdownItem,
  Reservation,
  ReservationListResponse,
  ReservationResponse,
  ReservationSearchFilters,
  ReservationWithRelations,
  RoomAssignmentInput,
  SplitReservationInput,
  UpdateReservationInput,
  VIPStatus,
  WalkInInput,
} from './reservations.types';

export class ReservationsService {
  private reservationsRepo: ReservationsRepository;
  private hotelRepo: HotelRepository;
  private ratePlanRepo: RatePlansRepository;
  private roomTypeRepo: RoomTypesRepository;
  private roomRepo: RoomsRepository;

  /**
   * Creates a reservations service with repository dependencies.
   *
   * @param reservationsRepo - Repository handling reservation lifecycle persistence.
   * @param hotelRepo - Repository used to validate hotel ownership boundaries.
   * @param ratePlanRepo - Repository used for rate plan and override lookups.
   * @param roomTypeRepo - Repository used to validate room type scope.
   * @param roomRepo - Repository used for room availability and assignment checks.
   */
  constructor(
    reservationsRepo: ReservationsRepository = reservationsRepository,
    hotelRepo: HotelRepository = hotelRepository,
    ratePlanRepo: RatePlansRepository = ratePlansRepository,
    roomTypeRepo: RoomTypesRepository = roomTypesRepository,
    roomRepo: RoomsRepository = roomsRepository
  ) {
    this.reservationsRepo = reservationsRepo;
    this.hotelRepo = hotelRepo;
    this.ratePlanRepo = ratePlanRepo;
    this.roomTypeRepo = roomTypeRepo;
    this.roomRepo = roomRepo;
  }

  // ============================================================================
  // CREATE RESERVATION
  // ============================================================================

  /**
   * Creates a reservation after validating guest, room type, availability, and pricing.
   *
   * It enforces external-reference uniqueness, validates stay length bounds, optionally validates
   * a requested room, calculates nightly financials, generates confirmation, and persists the
   * reservation plus its reservation-room row.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID where the reservation is created.
   * @param input - Reservation payload including guest, stay, and distribution fields.
   * @param createdBy - Optional actor identifier stored in booking metadata.
   * @returns Created reservation mapped to API response format.
   * @throws {NotFoundError} When guest, room type, rate plan, or requested room is missing.
   * @throws {DuplicateChannelBookingError} When `externalRef` already exists for the hotel.
   * @throws {BadRequestError} When stay length or requested room-type constraints are invalid.
   * @throws {ConflictError} When inventory or room availability checks fail.
   * @remarks Complexity: O(N) where `N` is stay nights for rate breakdown construction.
   */
  async create(
    organizationId: string,
    hotelId: string,
    input: CreateReservationInput,
    createdBy?: string
  ): Promise<ReservationResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    // Verify guest exists
    const guest = await prisma.guest.findUnique({ where: { id: input.guestId } });
    if (!guest || guest.organizationId !== organizationId) {
      throw new NotFoundError(`Guest ${input.guestId} not found`);
    }

    // Verify room type exists
    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || roomType.hotelId !== hotelId) {
      throw new NotFoundError(`Room type ${input.roomTypeId} not found`);
    }

    // Verify rate plan exists and is valid
    const ratePlan = await this.ratePlanRepo.findById(input.ratePlanId);
    if (!ratePlan || ratePlan.hotelId !== hotelId || !ratePlan.isActive) {
      throw new NotFoundError(`Rate plan ${input.ratePlanId} not found`);
    }

    if (input.externalRef) {
      const existingExternal = await this.reservationsRepo.findByExternalRef(
        input.externalRef,
        hotelId
      );
      if (existingExternal) {
        throw new DuplicateChannelBookingError(input.externalRef);
      }
    }

    // Check date validity
    const nights = Math.ceil(
      (input.checkOutDate.getTime() - input.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (nights < 1) {
      throw new BadRequestError('Minimum stay is 1 night');
    }
    if (nights > 365) {
      throw new BadRequestError('Maximum stay is 365 nights');
    }

    // Check availability
    const availability = await this.reservationsRepo.checkAvailability(
      hotelId,
      input.roomTypeId,
      input.checkInDate,
      input.checkOutDate
    );
    if (!availability.available) {
      throw new ConflictError('No availability for requested dates');
    }

    // If specific room requested, verify it's available
    if (input.roomId) {
      const room = await this.roomRepo.findById(input.roomId);
      if (!room || room.hotelId !== hotelId) {
        throw new NotFoundError(`Room ${input.roomId} not found`);
      }
      if (room.roomTypeId !== input.roomTypeId) {
        throw new BadRequestError('Requested room does not match room type');
      }
      const roomCheck = await this.roomRepo.checkAvailability(
        input.roomId,
        input.checkInDate,
        input.checkOutDate
      );
      if (!roomCheck.available) {
        throw new ConflictError('Requested room is not available');
      }
    }

    // Calculate rates
    const rateCalculation = await this.calculateRates(
      hotelId,
      input.roomTypeId,
      input.ratePlanId,
      input.checkInDate,
      input.checkOutDate,
      input.adultCount || 2,
      input.childCount || 0
    );

    // Generate confirmation number
    const confirmationNumber = await this.reservationsRepo.generateConfirmationNumber(hotelId);

    // Create reservation
    const reservation = await this.reservationsRepo.create(
      {
        organization: { connect: { id: organizationId } },
        hotel: { connect: { id: hotelId } },
        guest: { connect: { id: input.guestId } },
        ratePlan: { connect: { id: input.ratePlanId } },
        confirmationNumber,
        externalRef: input.externalRef || null,
        source: input.source || 'DIRECT_WEB',
        channelCode: input.channelCode || null,
        agentId: null,
        corporateCode: input.corporateCode || null,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        arrivalTime: input.arrivalTime ? this.parseTime(input.arrivalTime) : null,
        departureTime: input.departureTime ? this.parseTime(input.departureTime) : null,
        nights,
        status: 'CONFIRMED',
        checkInStatus: 'NOT_CHECKED_IN',
        adultCount: input.adultCount || 2,
        childCount: input.childCount || 0,
        infantCount: input.infantCount || 0,
        currencyCode: ratePlan.currencyCode,
        totalAmount: rateCalculation.total,
        taxAmount: rateCalculation.tax,
        discountAmount: 0,
        paidAmount: 0,
        balance: rateCalculation.total,
        rateBreakdown: JSON.parse(JSON.stringify(rateCalculation.breakdown)),
        averageRate: rateCalculation.average,
        cancellationPolicy: ratePlan.cancellationPolicy,
        guaranteeType: input.guaranteeType || 'NONE',
        guaranteeAmount: input.guaranteeAmount || null,
        cardToken: input.cardToken || null,
        cardLastFour: input.cardLastFour || null,
        cardExpiryMonth: input.cardExpiryMonth || null,
        cardExpiryYear: input.cardExpiryYear || null,
        cardBrand: input.cardBrand || null,
        guestNotes: input.guestNotes || null,
        specialRequests: input.specialRequests || null,
        internalNotes: input.internalNotes || null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        cancellationFee: null,
        noShow: false,
        bookedAt: new Date(),
        bookedBy: createdBy || 'SYSTEM',
        modifiedAt: new Date(),
        modifiedBy: null,
      },
      {
        roomTypeId: input.roomTypeId,
        roomId: input.roomId || null,
        roomRate: rateCalculation.average,
        adultCount: input.adultCount || 2,
        childCount: input.childCount || 0,
        status: input.roomId ? 'ASSIGNED' : 'RESERVED',
      }
    );

    logger.info(`Reservation created: ${confirmationNumber}`, {
      reservationId: reservation.id,
      guestId: input.guestId,
      hotelId,
      nights,
      total: rateCalculation.total,
    });

    return this.mapToResponse(reservation);
  }

  // ============================================================================
  // WALK-IN
  // ============================================================================

  /**
   * Creates and immediately checks in a same-day walk-in reservation.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID where the walk-in is processed.
   * @param input - Walk-in payload containing room and stay details.
   * @param createdBy - Optional actor identifier for booking and check-in metadata.
   * @returns Checked-in reservation response.
   * @throws {NotFoundError} When the requested room does not exist in the hotel.
   * @throws {ConflictError} When the room is not available for immediate check-in.
   */
  async createWalkIn(
    organizationId: string,
    hotelId: string,
    input: WalkInInput,
    createdBy?: string
  ): Promise<ReservationResponse> {
    // Force checkInDate to today for walk-ins
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    // Validate room is immediately available
    const room = await this.roomRepo.findById(input.roomId);
    if (!room || room.hotelId !== hotelId) {
      throw new NotFoundError(`Room ${input.roomId} not found`);
    }

    const roomCheck = await this.roomRepo.checkAvailability(
      input.roomId,
      today,
      input.checkOutDate
    );
    if (!roomCheck.available) {
      throw new ConflictError('Room is not available for immediate check-in');
    }

    // Create as normal reservation then immediately check in
    const reservation = await this.create(
      organizationId,
      hotelId,
      {
        ...input,
        checkInDate: today,
        source: 'DIRECT_WALKIN',
        isWalkIn: true,
      },
      createdBy
    );

    // Auto check-in: reuse existing check-in workflow so reservation, reservation_room,
    // and room statuses stay in sync.
    return this.checkIn(
      reservation.id,
      organizationId,
      hotelId,
      { roomId: input.roomId, assignmentType: 'WALK_IN' },
      createdBy
    );
  }

  // ============================================================================
  // READ
  // ============================================================================

  /**
   * Retrieves one reservation by ID with organization and optional hotel scoping.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Optional hotel UUID to enforce hotel-level scope.
   * @returns Reservation mapped to API response format.
   * @throws {NotFoundError} When reservation is missing, deleted, or outside hotel scope.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   */
  async findById(
    id: string,
    organizationId: string,
    hotelId?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (hotelId && reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    return this.mapToResponse(reservation);
  }

  /**
   * Retrieves a reservation by confirmation number.
   *
   * @param confirmationNumber - Reservation confirmation number.
   * @param organizationId - Optional organization UUID used for ownership checks.
   * @returns Reservation mapped to API response format.
   * @throws {NotFoundError} When no reservation matches or record is soft-deleted.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   */
  async findByConfirmationNumber(
    confirmationNumber: string,
    organizationId?: string
  ): Promise<ReservationResponse> {
    const reservation = await prisma.reservation.findUnique({
      where: { confirmationNumber },
      include: { rooms: { include: { roomType: true, room: true } }, guest: true },
    });

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${confirmationNumber} not found`);
    }

    if (organizationId && reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return this.mapToResponse(reservation as unknown as ReservationWithRelations);
  }

  /**
   * Finds the currently checked-in reservation assigned to a room number.
   *
   * @param organizationId - Organization UUID used for authorization.
   * @param hotelId - Hotel UUID where room lookup is performed.
   * @param roomNumber - Human-readable room number to resolve.
   * @returns Checked-in reservation mapped to API response format.
   * @throws {NotFoundError} When hotel is inaccessible or no active stay matches the room.
   */
  async findByRoomNumber(
    organizationId: string,
    hotelId: string,
    roomNumber: string
  ): Promise<ReservationResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const reservation = await prisma.reservation.findFirst({
      where: {
        organizationId,
        hotelId,
        deletedAt: null,
        status: 'CHECKED_IN',
        rooms: {
          some: {
            status: { in: ['ASSIGNED', 'OCCUPIED'] },
            room: {
              roomNumber,
              deletedAt: null,
            },
          },
        },
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
      orderBy: [{ checkInDate: 'desc' }],
    });

    if (!reservation) {
      throw new NotFoundError(`No checked-in reservation found for room ${roomNumber}`);
    }

    return this.mapToResponse(reservation as unknown as ReservationWithRelations);
  }

  /**
   * Searches reservations for one hotel and returns paginated list output.
   *
   * @param hotelId - Hotel UUID whose reservations are queried.
   * @param organizationId - Organization UUID used for access validation.
   * @param filters - Search filters for lifecycle dates, status, guest, and channel metadata.
   * @param pagination - Page and limit values for result slicing.
   * @returns Paginated reservation summaries for operational lists.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   */
  async search(
    hotelId: string,
    organizationId: string,
    filters: ReservationSearchFilters,
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<ReservationListResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const { reservations, total } = await this.reservationsRepo.search(
      hotelId,
      filters,
      pagination
    );

    return {
      reservations: (reservations as ReservationWithRelations[]).map((r) => ({
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Unknown',
        status: r.status,
        checkInStatus: r.checkInStatus,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        nights: r.nights,
        roomType: r.rooms?.[0]?.roomType?.code || 'N/A',
        roomNumber: r.rooms?.[0]?.room?.roomNumber || null,
        totalAmount: r.totalAmount,
        balance: r.balance,
        source: r.source,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Updates mutable reservation fields and recalculates financials when stay dates change.
   *
   * Date edits trigger fresh availability checks and nightly repricing so totals, tax, and balance
   * stay aligned with the updated stay window.
   *
   * @param id - Reservation UUID to update.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param input - Partial reservation fields to modify.
   * @param updatedBy - Optional actor identifier stored in `modifiedBy`.
   * @returns Updated reservation mapped to API response format.
   * @throws {NotFoundError} When reservation is missing or outside provided scope.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When reservation state disallows updates or new dates lack inventory.
   * @throws {BadRequestError} When resulting stay length is invalid.
   * @remarks Complexity: O(N) repricing work when dates change, where `N` is resulting nights.
   */
  async update(
    id: string,
    organizationId: string,
    hotelId: string,
    input: UpdateReservationInput,
    updatedBy?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    // Cannot modify checked-out or cancelled reservations
    if (['CHECKED_OUT', 'CANCELLED'].includes(reservation.status)) {
      throw new ConflictError(`Cannot modify ${reservation.status.toLowerCase()} reservation`);
    }

    // Validate date changes
    const newCheckIn = input.checkInDate || reservation.checkInDate;
    const newCheckOut = input.checkOutDate || reservation.checkOutDate;
    const newNights = Math.ceil(
      (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (newNights < 1) {
      throw new BadRequestError('Minimum stay is 1 night');
    }

    // If dates changed, recalculate rates and check availability
    let rateUpdates = {};
    if (input.checkInDate || input.checkOutDate) {
      const resWithRooms = reservation as ReservationWithRelations;
      const roomTypeId = resWithRooms.rooms?.[0]?.roomTypeId;
      if (!roomTypeId) {
        throw new BadRequestError('Cannot update dates: no room assigned to reservation');
      }
      // Check new availability
      const availability = await this.reservationsRepo.checkAvailability(
        reservation.hotelId,
        roomTypeId,
        newCheckIn,
        newCheckOut
      );
      if (!availability.available) {
        throw new ConflictError('No availability for new dates');
      }

      // Recalculate rates
      const newRates = await this.calculateRates(
        reservation.hotelId,
        roomTypeId,
        reservation.ratePlanId,
        newCheckIn,
        newCheckOut,
        input.adultCount || reservation.adultCount,
        input.childCount || reservation.childCount
      );

      rateUpdates = {
        nights: newNights,
        totalAmount: newRates.total,
        taxAmount: newRates.tax,
        balance: newRates.total - reservation.paidAmount,
        rateBreakdown: newRates.breakdown,
        averageRate: newRates.average,
      };
    }

    const { arrivalTime, departureTime, ...restInput } = input;
    const parsedTimes: { arrivalTime?: Date | null; departureTime?: Date | null } = {};
    if (arrivalTime !== undefined) {
      parsedTimes.arrivalTime = arrivalTime ? this.parseTime(arrivalTime) : null;
    }
    if (departureTime !== undefined) {
      parsedTimes.departureTime = departureTime ? this.parseTime(departureTime) : null;
    }

    const updated = await this.reservationsRepo.update(id, {
      ...restInput,
      ...parsedTimes,
      ...rateUpdates,
      modifiedBy: updatedBy || null,
    } as ReservationUpdateInput);

    logger.info(`Reservation updated: ${reservation.confirmationNumber}`, {
      reservationId: id,
      changes: Object.keys(input),
    });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // CHECK-IN
  // ============================================================================

  /**
   * Performs reservation check-in with support for controller and internal call signatures.
   *
   * It validates reservation state, resolves or auto-assigns a room, verifies room conflicts,
   * delegates atomic persistence to the repository, and returns refreshed reservation data.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID or check-in payload when called through shorthand signature.
   * @param input - Check-in payload or legacy actor value based on call signature.
   * @param _checkedInBy - Optional actor identifier recorded in check-in metadata.
   * @returns Checked-in reservation response.
   * @throws {NotFoundError} When reservation or reservation-room records are missing.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When lifecycle state or room availability blocks check-in.
   */
  async checkIn(
    id: string,
    organizationId: string,
    hotelId: string | CheckInInput,
    input?: CheckInInput | string,
    _checkedInBy?: string
  ): Promise<ReservationResponse> {
    // Support (id, orgId, hotelId, input, by) from controller and (id, orgId, input) from internal callers
    let resolvedHotelId: string | undefined;
    let resolvedInput: CheckInInput;
    if (typeof hotelId === 'string') {
      resolvedHotelId = hotelId;
      resolvedInput = input as CheckInInput;
    } else {
      resolvedInput = hotelId;
    }

    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (resolvedHotelId && reservation.hotelId !== resolvedHotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (!['CONFIRMED', 'CHECKED_IN'].includes(reservation.status)) {
      throw new ConflictError(`Cannot check in ${reservation.status.toLowerCase()} reservation`);
    }

    const resRoom = (reservation as ReservationWithRelations).rooms?.[0];
    if (!resRoom) {
      throw new NotFoundError('Reservation room');
    }

    // Determine room to use
    let roomId = resolvedInput.roomId || resRoom.roomId;

    if (!roomId) {
      // Auto-assign
      roomId = await this.reservationsRepo.autoAssignRoom(id, resRoom.roomTypeId);
      if (!roomId) {
        throw new ConflictError('No rooms available for check-in');
      }
    } else {
      // Verify room availability
      const roomCheck = await this.roomRepo.checkAvailability(
        roomId,
        new Date(),
        reservation.checkOutDate,
        id
      );
      if (!roomCheck.available) {
        throw new ConflictError(
          `Room has conflicts: ${roomCheck.conflicts.map((c: RoomConflict) => c.guestName).join(', ')}`
        );
      }
    }

    await this.reservationsRepo.checkIn(id, resRoom.id, roomId, {
      ...(resolvedInput.earlyCheckIn !== undefined
        ? { earlyCheckIn: resolvedInput.earlyCheckIn }
        : {}),
      ...(_checkedInBy !== undefined ? { checkedInBy: _checkedInBy } : {}),
      ...(resolvedInput.preAuthAmount !== undefined
        ? { preAuthAmount: resolvedInput.preAuthAmount }
        : {}),
      ...(resolvedInput.keysIssued !== undefined ? { keysIssued: resolvedInput.keysIssued } : {}),
      ...(resolvedInput.keyCardRef !== undefined ? { keyCardRef: resolvedInput.keyCardRef } : {}),
      ...(resolvedInput.idDocumentId !== undefined
        ? { idDocumentId: resolvedInput.idDocumentId }
        : {}),
      ...(resolvedInput.notes !== undefined ? { notes: resolvedInput.notes } : {}),
      ...(resolvedInput.assignmentType !== undefined
        ? { assignmentType: resolvedInput.assignmentType }
        : {}),
    });

    // Create folio if not exists
    // await this.folioService.createForReservation(id);

    logger.info(`Guest checked in: ${reservation.confirmationNumber}`, {
      reservationId: id,
      roomId,
      earlyCheckIn: resolvedInput.earlyCheckIn,
    });

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // CHECK-OUT
  // ============================================================================

  /**
   * Performs reservation check-out, settlement validation, and room release.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param input - Checkout payload containing late-checkout and settlement fields.
   * @param _checkedOutBy - Optional actor identifier recorded in checkout metadata.
   * @returns Checked-out reservation response.
   * @throws {NotFoundError} When reservation or assigned room data is missing.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When guest is not checked in or outstanding balance is unresolved.
   */
  async checkOut(
    id: string,
    organizationId: string,
    hotelId: string,
    input: CheckOutInput,
    _checkedOutBy?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.status !== 'CHECKED_IN') {
      throw new ConflictError('Guest is not checked in');
    }

    // Check balance
    if (reservation.balance > 0 && !input.payment) {
      throw new ConflictError(`Outstanding balance: ${reservation.balance}`);
    }

    const resRoom = (reservation as ReservationWithRelations).rooms?.[0];
    if (!resRoom || !resRoom.roomId) {
      throw new NotFoundError('Assigned room');
    }

    const settlementAmount = input.settlementAmount ?? input.payment?.amount;
    const paymentMethod = input.paymentMethod ?? input.payment?.method;

    await this.reservationsRepo.checkOut(
      id,
      resRoom.id,
      resRoom.roomId,
      organizationId,
      hotelId,
      input.lateCheckOut,
      {
        ...(_checkedOutBy !== undefined ? { checkedOutBy: _checkedOutBy } : {}),
        ...(input.lateFeeAmount !== undefined ? { lateFeeAmount: input.lateFeeAmount } : {}),
        finalBalance: input.finalBalance ?? reservation.balance,
        ...(settlementAmount !== undefined ? { settlementAmount } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(input.keysReturned !== undefined ? { keysReturned: input.keysReturned } : {}),
        ...(input.satisfactionScore !== undefined
          ? { satisfactionScore: input.satisfactionScore }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      }
    );

    // Record payment if provided
    if (input.payment) {
      // await this.recordPayment(id, input.payment.amount, input.payment.method);
    }

    logger.info(`Guest checked out: ${reservation.confirmationNumber}`, {
      reservationId: id,
      lateCheckOut: input.lateCheckOut,
    });

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // ROOM ASSIGNMENT
  // ============================================================================

  /**
   * Assigns or reassigns a physical room to an existing reservation.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param input - Assignment payload containing target room and override options.
   * @param assignedBy - Optional actor identifier used in assignment history.
   * @returns Reservation response after assignment changes.
   * @throws {NotFoundError} When reservation, reservation-room, or target room is missing.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {BadRequestError} When room type does not match reservation requirements.
   * @throws {ConflictError} When room conflicts exist and `force` is not enabled.
   */
  async assignRoom(
    id: string,
    organizationId: string,
    hotelId: string,
    input: RoomAssignmentInput,
    assignedBy?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    const resRoom = (reservation as ReservationWithRelations).rooms?.[0];
    if (!resRoom) {
      throw new NotFoundError('Reservation room');
    }

    // Verify room
    const room = await this.roomRepo.findById(input.roomId);
    if (!room || room.hotelId !== reservation.hotelId) {
      throw new NotFoundError(`Room ${input.roomId} not found`);
    }

    if (room.roomTypeId !== resRoom.roomTypeId) {
      throw new BadRequestError('Room type mismatch');
    }

    // Check availability
    const roomCheck = await this.roomRepo.checkAvailability(
      input.roomId,
      reservation.checkInDate,
      reservation.checkOutDate,
      id
    );

    if (!roomCheck.available && !input.force) {
      throw new ConflictError(
        `Room not available: ${roomCheck.conflicts.map((c: RoomConflict) => `${c.guestName} (${c.checkIn.toDateString()})`).join(', ')}`
      );
    }

    await this.reservationsRepo.assignRoom(resRoom.id, input.roomId, assignedBy || 'SYSTEM', {
      assignmentType: input.assignmentType ?? 'MANUAL',
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.previousRoomId !== undefined ? { previousRoomId: input.previousRoomId } : {}),
    });

    logger.info(`Room assigned: ${reservation.confirmationNumber} -> ${room.roomNumber}`, {
      reservationId: id,
      roomId: input.roomId,
    });

    return this.findById(id, organizationId);
  }

  /**
   * Removes room assignment for a reservation that has not been checked in.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @returns Reservation response with room assignment removed.
   * @throws {NotFoundError} When reservation or reservation-room is missing.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When reservation is currently checked in.
   */
  async unassignRoom(
    id: string,
    organizationId: string,
    hotelId: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.status === 'CHECKED_IN') {
      throw new ConflictError('Cannot unassign room for checked-in guest');
    }

    const resRoom = (reservation as ReservationWithRelations).rooms?.[0];
    if (!resRoom) {
      throw new NotFoundError('Reservation room');
    }

    await this.reservationsRepo.unassignRoom(resRoom.id);

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // CANCELLATION
  // ============================================================================

  /**
   * Cancels a reservation and applies policy-based cancellation fees unless waived.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param reason - Cancellation reason stored with the reservation.
   * @param waiveFee - When `true`, skips cancellation fee calculation.
   * @param cancelledBy - Optional actor identifier recorded as canceller.
   * @returns Cancelled reservation response.
   * @throws {NotFoundError} When reservation is missing or outside provided scope.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When reservation status does not allow cancellation.
   */
  async cancel(
    id: string,
    organizationId: string,
    hotelId: string,
    reason: string,
    waiveFee: boolean = false,
    cancelledBy?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (['CANCELLED', 'CHECKED_OUT'].includes(reservation.status)) {
      throw new ConflictError(`Reservation is already ${reservation.status.toLowerCase()}`);
    }

    if (reservation.status === 'CHECKED_IN') {
      throw new ConflictError('Cannot cancel checked-in reservation. Please check out first.');
    }

    // Calculate cancellation fee based on policy
    let fee = 0;
    if (!waiveFee) {
      fee = this.calculateCancellationFee(reservation);
    }

    await this.reservationsRepo.cancel(
      id,
      reason,
      cancelledBy || 'SYSTEM',
      fee > 0 ? fee : undefined
    );

    // Release room inventory
    // await this.inventoryService.release(reservation.rooms[0].roomTypeId, reservation.checkInDate, reservation.checkOutDate);

    logger.info(`Reservation cancelled: ${reservation.confirmationNumber}`, {
      reservationId: id,
      reason,
      fee,
    });

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // NO-SHOW
  // ============================================================================

  /**
   * Marks an eligible confirmed reservation as no-show and optionally charges no-show fees.
   *
   * @param id - Reservation UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param input - No-show options including fee behavior and rationale.
   * @param _markedBy - Optional actor identifier reserved for audit integrations.
   * @returns Updated reservation response with no-show state.
   * @throws {NotFoundError} When reservation is missing or outside provided scope.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {ConflictError} When lifecycle/date rules do not allow no-show processing.
   */
  async markNoShow(
    id: string,
    organizationId: string,
    hotelId: string,
    input: NoShowInput,
    _markedBy?: string
  ): Promise<ReservationResponse> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictError('Only confirmed reservations can be marked no-show');
    }

    // Verify check-in date is today or past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reservation.checkInDate > today) {
      throw new ConflictError('Cannot mark future reservation as no-show');
    }

    const shouldChargeNoShow = input.chargeNoShowFee ?? false;
    const noShowFee = shouldChargeNoShow ? this.calculateNoShowFee(reservation) : undefined;

    await this.reservationsRepo.markNoShow(id, shouldChargeNoShow, {
      ...(noShowFee !== undefined ? { noShowFee } : {}),
      ...(input.reason !== undefined || input.waiveReason !== undefined
        ? { reason: input.reason ?? input.waiveReason }
        : {}),
    });

    logger.info(`No-show marked: ${reservation.confirmationNumber}`, {
      reservationId: id,
      chargeFee: input.chargeNoShowFee,
    });

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // DASHBOARD QUERIES
  // ============================================================================

  /**
   * Lists today's arrivals for one hotel as reservation responses.
   *
   * @param hotelId - Hotel UUID whose arrivals are requested.
   * @param organizationId - Organization UUID used for access validation.
   * @returns Arrival reservations mapped to API response format.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   */
  /**
   * Returns reservations scheduled to arrive on the current business day.
   *
   * @param hotelId - Hotel UUID whose arrivals are requested.
   * @param organizationId - Organization UUID used to verify hotel scope.
   * @returns Reservation responses for arrivals with today's check-in date.
   */
  async getTodayArrivals(hotelId: string, organizationId: string): Promise<ReservationResponse[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await this.reservationsRepo.getTodayArrivals(hotelId, today);
    return reservations.map((r) => this.mapToResponse(r));
  }

  /**
   * Lists today's departures for one hotel as reservation responses.
   *
   * @param hotelId - Hotel UUID whose departures are requested.
   * @param organizationId - Organization UUID used for access validation.
   * @returns Departure reservations mapped to API response format.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   */
  /**
   * Returns reservations scheduled to depart on the current business day.
   *
   * @param hotelId - Hotel UUID whose departures are requested.
   * @param organizationId - Organization UUID used to verify hotel scope.
   * @returns Reservation responses for departures with today's check-out date.
   */
  async getTodayDepartures(
    hotelId: string,
    organizationId: string
  ): Promise<ReservationResponse[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await this.reservationsRepo.getTodayDepartures(hotelId, today);
    return reservations.map((r) => this.mapToResponse(r));
  }

  /**
   * Lists currently in-house guests with operational front-desk fields.
   *
   * @param hotelId - Hotel UUID whose in-house guests are requested.
   * @param organizationId - Organization UUID used for access validation.
   * @returns In-house guest rows derived from checked-in reservations.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   */
  /**
   * Builds in-house guest summaries for all currently checked-in stays in a hotel.
   *
   * @param hotelId - Hotel UUID whose checked-in stays are requested.
   * @param organizationId - Organization UUID used to verify hotel scope.
   * @returns Guest-level dashboard rows including room, stay window, balance, and VIP status.
   * @remarks Complexity: O(n) in number of checked-in reservations returned by the repository.
   */
  async getInHouseGuests(hotelId: string, organizationId: string): Promise<InHouseGuestResponse[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const reservations = await this.reservationsRepo.getInHouseGuests(hotelId);

    return reservations.map((r) => ({
      reservationId: r.id,
      guestId: r.guestId,
      guestName: (() => {
        const g = (r as ReservationWithRelations).guest;
        return g ? `${g.firstName} ${g.lastName}` : 'Unknown';
      })(),
      roomNumber: (r as ReservationWithRelations).rooms?.[0]?.room?.roomNumber || 'N/A',
      roomType: (r as ReservationWithRelations).rooms?.[0]?.roomType?.code || 'N/A',
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: r.nights,
      balance: r.balance,
      vipStatus: ((r as ReservationWithRelations).guest?.vipStatus ?? 'NONE') as VIPStatus,
    }));
  }

  // ============================================================================
  // SPLIT/MERGE
  // ============================================================================

  /**
   * Splits a reservation into two linked stays at a provided split date.
   *
   * It validates split boundaries, computes nights for each segment, generates a new confirmation
   * number, optionally validates a new room type, and delegates atomic persistence to repository.
   *
   * @param id - Reservation UUID to split.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param hotelId - Hotel UUID used for scope checks.
   * @param input - Split parameters including split date and optional new room type.
   * @param splitBy - Optional actor identifier recorded for the new reservation segment.
   * @returns Original and new reservation responses after split completion.
   * @throws {NotFoundError} When reservation or requested room type cannot be found.
   * @throws {ForbiddenError} When reservation belongs to another organization.
   * @throws {BadRequestError} When split boundaries are invalid or room type context is missing.
   * @throws {ConflictError} When reservation status does not allow splitting.
   */
  /**
   * Splits a reservation into two bookings at a date that falls within the original stay.
   *
   * It validates ownership and status, ensures the split boundary is valid, derives nights for both
   * parts, generates a new confirmation number, optionally validates a replacement room type, and
   * delegates the transactional split to the repository.
   *
   * @param id - Original reservation UUID to split.
   * @param organizationId - Organization UUID expected to own the reservation.
   * @param hotelId - Hotel UUID expected to match the reservation.
   * @param input - Split payload containing split date and optional new room type.
   * @param splitBy - Optional actor identifier recorded on the generated booking.
   * @returns Object containing mapped original and new reservation responses.
   * @throws {NotFoundError} When reservation or requested replacement room type cannot be found in scope.
   * @throws {ForbiddenError} When the reservation belongs to another organization.
   * @throws {ConflictError} When reservation is already checked in and therefore unsplittable.
   * @throws {BadRequestError} When split date is outside the stay window or no room type can be resolved.
   * @remarks Complexity: O(1) local calculations plus transactional repository writes for split persistence.
   */
  async split(
    id: string,
    organizationId: string,
    hotelId: string,
    input: SplitReservationInput,
    splitBy?: string
  ): Promise<{ original: ReservationResponse; new: ReservationResponse }> {
    const reservation = await this.reservationsRepo.findById(id);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    if (reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation ${id} not found`);
    }

    if (reservation.status === 'CHECKED_IN') {
      throw new ConflictError('Cannot split checked-in reservation');
    }

    // Validate split date is within stay
    if (input.splitDate <= reservation.checkInDate || input.splitDate >= reservation.checkOutDate) {
      throw new BadRequestError('Split date must be within reservation dates');
    }

    // Calculate nights for each part
    const originalNights = Math.ceil(
      (input.splitDate.getTime() - reservation.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newNights = reservation.nights - originalNights;

    // Create new confirmation number
    const newConfirmationNumber = await this.reservationsRepo.generateConfirmationNumber(
      reservation.hotelId
    );

    // Determine room type for the new reservation
    const resWithRooms = reservation as ReservationWithRelations;
    const originalRoomTypeId = resWithRooms.rooms?.[0]?.roomTypeId;
    const newRoomTypeId = input.newRoomTypeId || originalRoomTypeId;
    if (!newRoomTypeId) {
      throw new BadRequestError('Cannot split reservation: room type not found');
    }

    // Validate newRoomTypeId if provided
    if (input.newRoomTypeId) {
      const roomType = await this.roomTypeRepo.findById(input.newRoomTypeId);
      if (!roomType || roomType.hotelId !== reservation.hotelId) {
        throw new NotFoundError(`Room type ${input.newRoomTypeId} not found`);
      }
    }

    const { original, new: newRes } = await this.reservationsRepo.splitReservation(
      id,
      input.splitDate,
      {
        organizationId: reservation.organizationId,
        hotelId: reservation.hotelId,
        guestId: reservation.guestId,
        confirmationNumber: newConfirmationNumber,
        externalRef: null,
        source: reservation.source,
        channelCode: reservation.channelCode,
        agentId: reservation.agentId,
        corporateCode: reservation.corporateCode,
        checkInDate: input.splitDate,
        checkOutDate: reservation.checkOutDate,
        arrivalTime: reservation.arrivalTime,
        departureTime: reservation.departureTime,
        nights: newNights,
        status: 'CONFIRMED',
        checkInStatus: 'NOT_CHECKED_IN',
        adultCount: reservation.adultCount,
        childCount: reservation.childCount,
        infantCount: reservation.infantCount,
        currencyCode: reservation.currencyCode,
        totalAmount: reservation.totalAmount * (newNights / reservation.nights),
        taxAmount: reservation.taxAmount * (newNights / reservation.nights),
        discountAmount: 0,
        paidAmount: 0,
        balance: reservation.totalAmount * (newNights / reservation.nights),
        ratePlanId: reservation.ratePlanId,
        rateBreakdown: [],
        averageRate: reservation.averageRate,
        cancellationPolicy: reservation.cancellationPolicy,
        guaranteeType: reservation.guaranteeType,
        guaranteeAmount: reservation.guaranteeAmount,
        cardToken: reservation.cardToken,
        cardLastFour: reservation.cardLastFour,
        cardExpiryMonth: reservation.cardExpiryMonth,
        cardExpiryYear: reservation.cardExpiryYear,
        cardBrand: reservation.cardBrand,
        guestNotes: reservation.guestNotes,
        specialRequests: reservation.specialRequests,
        internalNotes: `Split from ${reservation.confirmationNumber}`,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        cancellationFee: null,
        noShow: false,
        bookedAt: new Date(),
        bookedBy: splitBy || 'SYSTEM',
        modifiedAt: new Date(),
        modifiedBy: null,
      },
      {
        roomTypeId: newRoomTypeId,
        roomId: null,
        roomRate: reservation.averageRate,
        adultCount: reservation.adultCount,
        childCount: reservation.childCount,
        status: 'RESERVED',
      }
    );

    logger.info(
      `Reservation split: ${reservation.confirmationNumber} -> ${newConfirmationNumber}`,
      {
        originalId: id,
        newId: newRes.id,
        splitDate: input.splitDate,
      }
    );

    return {
      original: this.mapToResponse(original as ReservationWithRelations),
      new: this.mapToResponse(newRes as ReservationWithRelations),
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Verifies that a hotel exists in organization scope.
   *
   * @param organizationId - Organization UUID.
   * @param hotelId - Hotel UUID.
   * @returns Resolves when the hotel is accessible.
   * @throws {NotFoundError} When the hotel is not found in the organization.
   */
  /**
   * Verifies the hotel belongs to the organization before serving reservation operations.
   *
   * @param organizationId - Organization UUID expected to own the hotel.
   * @param hotelId - Hotel UUID being accessed.
   * @returns Resolves when the organization-hotel scope is valid.
   * @throws {NotFoundError} When the hotel does not exist in the organization scope.
   */
  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel ${hotelId} not found`);
    }
  }

  /**
   * Calculates stay financials from a rate plan using date overrides and fixed tax placeholder.
   *
   * It fetches overrides for the stay once, maps them by ISO date key, computes nightly rate/tax
   * rows, then derives total, tax, and average values for reservation persistence.
   *
   * @param _hotelId - Hotel UUID placeholder for future hotel-specific tax logic.
   * @param _roomTypeId - Room type UUID placeholder for occupancy pricing extensions.
   * @param ratePlanId - Rate plan UUID used for base pricing and overrides.
   * @param checkIn - Stay start date.
   * @param checkOut - Stay end date.
   * @param _adults - Adult count placeholder for future pricing dimensions.
   * @param _children - Child count placeholder for future pricing dimensions.
   * @returns Total, tax, average, and nightly breakdown for reservation totals.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @remarks Complexity: O(N) where `N` is stay nights.
   */
  /**
   * Calculates stay pricing by combining rate-plan base rate, per-night overrides, and tax.
   *
   * The method loads all overrides in one query, indexes them by business-date string, iterates each
   * night in the stay, and emits a nightly breakdown plus aggregate totals used by reservation writes.
   *
   * @param _hotelId - Hotel UUID placeholder for future hotel-specific pricing logic.
   * @param _roomTypeId - Room type UUID placeholder for future room-type pricing logic.
   * @param ratePlanId - Rate plan UUID used to resolve base and override pricing.
   * @param checkIn - Inclusive check-in date.
   * @param checkOut - Exclusive check-out date.
   * @param _adults - Adult occupancy count placeholder for future dynamic pricing.
   * @param _children - Child occupancy count placeholder for future dynamic pricing.
   * @returns Pricing totals and nightly breakdown entries used by reservation financial fields.
   * @throws {NotFoundError} When the referenced rate plan cannot be resolved.
   * @remarks Complexity: O(n + m) where `n` is nights in stay and `m` is override rows for the range.
   * @example
   * const rates = await this.calculateRates(hotelId, roomTypeId, ratePlanId, checkIn, checkOut, 2, 0);
   */
  private async calculateRates(
    _hotelId: string,
    _roomTypeId: string,
    ratePlanId: string,
    checkIn: Date,
    checkOut: Date,
    _adults: number,
    _children: number
  ): Promise<{ total: number; tax: number; average: number; breakdown: RateBreakdownItem[] }> {
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan) {
      throw new NotFoundError(`Rate plan ${ratePlanId} not found`);
    }

    // Fetch all overrides for the full date range at once to avoid N+1 queries
    const allOverrides = await this.ratePlanRepo.getOverrides(ratePlanId, checkIn, checkOut);
    const overridesByDate = new Map(
      allOverrides.map((o: { date: Date; rate: number }) => [
        o.date.toISOString().split('T')[0],
        o.rate,
      ])
    );

    const breakdown: RateBreakdownItem[] = [];
    let subtotal = 0;

    const current = new Date(checkIn);
    for (let i = 0; i < nights; i++) {
      const dateKey = current.toISOString().split('T')[0] as string;
      const dailyRate = overridesByDate.get(dateKey) ?? ratePlan.baseRate;

      const taxRate = 0.15; // Simplified - would use actual tax engine
      const tax = Math.round(dailyRate * taxRate * 100) / 100;

      breakdown.push({
        date: dateKey,
        rate: dailyRate,
        tax,
        total: dailyRate + tax,
      });

      subtotal += dailyRate;
      current.setDate(current.getDate() + 1);
    }

    const totalTax = Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + totalTax) * 100) / 100;

    return {
      total,
      tax: totalTax,
      average: Math.round((subtotal / nights) * 100) / 100,
      breakdown,
    };
  }

  /**
   * Calculates cancellation fee based on policy severity and time before check-in.
   *
   * @param reservation - Reservation containing cancellation policy and financial totals.
   * @returns Cancellation fee amount.
   */
  /**
   * Computes cancellation fee amount from policy strictness and hours remaining before check-in.
   *
   * @param reservation - Reservation used to read policy, check-in timestamp, and total amount.
   * @returns Monetary fee to charge in reservation currency, or `0` when policy grants free cancellation.
   */
  private calculateCancellationFee(reservation: Reservation): number {
    const now = new Date();
    const checkIn = new Date(reservation.checkInDate);
    const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

    switch (reservation.cancellationPolicy) {
      case 'FLEXIBLE':
        return hoursUntilCheckIn < 24 ? reservation.totalAmount * 0.5 : 0;
      case 'MODERATE':
        return hoursUntilCheckIn < 48 ? reservation.totalAmount * 0.5 : 0;
      case 'STRICT':
        return hoursUntilCheckIn < 72 ? reservation.totalAmount : 0;
      case 'NON_REFUNDABLE':
        return reservation.totalAmount;
      default:
        return 0;
    }
  }

  /**
   * Calculates no-show fee according to cancellation policy.
   *
   * @param reservation - Reservation containing policy and financial fields.
   * @returns No-show fee rounded to two decimals.
   */
  /**
   * Computes no-show fee amount from cancellation policy semantics.
   *
   * @param reservation - Reservation used to evaluate no-show fee policy.
   * @returns Rounded no-show charge in reservation currency units.
   */
  private calculateNoShowFee(reservation: Reservation): number {
    switch (reservation.cancellationPolicy) {
      case 'NON_REFUNDABLE':
      case 'STRICT':
        return Math.round(reservation.totalAmount * 100) / 100;
      default:
        return Math.round(reservation.averageRate * 100) / 100;
    }
  }

  /**
   * Parses an `HH:mm` time string into a Date value on the current day.
   *
   * @param timeStr - Time string in 24-hour `HH:mm` format.
   * @returns Date with parsed hour/minute and zeroed seconds.
   */
  /**
   * Parses an `HH:mm` string into a Date anchored to the current local calendar day.
   *
   * @param timeStr - Time string in 24-hour format.
   * @returns Date with hours/minutes set and seconds/milliseconds reset to zero.
   */
  private parseTime(timeStr: string): Date {
    const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Maps reservation entities with relations into the public response contract.
   *
   * @param reservation - Reservation with guest and room relation data.
   * @returns Response object grouped by lifecycle, guest, room, and financial sections.
   */
  /**
   * Maps reservation entities and relations into the API response contract.
   *
   * @param reservation - Reservation aggregate including guest and reservation-room relations.
   * @returns Response object containing reservation status, stay dates, room details, and financial totals.
   * @remarks Complexity: O(r) where `r` is number of associated reservation-room records.
   */
  private mapToResponse(reservation: ReservationWithRelations): ReservationResponse {
    const primaryGuest = reservation.guest;

    return {
      id: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      externalRef: reservation.externalRef,

      status: {
        reservation: reservation.status,
        checkIn: reservation.checkInStatus,
      },

      dates: {
        checkIn: reservation.checkInDate,
        checkOut: reservation.checkOutDate,
        arrivalTime: reservation.arrivalTime,
        departureTime: reservation.departureTime,
        nights: reservation.nights,
      },

      guests: {
        primaryGuestId: reservation.guestId,
        primaryGuestName: primaryGuest
          ? `${primaryGuest.firstName} ${primaryGuest.lastName}`
          : 'Unknown',
        adultCount: reservation.adultCount,
        childCount: reservation.childCount,
        infantCount: reservation.infantCount,
        totalGuests: reservation.adultCount + reservation.childCount + reservation.infantCount,
      },

      rooms:
        reservation.rooms?.map((r) => ({
          id: r.id,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomType?.name || 'Unknown',
          roomTypeCode: r.roomType?.code || 'N/A',
          roomId: r.roomId,
          roomNumber: r.room?.roomNumber || null,
          status: r.status,
          roomRate: r.roomRate,
          assignedAt: r.assignedAt,
          checkInAt: r.checkInAt,
          checkOutAt: r.checkOutAt,
        })) || [],

      financial: {
        currencyCode: reservation.currencyCode,
        nightlyRates: (reservation.rateBreakdown as RateBreakdownItem[]) || [],
        averageRate: reservation.averageRate,
        subtotal: reservation.totalAmount - reservation.taxAmount,
        taxAmount: reservation.taxAmount,
        discountAmount: reservation.discountAmount,
        totalAmount: reservation.totalAmount,
        paidAmount: reservation.paidAmount,
        balance: reservation.balance,
      },

      source: {
        bookingSource: reservation.source,
        channelCode: reservation.channelCode,
        bookedAt: reservation.bookedAt,
        bookedBy: reservation.bookedBy,
      },

      policies: {
        cancellationPolicy: reservation.cancellationPolicy,
        guaranteeType: reservation.guaranteeType,
        guaranteeAmount: reservation.guaranteeAmount,
      },

      notes: {
        guestNotes: reservation.guestNotes,
        specialRequests: reservation.specialRequests,
        internalNotes: reservation.internalNotes,
      },

      cancellation: reservation.cancelledAt
        ? {
            cancelledAt: reservation.cancelledAt,
            cancelledBy: reservation.cancelledBy || 'Unknown',
            reason: reservation.cancellationReason || 'No reason provided',
            fee: reservation.cancellationFee || 0,
          }
        : null,

      createdAt: reservation.createdAt,
      modifiedAt: reservation.modifiedAt,
    };
  }
}

export const reservationsService = new ReservationsService();
