import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
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
        externalRef: null,
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
    return this.checkIn(reservation.id, organizationId, { roomId: input.roomId }, createdBy);
  }

  // ============================================================================
  // READ
  // ============================================================================

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

    await this.reservationsRepo.checkIn(id, resRoom.id, roomId, resolvedInput.earlyCheckIn);

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

    await this.reservationsRepo.checkOut(
      id,
      resRoom.id,
      resRoom.roomId,
      organizationId,
      hotelId,
      input.lateCheckOut
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

    await this.reservationsRepo.assignRoom(resRoom.id, input.roomId, assignedBy || 'SYSTEM');

    logger.info(`Room assigned: ${reservation.confirmationNumber} -> ${room.roomNumber}`, {
      reservationId: id,
      roomId: input.roomId,
    });

    return this.findById(id, organizationId);
  }

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

    await this.reservationsRepo.markNoShow(id, input.chargeNoShowFee ?? false);

    logger.info(`No-show marked: ${reservation.confirmationNumber}`, {
      reservationId: id,
      chargeFee: input.chargeNoShowFee,
    });

    return this.findById(id, organizationId);
  }

  // ============================================================================
  // DASHBOARD QUERIES
  // ============================================================================

  async getTodayArrivals(hotelId: string, organizationId: string): Promise<ReservationResponse[]> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await this.reservationsRepo.getTodayArrivals(hotelId, today);
    return reservations.map((r) => this.mapToResponse(r));
  }

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

  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel ${hotelId} not found`);
    }
  }

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

  private parseTime(timeStr: string): Date {
    const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

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
