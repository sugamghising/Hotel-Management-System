import {
  BadRequestError,
  ConflictError,
  ExpressCheckoutNotEligibleError,
  ForbiddenError,
  NoRoomsAvailableError,
  NotFoundError,
  OutstandingBalanceError,
  logger,
} from '../../core';
import { folioService } from '../folio/folio.service';
import type { RoomAssignmentInput } from '../reservations';
import { reservationsService } from '../reservations/reservations.service';
import {
  type CheckinCheckoutRepository,
  checkinCheckoutRepository,
} from './checkinCheckout.repository';
import type {
  CheckInRequestInput,
  CheckoutInput,
  EarlyCheckInInput,
  ExtendStayInput,
  LateCheckoutInput,
  NoShowInput,
  ShortenStayInput,
  WalkInCheckInInput,
} from './checkinCheckout.schema';
import type {
  FrontDeskDashboardResponse,
  ReservationStatusResponse,
  RoomGridItem,
} from './checkinCheckout.types';

export class CheckinCheckoutService {
  private checkinCheckoutRepo: CheckinCheckoutRepository;

  /**
   * Creates a check-in/check-out service with an overridable repository dependency.
   *
   * @param repo - Repository implementation used for room and front-desk data access.
   */
  constructor(repo: CheckinCheckoutRepository = checkinCheckoutRepository) {
    this.checkinCheckoutRepo = repo;
  }

  /**
   * Returns reservations scheduled to arrive today for a hotel.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID whose arrivals are requested.
   * @returns A list of today's arrival reservations from the reservations service.
   */
  async getTodayArrivals(organizationId: string, hotelId: string) {
    return reservationsService.getTodayArrivals(hotelId, organizationId);
  }

  /**
   * Returns reservations scheduled to depart today for a hotel.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID whose departures are requested.
   * @returns A list of today's departure reservations from the reservations service.
   */
  async getTodayDepartures(organizationId: string, hotelId: string) {
    return reservationsService.getTodayDepartures(hotelId, organizationId);
  }

  /**
   * Builds pre-check-in context for front-desk workflows.
   *
   * It loads reservation details, validates folio checkout state, and returns currently
   * available rooms so the caller can decide whether manual or automatic room assignment
   * is needed before check-in.
   *
   * @param organizationId - Organization UUID used for reservation and room scope checks.
   * @param hotelId - Hotel UUID used for reservation and room scope checks.
   * @param reservationId - Reservation UUID being prepared for check-in.
   * @returns Reservation context, folio validation, room options, and express-checkout eligibility.
   * @remarks Complexity: O(1) application work with 3 service/repository calls.
   */
  async getPreCheckInData(organizationId: string, hotelId: string, reservationId: string) {
    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);

    const folioValidation = await folioService.validateCheckout(
      reservationId,
      organizationId,
      hotelId
    );

    const availableRooms = await this.checkinCheckoutRepo.findAvailableRooms(
      organizationId,
      hotelId
    );

