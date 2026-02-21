import { BadRequestError, ConflictError, NotFoundError, logger } from '../../core';
import type { Prisma } from '../../generated/prisma';
import { type OrganizationService, organizationService } from '../organizations';
import { type HotelRepostiory, hotelRepository } from './hotel.repository';
import type {
  CreateHotelInput,
  Hotel,
  HotelOperationalSettings,
  HotelPolicies,
  HotelResponse,
  HotelStats,
} from './hotel.types';

export class HotelService {
  private hotelRepo: HotelRepostiory;
  private orgService: OrganizationService;
  constructor(
    hotelRepo: HotelRepostiory = hotelRepository,
    orgService: OrganizationService = organizationService
  ) {
    this.hotelRepo = hotelRepo;
    this.orgService = orgService;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  async create(
    organizationId: string,
    input: CreateHotelInput,
    createdBy?: string
  ): Promise<HotelResponse> {
    //Check Organization exists and has capacity
    const org = await this.orgService.findById(organizationId);
    if (!org) {
      logger.warn(`Organization doesn't exist with id ${organizationId}. `);
      throw new BadRequestError(`Organization doesn't exist with id ${organizationId}. `);
    }

    // TODO: Implement limit checking when checkLimits method is available
    // const limitCheck = await this.orgService.checkLimits(organizationId);
    // if (!limitCheck.hotels.canAdd) {
    //     throw new BadRequestError(
    //         `Hotel limit reached: ${limitCheck.hotels.used}/${limitCheck.hotels.max}`
    //     );
    // }

    // Check code uniqueness within organization
    const existing = await this.hotelRepo.findByCode(organizationId, input.code);
    if (existing) {
      throw new ConflictError(`Hotel code '${input.code}' already exists in this organization`);
    }

    // Convert time strings to Date objects for storage
    const checkInTime = this.parseTimeString(input.checkInTime || '15:00');
    const checkOutTime = this.parseTimeString(input.checkOutTime || '11:00');

    const hotel = await this.hotelRepo.create({
      organization: {
        connect: { id: organizationId },
      },
      code: input.code.toUpperCase(),
      name: input.name,
      legalName: input.legalName || null,
      brand: input.brand || null,
      propertyType: input.propertyType || 'HOTEL',
      starRating: input.starRating || null,
      email: input.email,
      phone: input.phone,
      fax: input.fax || null,
      website: input.website || null,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 || null,
      city: input.city,
      stateProvince: input.stateProvince || null,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      timezone: input.timezone || 'UTC',
      checkInTime,
      checkOutTime,
      currencyCode: input.currencyCode || 'USD',
      defaultLanguage: input.defaultLanguage || 'en',
      totalRooms: 0,
      totalFloors: input.totalFloors || null,
      operationalSettings: (input.operationalSettings || {}) as Prisma.InputJsonValue,
      amenities: (input.amenities || []) as Prisma.InputJsonValue,
      policies: (input.policies || {}) as Prisma.InputJsonValue,
      status: input.status || 'ACTIVE',
      openingDate: input.openingDate || null,
      createdBy: createdBy || null,
      updatedBy: createdBy || null,
    });

    logger.info(`Hotel created: ${hotel.name} (${hotel.code})`, {
      hotelId: hotel.id,
      orgId: organizationId,
    });

    return this.mapToResponse(hotel);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async verifyAccess(hotelId: string, organizationId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }
  }

  private async getHotelStats(hotelId: string): Promise<HotelStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [roomTypesCount, roomsCount, activeRoomsCount, oooRoomsCount, todayStats] =
      await Promise.all([
        this.countRoomTypes(hotelId),
        this.countRooms(hotelId),
        this.countRoomsByStatus(hotelId, [
          'VACANT_CLEAN',
          'VACANT_DIRTY',
          'OCCUPIED_CLEAN',
          'OCCUPIED_DIRTY',
        ]),
        this.countRoomsByStatus(hotelId, ['OUT_OF_ORDER']),
        this.hotelRepo.getTodayStats(hotelId, today),
      ]);

    const occupancyRate = roomsCount > 0 ? Math.round((todayStats.inHouse / roomsCount) * 100) : 0;

    return {
      roomTypesCount,
      roomsCount,
      activeRoomsCount,
      oooRoomsCount,
      todayArrivals: todayStats.arrivals,
      todayDepartures: todayStats.departures,
      inHouseGuests: todayStats.inHouse,
      occupancyRate,
    };
  }

  private async countRoomTypes(_hotelId: string): Promise<number> {
    // Would use roomType repository in full implementation
    return 0; // Placeholder
  }

  private async countRooms(_hotelId: string): Promise<number> {
    // Would use room repository in full implementation
    return 0; // Placeholder
  }

  private async countRoomsByStatus(_hotelId: string, _statuses: string[]): Promise<number> {
    // Would use room repository in full implementation
    return 0; // Placeholder
  }

  private async countActiveReservations(_hotelId: string): Promise<number> {
    // Would use reservation repository in full implementation
    return 0; // Placeholder
  }

  private async countOverdueCheckouts(_hotelId: string): Promise<number> {
    // Would use reservation repository in full implementation
    return 0; // Placeholder
  }

  private parseTimeString(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return date;
  }

  private formatTimeString(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private mapToResponse(hotel: Hotel, stats?: HotelStats): HotelResponse {
    return {
      id: hotel.id,
      organizationId: hotel.organizationId,
      code: hotel.code,
      name: hotel.name,
      legalName: hotel.legalName,
      brand: hotel.brand,
      propertyType: hotel.propertyType,
      starRating: hotel.starRating,

      contact: {
        email: hotel.email,
        phone: hotel.phone,
        fax: hotel.fax,
        website: hotel.website,
      },

      address: {
        line1: hotel.addressLine1,
        line2: hotel.addressLine2,
        city: hotel.city,
        stateProvince: hotel.stateProvince,
        postalCode: hotel.postalCode,
        countryCode: hotel.countryCode,
        fullAddress: [
          hotel.addressLine1,
          hotel.addressLine2,
          `${hotel.city}, ${hotel.stateProvince || ''} ${hotel.postalCode}`,
          hotel.countryCode,
        ]
          .filter(Boolean)
          .join(', '),
      },

      location: {
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        timezone: hotel.timezone,
      },

      operations: {
        checkInTime: this.formatTimeString(hotel.checkInTime),
        checkOutTime: this.formatTimeString(hotel.checkOutTime),
        currencyCode: hotel.currencyCode,
        defaultLanguage: hotel.defaultLanguage,
      },

      capacity: {
        totalRooms: hotel.totalRooms,
        totalFloors: hotel.totalFloors,
      },

      configuration: {
        amenities: hotel.amenities as string[],
        operationalSettings: hotel.operationalSettings as HotelOperationalSettings,
        policies: hotel.policies as HotelPolicies,
      },

      status: hotel.status,
      dates: {
        openingDate: hotel.openingDate,
        closingDate: hotel.closingDate,
        createdAt: hotel.createdAt,
        updatedAt: hotel.updatedAt,
      },

      ...(stats && { stats }),
    };
  }
}
