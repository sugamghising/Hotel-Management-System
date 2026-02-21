import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import type { Prisma } from '../../generated/prisma';
import { type OrganizationService, organizationService } from '../organizations';
import type { HotelListResponse } from './hotel.dto';
import { type HotelRepostiory, hotelRepository } from './hotel.repository';
import type {
  CreateHotelInput,
  Hotel,
  HotelCloneInput,
  HotelDashboardData,
  HotelOperationalSettings,
  HotelPolicies,
  HotelQueryFilters,
  HotelResponse,
  HotelStats,
  RoomStatusSummary,
  UpdateHotelInput,
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
      logger.warn(`Hotel code '${input.code}' already exists in this organization`);
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
  // READ
  // ============================================================================

  async findById(
    id: string,
    organizationId?: string,
    includeStats: boolean = false
  ): Promise<HotelResponse> {
    const hotel = await this.hotelRepo.findById(id);

    if (!hotel || hotel.deletedAt) {
      throw new NotFoundError(`Hotel not Found ${id}`);
    }

    if (organizationId && hotel.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this hotel');
    }

    let stats: HotelStats | undefined;
    if (includeStats) {
      stats = await this.getHotelStats(id);
    }

    return this.mapToResponse(hotel, stats);
  }

  async findByOrganization(
    organizationId: string,
    filters: HotelQueryFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<HotelListResponse> {
    const { hotels, total } = await this.hotelRepo.findByOrganization(
      organizationId,
      filters,
      pagination
    );

    return {
      hotels: hotels.map((h) => ({
        id: h.id,
        code: h.code,
        name: h.name,
        propertyType: h.propertyType,
        starRating: h.starRating,
        city: h.city,
        countryCode: h.countryCode,
        status: h.status,
        totalRooms: h.totalRooms,
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
    input: UpdateHotelInput,
    updatedBy?: string
  ): Promise<HotelResponse> {
    const hotel = await this.hotelRepo.findById(id);

    if (!hotel || hotel.deletedAt) {
      throw new NotFoundError(`Hotel not Found ${id}`);
    }

    if (hotel.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this hotel');
    }

    // Prevent changing code
    // Note: Code changes would break external references

    // Build update data with proper type conversions
    const updateData: Prisma.HotelUpdateInput = {
      updatedBy: updatedBy || null,
    };

    // Copy simple scalar fields
    if (input.name !== undefined) updateData.name = input.name;
    if (input.legalName !== undefined) updateData.legalName = input.legalName;
    if (input.brand !== undefined) updateData.brand = input.brand;
    if (input.starRating !== undefined) updateData.starRating = input.starRating;
    if (input.propertyType !== undefined) updateData.propertyType = input.propertyType;

    // Contact fields
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.fax !== undefined) updateData.fax = input.fax;
    if (input.website !== undefined) updateData.website = input.website;

    // Address fields
    if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.stateProvince !== undefined) updateData.stateProvince = input.stateProvince;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.countryCode !== undefined) updateData.countryCode = input.countryCode;

    // Geolocation
    if (input.latitude !== undefined) updateData.latitude = input.latitude;
    if (input.longitude !== undefined) updateData.longitude = input.longitude;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;

    // Operational fields with time conversion
    if (input.checkInTime) {
      updateData.checkInTime = this.parseTimeString(input.checkInTime);
    }
    if (input.checkOutTime) {
      updateData.checkOutTime = this.parseTimeString(input.checkOutTime);
    }
    if (input.currencyCode !== undefined) updateData.currencyCode = input.currencyCode;
    if (input.defaultLanguage !== undefined) updateData.defaultLanguage = input.defaultLanguage;

    // JSON fields with proper type casting
    if (input.operationalSettings !== undefined) {
      updateData.operationalSettings = input.operationalSettings as Prisma.InputJsonValue;
    }
    if (input.amenities !== undefined) {
      updateData.amenities = input.amenities as Prisma.InputJsonValue;
    }
    if (input.policies !== undefined) {
      updateData.policies = input.policies as Prisma.InputJsonValue;
    }

    // Status fields
    if (input.status !== undefined) updateData.status = input.status;
    if (input.openingDate !== undefined) updateData.openingDate = input.openingDate;
    if (input.closingDate !== undefined) updateData.closingDate = input.closingDate;

    const updated = await this.hotelRepo.update(id, updateData);

    logger.info(`Hotel updated: ${updated.name}`, { hotelId: id });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  async delete(id: string, organizationId: string, deletedBy?: string): Promise<void> {
    const hotel = await this.hotelRepo.findById(id);

    if (!hotel || hotel.deletedAt) {
      throw new NotFoundError(`Hotel not found: ${id}`);
    }

    if (hotel.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this hotel');
    }

    // Check for active reservations
    const activeReservations = await this.countActiveReservations(id);
    if (activeReservations > 0) {
      throw new BadRequestError(
        `Cannot delete hotel with ${activeReservations} active reservations. Please cancel or complete all reservations first.`
      );
    }

    await this.hotelRepo.softDelete(id);

    logger.warn(`Hotel deleted: ${hotel.name}`, {
      hotelId: id,
      deletedBy,
      orgId: organizationId,
    });
  }

  // ============================================================================
  // DASHBOARD & STATS
  // ============================================================================

  async getDashboard(hotelId: string, organizationId: string): Promise<HotelDashboardData> {
    const hotel = await this.findById(hotelId, organizationId, true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, roomStatus] = await Promise.all([
      this.hotelRepo.getTodayStats(hotelId, today),
      this.hotelRepo.getRoomStatusCount(hotelId),
    ]);

    const totalRooms = hotel.capacity.totalRooms;
    const occupied = (roomStatus?.['OCCUPIED_CLEAN'] || 0) + (roomStatus?.['OCCUPIED_DIRTY'] || 0);
    const occupancyPercent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

    // Generate alerts
    const alerts: HotelDashboardData['alerts'] = [];

    if ((roomStatus?.['VACANT_DIRTY'] || 0) > 5) {
      alerts.push({
        type: 'WARNING',
        message: `${roomStatus?.['VACANT_DIRTY']} rooms need cleaning`,
        entityType: 'HOUSEKEEPING',
      });
    }

    if ((roomStatus?.['OUT_OF_ORDER'] || 0) > 0) {
      alerts.push({
        type: 'INFO',
        message: `${roomStatus?.['OUT_OF_ORDER']} rooms out of order`,
        entityType: 'MAINTENANCE',
      });
    }

    // Check for overdue checkouts
    const overdueCheckouts = await this.countOverdueCheckouts(hotelId);
    if (overdueCheckouts > 0) {
      alerts.push({
        type: 'WARNING',
        message: `${overdueCheckouts} guests overdue for checkout`,
        entityType: 'RESERVATION',
      });
    }

    return {
      hotel,
      today: {
        date: today.toISOString().split('T')[0] as string,
        ...todayStats,
        occupancyPercent,
      },
      roomStatus: {
        vacantClean: roomStatus?.['VACANT_CLEAN'] || 0,
        vacantDirty: roomStatus?.['VACANT_DIRTY'] || 0,
        occupiedClean: roomStatus?.['OCCUPIED_CLEAN'] || 0,
        occupiedDirty: roomStatus?.['OCCUPIED_DIRTY'] || 0,
        outOfOrder: roomStatus?.['OUT_OF_ORDER'] || 0,
      },
      alerts,
    };
  }

  async getRoomStatusSummary(hotelId: string, organizationId: string): Promise<RoomStatusSummary> {
    await this.verifyAccess(hotelId, organizationId);

    const [counts, byType] = await Promise.all([
      this.hotelRepo.getRoomStatusCount(hotelId),
      this.hotelRepo.getRoomTypeAvailability(hotelId),
    ]);

    const total = Object.values(counts).reduce((a: number, b: number) => a + b, 0);

    interface RoomTypeRow {
      roomTypeId: string;
      roomTypeName: string;
      roomTypeCode: string;
      total: string;
      available: string;
      occupied: string;
      ooo: string;
    }

    return {
      total,
      byStatus: counts,
      byType: (byType as RoomTypeRow[]).map((rt) => ({
        roomTypeId: rt.roomTypeId,
        roomTypeName: rt.roomTypeName,
        roomTypeCode: rt.roomTypeCode,
        total: Number.parseInt(rt.total),
        available: Number.parseInt(rt.available),
        occupied: Number.parseInt(rt.occupied),
        ooo: Number.parseInt(rt.ooo),
      })),
    };
  }

  // ============================================================================
  // CLONE
  // ============================================================================

  async clone(
    sourceHotelId: string,
    organizationId: string,
    input: HotelCloneInput,
    createdBy?: string
  ): Promise<HotelResponse> {
    const source = await this.hotelRepo.findById(sourceHotelId);
    if (!source || source.deletedAt) {
      throw new NotFoundError(`Source hotel not found: ${sourceHotelId}`);
    }

    // Verify access to source
    if (source.organizationId !== organizationId && !input.targetOrganizationId) {
      throw new ForbiddenError('Access denied to source hotel');
    }

    const targetOrgId = input.targetOrganizationId || organizationId;

    // Check limits if cloning to different org
    if (targetOrgId !== source.organizationId) {
      // TODO: Implement limit checking when checkLimits method is available
      // const limitCheck = await this.orgService.checkLimits(targetOrgId);
      // if (!limitCheck.hotels.canAdd) {
      //     throw new BadRequestError('Target organization hotel limit reached');
      // }
    }

    // Check code uniqueness in target org
    const existing = await this.hotelRepo.findByCode(targetOrgId, input.newCode);
    if (existing) {
      throw new ConflictError(`Hotel code '${input.newCode}' already exists`);
    }

    const cloned = await this.hotelRepo.cloneHotel(
      sourceHotelId,
      {
        organizationId: targetOrgId,
        code: input.newCode,
        name: input.newName,
      },
      {
        copyRoomTypes: input.copyRoomTypes,
        copyRatePlans: input.copyRatePlans,
        copySettings: input.copySettings,
      }
    );

    logger.info(`Hotel cloned: ${source.name} -> ${cloned.name}`, {
      sourceId: sourceHotelId,
      newId: cloned.id,
      createdBy,
    });

    return this.mapToResponse(cloned);
  }

  // ============================================================================
  // AVAILABILITY
  // ============================================================================

  async getAvailabilityCalendar(
    hotelId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date,
    roomTypeId?: string
  ): Promise<unknown[]> {
    await this.verifyAccess(hotelId, organizationId);

    const inventory = await this.hotelRepo.getAvailabilityCalendar(
      hotelId,
      startDate,
      endDate,
      roomTypeId
    );

    interface InventoryRow {
      date: Date;
      roomTypeId: string;
      roomType: { code: string; name: string };
      totalRooms: number;
      sold: number;
      available: number;
      outOfOrder: number;
      blocked: number;
      overbookingLimit: number;
      stopSell: boolean;
      minStay: number;
      maxStay: number;
      closedToArrival: boolean;
      closedToDeparture: boolean;
      rateOverride: number | null;
    }

    return (inventory as InventoryRow[]).map((inv) => ({
      date: inv.date.toISOString().split('T')[0],
      roomTypeId: inv.roomTypeId,
      roomTypeCode: inv.roomType.code,
      roomTypeName: inv.roomType.name,
      totalRooms: inv.totalRooms,
      sold: inv.sold,
      available: inv.available,
      outOfOrder: inv.outOfOrder,
      blocked: inv.blocked,
      overbookingLimit: inv.overbookingLimit,
      stopSell: inv.stopSell,
      minStay: inv.minStay,
      maxStay: inv.maxStay,
      closedToArrival: inv.closedToArrival,
      closedToDeparture: inv.closedToDeparture,
      rateOverride: inv.rateOverride,
    }));
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  async getSettings(hotelId: string, organizationId: string): Promise<Record<string, unknown>> {
    const hotel = await this.hotelRepo.findById(hotelId);
    if (!hotel || hotel.deletedAt) {
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }
    if (hotel.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return {
      operational: hotel.operationalSettings,
      policies: hotel.policies,
      amenities: hotel.amenities,
    };
  }

  async updateSettings(
    hotelId: string,
    organizationId: string,
    settings: {
      operational?: Record<string, unknown>;
      policies?: Record<string, unknown>;
      amenities?: string[];
    },
    updatedBy?: string
  ): Promise<void> {
    const hotel = await this.hotelRepo.findById(hotelId);
    if (!hotel || hotel.deletedAt) {
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }
    if (hotel.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const updateData: Prisma.HotelUpdateInput = { updatedBy: updatedBy || null };

    if (settings.operational) {
      updateData.operationalSettings = {
        ...(hotel.operationalSettings as Record<string, unknown>),
        ...settings.operational,
      } as Prisma.InputJsonValue;
    }

    if (settings.policies) {
      updateData.policies = {
        ...(hotel.policies as Record<string, unknown>),
        ...settings.policies,
      } as Prisma.InputJsonValue;
    }

    if (settings.amenities) {
      updateData.amenities = settings.amenities as Prisma.InputJsonValue;
    }

    await this.hotelRepo.update(hotelId, updateData);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async verifyAccess(hotelId: string, organizationId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      logger.warn(`Hotel not found: ${hotelId}`);
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