    return {
      reservation,
      folioValidation,
      availableRooms,
      expressCheckoutEligible: folioValidation.balance <= 0,
    };
  }

  /**
   * Checks a guest in and optionally places a pre-authorization hold.
   *
   * The method determines room assignment mode (`'MANUAL'`, `'INITIAL'`, or `'AUTO'`),
   * optionally processes a card authorization hold, and forwards normalized payload fields
   * to the reservations service check-in operation.
   *
   * @param organizationId - Organization UUID used for access and ownership scope.
   * @param hotelId - Hotel UUID where the reservation is being checked in.
   * @param reservationId - Reservation UUID to check in.
   * @param input - Check-in payload including optional room and payment hold data.
   * @param userId - Optional actor ID recorded in downstream operations.
   * @returns The updated reservation and optional pre-authorization payment details.
   * @remarks Complexity: O(1) application work with sequential reservation and optional payment calls.
   * @example
   * const result = await service.checkIn(organizationId, hotelId, reservationId, {
   *   roomId: 'room-uuid',
   *   cardToken: 'tok_123',
   * });
   */
  async checkIn(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: CheckInRequestInput,
    userId?: string
  ) {
    const reservationSnapshot = await reservationsService.findById(
      reservationId,
      organizationId,
      hotelId
    );

    let preAuth = null;
    let preAuthAmount: number | undefined;
    const assignmentType: 'INITIAL' | 'AUTO' | 'MANUAL' = input.roomId
      ? 'MANUAL'
      : reservationSnapshot.rooms[0]?.roomId
        ? 'INITIAL'
        : 'AUTO';

    if (input.cardToken) {
      preAuthAmount = this.calculatePreAuthAmount(
        reservationSnapshot.financial.totalAmount,
        reservationSnapshot.dates.nights
      );

      const paymentInput = {
        amount: preAuthAmount,
        currencyCode: reservationSnapshot.financial.currencyCode,
        method: 'CREDIT_CARD' as const,
        cardToken: input.cardToken,
        notes: 'Check-in authorization hold',
        ...(input.cardLastFour !== undefined ? { cardLastFour: input.cardLastFour } : {}),
        ...(input.cardBrand !== undefined ? { cardBrand: input.cardBrand } : {}),
      };

      preAuth = await folioService.processPayment(
        reservationId,
        organizationId,
        paymentInput,
        userId
      );
    }

    const checkInInput = {
      ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
      ...(input.earlyCheckIn !== undefined ? { earlyCheckIn: input.earlyCheckIn } : {}),
      assignmentType,
      ...(preAuthAmount !== undefined ? { preAuthAmount } : {}),
      ...(input.keysIssued !== undefined ? { keysIssued: input.keysIssued } : {}),
      ...(input.keyCardRef !== undefined ? { keyCardRef: input.keyCardRef } : {}),
      ...(input.idDocumentId !== undefined ? { idDocumentId: input.idDocumentId } : {}),
      ...(input.checkInNotes !== undefined ? { notes: input.checkInNotes } : {}),
    };

    const reservation = await reservationsService.checkIn(
      reservationId,
      organizationId,
      hotelId,
      checkInInput,
      userId
    );

    return {
      reservation,
      preAuth,
      ...(preAuthAmount !== undefined ? { preAuthAmount } : {}),
    };
  }

  /**
   * Performs check-in with early-arrival semantics and optional early check-in fee posting.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the reservation is checked in.
   * @param reservationId - Reservation UUID to check in early.
   * @param input - Early check-in input including optional fee amount and reason.
   * @param userId - Optional actor ID used for audit attribution.
   * @returns The same payload returned by {@link checkIn}.
   * @remarks Complexity: O(1) plus an additional folio charge write when a fee applies.
   */
  async earlyCheckIn(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: EarlyCheckInInput,
    userId?: string
  ) {
    const result = await this.checkIn(
      organizationId,
      hotelId,
      reservationId,
      {
        ...input,
        earlyCheckIn: true,
      },
      userId
    );

    const feeAmount =
      input.earlyFeeAmount ??
      this.calculateEarlyCheckInFee(result.reservation.financial.averageRate);

    if (feeAmount > 0) {
      await folioService.postCharge(
        reservationId,
        organizationId,
        {
          itemType: 'SERVICE_CHARGE',
          description: input.earlyFeeReason || 'Early check-in fee',
          amount: feeAmount,
          taxAmount: 0,
          quantity: 1,
          unitPrice: feeAmount,
          revenueCode: 'EARLY_CI',
          department: 'ROOMS',
          source: 'CHECKIN',
        },
        userId
      );
    }

    return result;
  }

  /**
   * Creates and checks in a walk-in reservation in one operation.
   *
   * @param organizationId - Organization UUID used for reservation scope.
   * @param hotelId - Hotel UUID receiving the walk-in guest.
   * @param input - Walk-in payload with guest, room, and payment preferences.
   * @param userId - Optional actor ID used for reservation auditing.
   * @returns The newly created walk-in reservation.
   */
  async walkInCheckIn(
    organizationId: string,
    hotelId: string,
    input: WalkInCheckInInput,
    userId?: string
  ) {
    const walkInInput = {
      guestId: input.guestId,
      roomTypeId: input.roomTypeId,
      roomId: input.roomId,
      ratePlanId: input.ratePlanId,
      checkOutDate: input.checkOutDate,
      adultCount: input.adultCount || 2,
      childCount: input.childCount || 0,
      infantCount: input.infantCount || 0,
      paymentMethod: input.paymentMethod,
      initialPayment: input.initialPayment,
      checkInDate: new Date(),
      source: 'DIRECT_WALKIN' as const,
      isWalkIn: true,
      guaranteeType: 'NONE' as const,
      ...(input.cardToken !== undefined ? { cardToken: input.cardToken } : {}),
      ...(input.cardLastFour !== undefined ? { cardLastFour: input.cardLastFour } : {}),
      ...(input.cardBrand !== undefined ? { cardBrand: input.cardBrand } : {}),
      ...(input.guestNotes !== undefined ? { guestNotes: input.guestNotes } : {}),
      ...(input.specialRequests !== undefined ? { specialRequests: input.specialRequests } : {}),
    };

    const reservation = await reservationsService.createWalkIn(
      organizationId,
      hotelId,
      walkInInput,
      userId
    );

    return { reservation };
  }

  /**
   * Assigns a room to a reservation through the reservations service.
   *
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID where assignment is performed.
   * @param reservationId - Reservation UUID to update.
   * @param input - Assignment payload describing room and assignment mode.
   * @param userId - Optional actor ID used for audit attribution.
   * @returns The updated reservation returned by the reservations service.
   */
  async assignRoom(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: RoomAssignmentInput,
    userId?: string
  ) {
    return reservationsService.assignRoom(reservationId, organizationId, hotelId, input, userId);
  }

  /**
   * Auto-assigns the first clean vacant room that matches the reservation room type.
   *
   * @param organizationId - Organization UUID expected to own the reservation and room.
   * @param hotelId - Hotel UUID expected to own the reservation and room.
   * @param reservationId - Reservation UUID to auto-assign.
   * @param userId - Optional actor ID recorded on assignment.
   * @returns The updated reservation plus assigned room identifiers for UI consumption.
   * @throws {NotFoundError} When the reservation does not exist or is deleted.
   * @throws {ForbiddenError} When the reservation does not belong to the provided organization/hotel scope.
   * @throws {BadRequestError} When the reservation has no room type to drive auto-assignment.
   * @throws {NoRoomsAvailableError} When no clean vacant room is available for the requested room type.
   */
  async autoAssignRoom(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    userId?: string
  ) {
    const reservation = await this.checkinCheckoutRepo.findReservationWithRooms(reservationId);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${reservationId} not found`);
    }

    if (reservation.organizationId !== organizationId || reservation.hotelId !== hotelId) {
      throw new ForbiddenError('Access denied');
    }

    const roomTypeId = reservation.rooms[0]?.roomTypeId;
    if (!roomTypeId) {
      throw new BadRequestError('Reservation room type not found');
    }

    const room = await this.checkinCheckoutRepo.findFirstVacantCleanRoomByType(
      organizationId,
      hotelId,
      roomTypeId
    );

    if (!room) {
      throw new NoRoomsAvailableError('No suitable room available for auto-assignment');
    }

    const updated = await this.assignRoom(
      organizationId,
      hotelId,
      reservationId,
      {
        roomId: room.id,
        assignmentType: 'AUTO',
        force: false,
      },
      userId
    );
    return {
      reservation: updated,
      assignedRoomId: room.id,
      assignedRoomNumber: room.roomNumber,
    };
  }

  /**
   * Changes a reservation to a higher-grade room and optionally posts an upgrade fee.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the room change is applied.
   * @param reservationId - Reservation UUID being upgraded.
   * @param roomId - Target room UUID.
   * @param userId - Optional actor ID used for room move and charge posting.
   * @param upgradeFee - Optional fee amount posted as an adjustment charge when positive.
   * @param upgradeReason - Optional reason attached to room assignment metadata.
   * @returns The reservation after room reassignment.
   */
  async upgradeRoom(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    roomId: string,
    userId?: string,
    upgradeFee?: number,
    upgradeReason?: string
  ) {
    const currentReservation = await reservationsService.findById(
      reservationId,
      organizationId,
      hotelId
    );
    const previousRoomId = currentReservation.rooms[0]?.roomId;

    const reservation = await this.assignRoom(
      organizationId,
      hotelId,
      reservationId,
      {
        roomId,
        assignmentType: 'UPGRADE',
        force: true,
        ...(upgradeReason !== undefined ? { reason: upgradeReason } : {}),
        ...(previousRoomId ? { previousRoomId } : {}),
      },
      userId
    );

    if (upgradeFee && upgradeFee > 0) {
      await folioService.postCharge(
        reservationId,
        organizationId,
        {
          itemType: 'ADJUSTMENT',
          description: 'Room upgrade fee',
          amount: upgradeFee,
          taxAmount: 0,
          quantity: 1,
          unitPrice: upgradeFee,
          revenueCode: 'UPGRADE',
          department: 'ROOMS',
          source: 'ROOM_UPGRADE',
        },
        userId
      );
    }

    return reservation;
  }

  /**
   * Performs an in-stay room move without applying upgrade billing.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the room move occurs.
   * @param reservationId - Reservation UUID to update.
   * @param roomId - Target room UUID.
   * @param userId - Optional actor ID recorded on reassignment.
   * @param changeReason - Optional reason stored with assignment metadata.
   * @returns The reservation after room reassignment.
   */
  async changeRoom(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    roomId: string,
    userId?: string,
    changeReason?: string
  ) {
    const currentReservation = await reservationsService.findById(
      reservationId,
      organizationId,
      hotelId
    );
    const previousRoomId = currentReservation.rooms[0]?.roomId;

    return this.assignRoom(
      organizationId,
      hotelId,
      reservationId,
      {
        roomId,
        assignmentType: 'CHANGE',
        force: true,
        ...(changeReason !== undefined ? { reason: changeReason } : {}),
        ...(previousRoomId ? { previousRoomId } : {}),
      },
      userId
    );
  }

  /**
   * Returns checkout preview data for a reservation.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where checkout is being prepared.
   * @param reservationId - Reservation UUID to preview.
   * @returns Reservation details, full folio snapshot, checkout validation, and express eligibility flag.
   */
  async checkoutPreview(organizationId: string, hotelId: string, reservationId: string) {
    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);
    const folio = await folioService.getFolio(reservationId, organizationId);
    const validation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

    return {
      reservation,
      folio,
      expressCheckoutEligible: validation.balance <= 0,
      validation,
    };
  }

  /**
   * Executes the standard checkout flow including settlement and invoice creation.
   *
   * The method validates folio state, optionally settles outstanding balance, revalidates
   * checkout requirements, completes reservation checkout, and creates/sends the final invoice.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where checkout is performed.
   * @param reservationId - Reservation UUID to check out.
   * @param input - Checkout payload including optional payment and guest feedback fields.
   * @param userId - Optional actor ID recorded by downstream services.
   * @returns The checked-out reservation and generated invoice response.
   * @throws {ConflictError} When checkout blockers remain after validation.
   * @throws {OutstandingBalanceError} When balance is due and no payment method is provided.
   * @remarks Complexity: O(1) application work with multiple sequential service/database calls.
   * @example
   * const result = await service.checkOut(organizationId, hotelId, reservationId, {
   *   paymentMethod: 'CASH',
   *   invoiceEmail: 'guest@example.com',
   * });
   */
  async checkOut(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: CheckoutInput,
    userId?: string
  ) {
    const validation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

    const OUTSTANDING_BALANCE_ISSUE = 'outstanding balance';
    const issues = validation.issues ?? [];
    const nonBalanceIssues = issues.filter(
      (issue) => !issue.toLowerCase().includes(OUTSTANDING_BALANCE_ISSUE)
    );

    if (!validation.canCheckout && nonBalanceIssues.length > 0) {
      throw new ConflictError(`Cannot check out: ${nonBalanceIssues.join('; ')}`);
    }

    if (validation.balance > 0 && !input.paymentMethod) {
      throw new OutstandingBalanceError('Outstanding balance requires a payment method', {
        balance: validation.balance,
      });
    }

    const settlementAmount = validation.balance > 0 ? validation.balance : 0;

    if (validation.balance > 0 && input.paymentMethod) {
      const paymentInput = {
        amount: validation.balance,
        method: input.paymentMethod,
        currencyCode: 'USD',
        notes: 'Checkout settlement',
        ...(input.cardToken !== undefined ? { cardToken: input.cardToken } : {}),
      };

      await folioService.processPayment(
        reservationId,
        organizationId,
        paymentInput,
        userId,
        hotelId
      );
    }

    const finalValidation = await folioService.validateCheckout(
      reservationId,
      organizationId,
      hotelId
    );

    if (!finalValidation.canCheckout) {
      throw new ConflictError(`Cannot check out: ${finalValidation.issues.join('; ')}`);
    }

    const reservation = await reservationsService.checkOut(
      reservationId,
      organizationId,
      hotelId,
      {
        lateCheckOut: false,
        finalBalance: finalValidation.balance,
        ...(settlementAmount > 0 ? { settlementAmount } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.keysReturned !== undefined ? { keysReturned: input.keysReturned } : {}),
        ...(input.satisfactionScore !== undefined
          ? { satisfactionScore: input.satisfactionScore }
          : {}),
        ...(input.checkOutNotes !== undefined ? { notes: input.checkOutNotes } : {}),
      },
      userId
    );

    const invoiceInput =
      reservation.guests?.primaryGuestName !== undefined
        ? { billToName: reservation.guests.primaryGuestName }
        : {};

    const invoice = await folioService.createInvoice(
      reservationId,
      organizationId,
      invoiceInput,
      userId,
      hotelId
    );

    if (input.invoiceEmail) {
      await folioService.sendInvoice(invoice.id, organizationId, input.invoiceEmail);
    }

    return {
      reservation,
      invoice,
    };
  }

  /**
   * Executes a fast checkout path that requires a near-zero folio balance.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where checkout is performed.
   * @param reservationId - Reservation UUID to check out.
   * @param input - Checkout payload from which only invoice email is forwarded.
   * @param userId - Optional actor ID recorded by downstream services.
   * @returns The same checkout payload returned by {@link checkOut}.
   * @throws {ExpressCheckoutNotEligibleError} When folio validation is not checkout-ready with near-zero balance.
   */
  async expressCheckout(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: CheckoutInput,
    userId?: string
  ) {
    const validation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

    if (!validation.canCheckout || Math.abs(validation.balance) > 0.01) {
      throw new ExpressCheckoutNotEligibleError('Express checkout requires a zero-balance folio', {
        balance: validation.balance,
        issues: validation.issues,
      });
    }

    const checkoutInput: CheckoutInput = {
      ...(input.invoiceEmail !== undefined ? { invoiceEmail: input.invoiceEmail } : {}),
    };

    return this.checkOut(organizationId, hotelId, reservationId, checkoutInput, userId);
  }

  /**
   * Applies optional late-checkout fee posting and returns the latest reservation snapshot.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where late checkout handling occurs.
   * @param reservationId - Reservation UUID receiving late-checkout handling.
   * @param input - Late checkout options including fee behavior.
   * @param userId - Optional actor ID used when posting charges.
   * @returns The reservation fetched after optional fee posting.
   */
  async lateCheckout(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: LateCheckoutInput,
    userId?: string
  ) {
    if (input.applyFee) {
      const amount = input.feeAmount ?? input.extraHours * 25;
      await folioService.postCharge(
        reservationId,
        organizationId,
        {
          itemType: 'SERVICE_CHARGE',
          description: input.reason || `Late checkout fee (${input.extraHours} hour(s))`,
          amount,
          taxAmount: 0,
          quantity: 1,
          unitPrice: amount,
          revenueCode: 'LATE_CO',
          department: 'ROOMS',
          source: 'CHECKOUT',
        },
        userId
      );
    }

    return reservationsService.findById(reservationId, organizationId, hotelId);
  }

  /**
   * Marks a reservation as no-show using reservations service semantics.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the reservation exists.
   * @param reservationId - Reservation UUID to mark as no-show.
   * @param input - No-show input including fee and reason options.
   * @param userId - Optional actor ID recorded by downstream services.
   * @returns The updated reservation returned by the reservations service.
   */
  async markNoShow(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: NoShowInput,
    userId?: string
  ) {
    return reservationsService.markNoShow(
      reservationId,
      organizationId,
      hotelId,
      {
        chargeNoShowFee: input.chargeNoShowFee,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
      userId
    );
  }

  /**
   * Reinstates a reservation previously marked as `'NO_SHOW'` or `'CANCELLED'`.
   *
   * @param organizationId - Organization UUID expected to own the reservation.
   * @param hotelId - Hotel UUID expected to own the reservation.
   * @param reservationId - Reservation UUID to reinstate.
   * @param reason - Human-readable reinstatement reason saved into internal notes.
   * @param userId - Optional actor ID used for modification auditing.
   * @returns The refreshed reservation after reinstatement.
   * @throws {NotFoundError} When the reservation does not exist or is deleted.
   * @throws {ForbiddenError} When scope does not match the reservation owner.
   * @throws {ConflictError} When reservation status is neither `'NO_SHOW'` nor `'CANCELLED'`.
   */
  async reinstate(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    reason: string,
    userId?: string
  ) {
    const reservation = await this.checkinCheckoutRepo.findReservationById(reservationId);

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation ${reservationId} not found`);
    }

    if (reservation.organizationId !== organizationId || reservation.hotelId !== hotelId) {
      throw new ForbiddenError('Access denied');
    }

    if (!['NO_SHOW', 'CANCELLED'].includes(reservation.status)) {
      throw new ConflictError('Only NO_SHOW or CANCELLED reservations can be reinstated');
    }

    await this.checkinCheckoutRepo.reinstateReservation(
      reservationId,
      reason,
      userId || 'SYSTEM',
      reservation.internalNotes
    );

    logger.info('Reservation reinstated', { reservationId, reason });

    return reservationsService.findById(reservationId, organizationId, hotelId);
  }

  /**
   * Builds the front-desk dashboard summary for the current business day.
   *
   * @param organizationId - Organization UUID whose dashboard is requested.
   * @param hotelId - Hotel UUID whose dashboard is requested.
   * @returns Occupancy, arrival/departure progress, and in-house counts for front-desk UI.
   * @remarks Complexity: O(1) application work using aggregated counters from repository queries.
   */
  async getFrontDeskDashboard(
    organizationId: string,
    hotelId: string
  ): Promise<FrontDeskDashboardResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const businessDate = today.toISOString().slice(0, 10);

    const {
      totalRooms,
      occupied,
      available,
      outOfOrder,
      arrivals,
      departures,
      inHouse,
      checkedInToday,
      checkedOutToday,
    } = await this.checkinCheckoutRepo.getFrontDeskCounts(organizationId, hotelId, today);

    return {
      businessDate,
      occupancy: {
        totalRooms,
        occupied,
        available,
        outOfOrder,
        occupancyRate: totalRooms > 0 ? Number(((occupied / totalRooms) * 100).toFixed(2)) : 0,
      },
      arrivals: {
        expected: arrivals,
        checkedIn: checkedInToday,
        pending: Math.max(arrivals - checkedInToday, 0),
      },
      departures: {
        expected: departures,
        checkedOut: checkedOutToday,
        pending: Math.max(departures - checkedOutToday, 0),
      },
      inHouseCount: inHouse,
    };
  }

  /**
   * Returns a room-grid projection for front-desk and housekeeping views.
   *
   * @param organizationId - Organization UUID that owns the room inventory.
   * @param hotelId - Hotel UUID whose rooms are listed.
   * @returns Room grid rows with room status, room type code, and housekeeping priority.
   */
  async getRoomGrid(organizationId: string, hotelId: string): Promise<RoomGridItem[]> {
    const rooms = await this.checkinCheckoutRepo.findRoomGrid(organizationId, hotelId);

    return rooms.map((room) => ({
      roomId: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      status: room.status,
      roomTypeCode: room.roomType?.code || null,
      housekeepingPriority: room.cleaningPriority,
    }));
  }

  /**
   * Returns currently in-house guests for a hotel.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID whose in-house guests are requested.
   * @returns In-house guest reservations from the reservations service.
   */
  async getInHouse(organizationId: string, hotelId: string) {
    return reservationsService.getInHouseGuests(hotelId, organizationId);
  }

  /**
   * Returns reservation state together with folio checkout validation.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the reservation exists.
   * @param reservationId - Reservation UUID to inspect.
   * @returns Reservation details and folio validation data for checkout decisioning.
   */
  async getReservationStatus(
    organizationId: string,
    hotelId: string,
    reservationId: string
  ): Promise<ReservationStatusResponse> {
    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);
    const folioValidation = await folioService.validateCheckout(
      reservationId,
      organizationId,
      hotelId
    );

    return { reservation, folioValidation };
  }

  /**
   * Extends a stay by updating reservation check-out date.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the reservation exists.
   * @param reservationId - Reservation UUID to update.
   * @param input - Extension input containing the new check-out date.
   * @param userId - Optional actor ID recorded by downstream services.
   * @returns The updated reservation from the reservations service.
   * @throws {BadRequestError} When `newCheckOutDate` is not after the current check-out date.
   */
  async extendStay(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: ExtendStayInput,
    userId?: string
  ) {
    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);

    if (input.newCheckOutDate <= reservation.dates.checkOut) {
      throw new BadRequestError('New check-out date must be after current check-out date');
    }

    return reservationsService.update(
      reservationId,
      organizationId,
      hotelId,
      {
        checkOutDate: input.newCheckOutDate,
      },
      userId
    );
  }

  /**
   * Shortens a stay by moving check-out date earlier within the existing stay window.
   *
   * @param organizationId - Organization UUID used for access scope.
   * @param hotelId - Hotel UUID where the reservation exists.
   * @param reservationId - Reservation UUID to update.
   * @param input - Shorten-stay input containing the new check-out date.
   * @param userId - Optional actor ID recorded by downstream services.
   * @returns The updated reservation from the reservations service.
   * @throws {BadRequestError} When the new date is not between check-in and current check-out.
   */
  async shortenStay(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: ShortenStayInput,
    userId?: string
  ) {
    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);

    if (input.newCheckOutDate <= reservation.dates.checkIn) {
      throw new BadRequestError('New check-out date must be after check-in date');
    }

    if (input.newCheckOutDate >= reservation.dates.checkOut) {
      throw new BadRequestError('New check-out date must be before current check-out date');
    }

    return reservationsService.update(
      reservationId,
      organizationId,
      hotelId,
      {
        checkOutDate: input.newCheckOutDate,
      },
      userId
    );
  }

  /**
   * Calculates a pre-authorization hold amount using total stay value and nightly incidental hold.
   *
   * @param totalAmount - Reservation total amount used as the base hold input.
   * @param nights - Number of stay nights used for incidental hold calculation.
   * @returns Rounded pre-authorization amount in the reservation currency context.
   */
  private calculatePreAuthAmount(totalAmount: number, nights: number): number {
    const incidentalHoldPerNight = 25;
    const baseHold = totalAmount * 1.2;
    return Number((baseHold + nights * incidentalHoldPerNight).toFixed(2));
  }

  /**
   * Calculates early check-in fee based on local hour thresholds.
   *
   * @param averageRate - Reservation average nightly rate.
   * @param now - Optional timestamp used to evaluate fee tier, defaults to current time.
   * @returns `50%` of average rate before 06:00, `25%` before 10:00, otherwise `0`.
   */
  private calculateEarlyCheckInFee(averageRate: number, now: Date = new Date()): number {
    const hour = now.getHours();
    if (hour < 6) {
      return Number((averageRate * 0.5).toFixed(2));
    }

    if (hour < 10) {
      return Number((averageRate * 0.25).toFixed(2));
    }

    return 0;
  }
}

export const checkinCheckoutService = new CheckinCheckoutService();
