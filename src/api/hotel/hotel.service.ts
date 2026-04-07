import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import type { Prisma } from '../../generated/prisma';
import { type OrganizationService, organizationService } from '../organizations';
import type {
  CloneHotelInput,
  CreateHotelInput,
  HotelListResponse,
  UpdateHotelInput,
} from './hotel.dto';
import { type HotelRepository, hotelRepository } from './hotel.repository';
import type {
  Hotel,
  HotelDashboardData,
  HotelOperationalSettings,
  HotelPolicies,
  HotelQueryFilters,
  HotelResponse,
  HotelStats,
  RoomStatusSummary,
} from './hotel.types';

export class HotelService {
  private hotelRepo: HotelRepository;
  private orgService: OrganizationService;

  /**
   * Creates a hotel service with repository and organization-service dependencies.
   *
   * @param hotelRepo - Repository used for hotel persistence.
   * @param orgService - Service used for organization-level validations.
   */
  constructor(
    hotelRepo: HotelRepository = hotelRepository,
    orgService: OrganizationService = organizationService
  ) {
    this.hotelRepo = hotelRepo;
    this.orgService = orgService;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  /**
   * Creates a hotel inside an organization after validating scope and uniqueness.
   *
   * Validates organization access, enforces organization-scoped hotel code
   * uniqueness, normalizes defaults (code casing, check-in/out times, locale
   * values), and persists the hotel as an active property.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param input - Validated hotel creation payload.
   * @param createdBy - Optional user UUID stored in audit fields.
   * @returns API-facing hotel response.
   * @throws {ConflictError} Thrown when hotel code already exists in the organization.
   */
  async create(
    organizationId: string,
    input: CreateHotelInput,
    createdBy?: string
  ): Promise<HotelResponse> {
    //Check Organization exists and has capacity
    await this.orgService.findById(organizationId);

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

  /**
   * Retrieves a hotel by identifier with optional organization-scope and stats checks.
   *
   * @param id - Hotel UUID.
   * @param organizationId - Optional organization UUID for access enforcement.
   * @param includeStats - When `true`, enriches response with computed hotel stats.
   * @returns Hotel response payload.
   * @throws {NotFoundError} Thrown when hotel does not exist or is soft-deleted.
   * @throws {ForbiddenError} Thrown when the hotel belongs to a different organization.
   */
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

  /**
   * Lists hotels for an organization with filter and pagination support.
   *
   * @param organizationId - Organization UUID scope.
   * @param filters - Optional hotel filters.
   * @param pagination - Page and page-size settings.
   * @returns Hotel list with pagination metadata.
   */
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

  /**
   * Updates mutable hotel fields while preserving organization ownership rules.
   *
   * Performs existence and ownership checks, builds a Prisma update payload from
   * defined inputs only, converts check-in/check-out time strings to UTC dates,
   * and persists only intended field changes.
   *
   * @param id - Hotel UUID to update.
   * @param organizationId - Organization UUID scope for access control.
   * @param input - Partial hotel update payload.
   * @param updatedBy - Optional user UUID for audit tracking.
   * @returns Updated hotel response.
   * @throws {NotFoundError} Thrown when hotel does not exist.
   * @throws {ForbiddenError} Thrown when hotel is outside organization scope.
   */
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

  /**
   * Soft-deletes a hotel after reservation and ownership validations.
   *
   * @param id - Hotel UUID to delete.
   * @param organizationId - Organization UUID scope.
   * @param deletedBy - Optional user UUID stored in delete logs.
   * @returns Resolves when deletion completes.
   * @throws {NotFoundError} Thrown when hotel does not exist.
   * @throws {ForbiddenError} Thrown when organization scope is invalid.
   * @throws {BadRequestError} Thrown when active reservations still exist.
   */
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

  /**
   * Builds hotel dashboard data for the current UTC day.
   *
   * Combines hotel metadata, same-day reservation stats, room-status counts,
   * occupancy percentage, and operational alerts (dirty rooms, out-of-order
   * rooms, overdue checkouts) into one response payload.
   *
   * @param hotelId - Hotel UUID.
   * @param organizationId - Organization UUID scope.
   * @returns Aggregated dashboard payload.
   * @throws {NotFoundError} Thrown when hotel access validation fails.
   * @remarks Complexity: O(s + t) where `s` is status bucket count and `t` is alert checks.
   */
  async getDashboard(hotelId: string, organizationId: string): Promise<HotelDashboardData> {
    const hotel = await this.findById(hotelId, organizationId, true);

    const today = new Date();
    const utcToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    const [todayStats, roomStatus] = await Promise.all([
      this.hotelRepo.getTodayStats(hotelId, utcToday),
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
        date: utcToday.toISOString().split('T')[0] as string,
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

  /**
   * Returns room inventory summary grouped by status and room type.
   *
   * @param hotelId - Hotel UUID.
   * @param organizationId - Organization UUID scope.
   * @returns Room status totals and per-room-type availability metrics.
   * @throws {NotFoundError} Thrown when hotel access validation fails.
   * @remarks Complexity: O(s + r) where `s` is status bucket count and `r` is room-type rows.
   */
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

  /**
   * Clones an existing hotel into the same or another organization.
   *
   * Verifies source visibility, enforces target code uniqueness, and delegates
   * transactional cloning of hotel profile and optional related artifacts to the
   * repository layer.
   *
   * @param sourceHotelId - Source hotel UUID.
   * @param organizationId - Requesting organization UUID.
   * @param input - Clone configuration including target identifiers and copy flags.
   * @param createdBy - Optional user UUID used for audit logs.
   * @returns Cloned hotel response.
   * @throws {NotFoundError} Thrown when source hotel is missing.
   * @throws {ForbiddenError} Thrown when source access is not allowed.
   * @throws {ConflictError} Thrown when target hotel code already exists.
   */
  async clone(
    sourceHotelId: string,
    organizationId: string,
    input: CloneHotelInput,
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

  /**
   * Returns availability calendar rows for a hotel and date range.
   *
   * @param hotelId - Hotel UUID.
   * @param organizationId - Organization UUID scope.
   * @param startDate - Inclusive range start.
   * @param endDate - Inclusive range end.
   * @param roomTypeId - Optional room-type UUID filter.
   * @returns Availability entries normalized for API output.
   * @throws {NotFoundError} Thrown when hotel access validation fails.
   */
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

  /**
   * Retrieves hotel operational settings, policies, and amenities.
   *
   * @param hotelId - Hotel UUID.
   * @param organizationId - Organization UUID scope.
   * @returns Settings object grouped into operational, policies, and amenities sections.
   * @throws {NotFoundError} Thrown when hotel does not exist.
   * @throws {ForbiddenError} Thrown when hotel is outside organization scope.
   */
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

  /**
   * Merges and updates hotel settings with organization-scope validation.
   *
   * Existing operational settings and policies are shallow-merged with
   * incoming values; amenities are fully replaced when provided.
   *
   * @param hotelId - Hotel UUID.
   * @param organizationId - Organization UUID scope.
   * @param settings - Partial settings payload.
   * @param updatedBy - Optional user UUID for audit tracking.
   * @returns Resolves when settings update is persisted.
   * @throws {NotFoundError} Thrown when hotel does not exist.
   * @throws {ForbiddenError} Thrown when hotel is outside organization scope.
   */
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

  /**
   * Ensures a hotel exists within an organization scope.
   *
   * @param hotelId - Hotel UUID to validate.
   * @param organizationId - Organization UUID scope.
   * @returns Resolves when hotel access is valid.
   * @throws {NotFoundError} Thrown when hotel is missing from the organization.
   */
  private async verifyAccess(hotelId: string, organizationId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      logger.warn(`Hotel not found: ${hotelId}`);
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }
  }

  /**
   * Computes aggregate hotel statistics used in detailed hotel responses.
   *
   * Combines room-type/room counters with same-day reservation metrics and
   * derives occupancy percentage from in-house guests against room capacity.
   *
   * @param hotelId - Hotel UUID.
   * @returns Aggregated hotel stats.
   * @remarks Complexity: O(1) application work with five parallel repository calls.
   */
  private async getHotelStats(hotelId: string): Promise<HotelStats> {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

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

  /**
   * Returns room-type count for a hotel.
   *
   * @param _hotelId - Hotel UUID.
   * @returns Placeholder value until room-type repository integration is implemented.
   */
  private async countRoomTypes(_hotelId: string): Promise<number> {
    // Would use roomType repository in full implementation
    return 0; // Placeholder
  }

  /**
   * Returns room count for a hotel.
   *
   * @param _hotelId - Hotel UUID.
   * @returns Placeholder value until room repository integration is implemented.
   */
  private async countRooms(_hotelId: string): Promise<number> {
    // Would use room repository in full implementation
    return 0; // Placeholder
  }

  /**
   * Returns room count for selected statuses.
   *
   * @param _hotelId - Hotel UUID.
   * @param _statuses - Status codes to include.
   * @returns Placeholder value until room repository integration is implemented.
   */
  private async countRoomsByStatus(_hotelId: string, _statuses: string[]): Promise<number> {
    // Would use room repository in full implementation
    return 0; // Placeholder
  }

  /**
   * Returns active reservation count for a hotel.
   *
   * @param _hotelId - Hotel UUID.
   * @returns Never resolves successfully in current implementation.
   * @throws {Error} Always thrown because reservation counting is not yet implemented.
   */
  private async countActiveReservations(_hotelId: string): Promise<number> {
    // Would use reservation repository in full implementation
    throw new Error('countActiveReservations is not implemented');
  }

  /**
   * Returns overdue checkout count for a hotel.
   *
   * @param _hotelId - Hotel UUID.
   * @returns Placeholder value until reservation repository integration is implemented.
   */
  private async countOverdueCheckouts(_hotelId: string): Promise<number> {
    // Would use reservation repository in full implementation
    return 0; // Placeholder
  }

  /**
   * Converts an `HH:mm` time string to a UTC date anchored at 1970-01-01.
   *
   * @param timeStr - Time string in 24-hour `HH:mm` format.
   * @returns UTC date containing the parsed time components.
   */
  private parseTimeString(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0, 0, 0));
  }

  /**
   * Formats a UTC date value to an `HH:mm` time string.
   *
   * @param date - Date containing UTC time components.
   * @returns Zero-padded `HH:mm` string.
   */
  private formatTimeString(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Maps a hotel entity and optional computed stats into API response shape.
   *
   * @param hotel - Hotel domain entity.
   * @param stats - Optional computed stats block.
   * @returns Structured hotel response DTO.
   */
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

export const hotelService = new HotelService();
