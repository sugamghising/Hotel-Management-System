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

  constructor(repo: CheckinCheckoutRepository = checkinCheckoutRepository) {
    this.checkinCheckoutRepo = repo;
  }

  async getTodayArrivals(organizationId: string, hotelId: string) {
    return reservationsService.getTodayArrivals(hotelId, organizationId);
  }

  async getTodayDepartures(organizationId: string, hotelId: string) {
    return reservationsService.getTodayDepartures(hotelId, organizationId);
  }

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

  async assignRoom(
    organizationId: string,
    hotelId: string,
    reservationId: string,
    input: RoomAssignmentInput,
    userId?: string
  ) {
    return reservationsService.assignRoom(reservationId, organizationId, hotelId, input, userId);
  }

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

  async getInHouse(organizationId: string, hotelId: string) {
    return reservationsService.getInHouseGuests(hotelId, organizationId);
  }

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

  private calculatePreAuthAmount(totalAmount: number, nights: number): number {
    const incidentalHoldPerNight = 25;
    const baseHold = totalAmount * 1.2;
    return Number((baseHold + nights * incidentalHoldPerNight).toFixed(2));
  }

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
