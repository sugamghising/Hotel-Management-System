import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import { folioService } from '../folio/folio.service';
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

    const folioValidation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

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
    const checkInInput = {
      ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
      ...(input.earlyCheckIn !== undefined ? { earlyCheckIn: input.earlyCheckIn } : {}),
    };

    const reservation = await reservationsService.checkIn(
      reservationId,
      organizationId,
      hotelId,
      checkInInput,
      userId
    );

    let preAuth = null;
    if (input.cardToken) {
      const paymentInput = {
        amount: 1,
        currencyCode: 'USD',
        method: 'CREDIT_CARD' as const,
        cardToken: input.cardToken,
        notes: 'Check-in card verification hold',
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

    return {
      reservation,
      preAuth,
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

    if (input.earlyFeeAmount && input.earlyFeeAmount > 0) {
      await folioService.postCharge(
        reservationId,
        organizationId,
        {
          itemType: 'SERVICE_CHARGE',
          description: input.earlyFeeReason || 'Early check-in fee',
          amount: input.earlyFeeAmount,
          taxAmount: 0,
          quantity: 1,
          unitPrice: input.earlyFeeAmount,
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
    roomId: string,
    userId?: string,
    force?: boolean
  ) {
    const assignmentInput = {
      roomId,
      ...(force !== undefined ? { force } : {}),
    };

    return reservationsService.assignRoom(
      reservationId,
      organizationId,
      hotelId,
      assignmentInput,
      userId
    );
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
      throw new ConflictError('No suitable room available for auto-assignment');
    }

    const updated = await this.assignRoom(organizationId, hotelId, reservationId, room.id, userId);
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
    upgradeFee?: number
  ) {
    const reservation = await this.assignRoom(
      organizationId,
      hotelId,
      reservationId,
      roomId,
      userId,
      true
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
    userId?: string
  ) {
    return this.assignRoom(organizationId, hotelId, reservationId, roomId, userId, true);
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

    if (!validation.canCheckout) {
      throw new ConflictError(`Cannot check out: ${validation.issues.join('; ')}`);
    }

    if (validation.balance > 0 && !input.paymentMethod) {
      throw new ConflictError('Outstanding balance requires a payment method');
    }

    if (validation.balance > 0 && input.paymentMethod) {
      const paymentInput = {
        amount: validation.balance,
        method: input.paymentMethod,
        currencyCode: 'USD',
        notes: 'Checkout settlement',
        ...(input.cardToken !== undefined ? { cardToken: input.cardToken } : {}),
      };

      await folioService.processPayment(reservationId, organizationId, paymentInput, userId, hotelId);
    }

    const reservation = await reservationsService.checkOut(
      reservationId,
      organizationId,
      hotelId,
      {
        lateCheckOut: false,
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
    return this.checkOut(
      organizationId,
      hotelId,
      reservationId,
      input,
      userId
    );
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
    chargeNoShowFee: boolean,
    userId?: string
  ) {
    return reservationsService.markNoShow(
      reservationId,
      organizationId,
      hotelId,
      { chargeNoShowFee },
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
    const folioValidation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

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
}

export const checkinCheckoutService = new CheckinCheckoutService();
