import { BadRequestError, ConflictError, NotFoundError, logger } from '../../core';
import { prisma } from '../../database/prisma';
import { type HotelRepository, hotelRepository } from '../hotel';
import { type RatePlansRepository, ratePlansRepository } from '../ratePlans';
import { type RoomTypesRepository, roomTypesRepository } from '../roomTypes';
import { type RoomsRepository, roomsRepository } from '../rooms';
import { type ReservationsRepository, reservationsRepository } from './reservations.repository';
import type {
  CreateReservationInput,
  RateBreakdownItem,
  Reservation,
  ReservationResponse,
  ReservationWithRelations,
} from './reservations.types';

export class ReservationService {
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

    const breakdown: RateBreakdownItem[] = [];
    let subtotal = 0;

    const current = new Date(checkIn);
    for (let i = 0; i < nights; i++) {
      // Check for override
      const overrides = await this.ratePlanRepo.getOverrides(ratePlanId, current, current);
      const dailyRate = overrides[0]?.rate || ratePlan.baseRate;

      const taxRate = 0.15; // Simplified - would use actual tax engine
      const tax = Math.round(dailyRate * taxRate * 100) / 100;

      breakdown.push({
        date: current.toISOString().split('T')[0] as string,
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
