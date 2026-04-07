import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type { Hotel, HotelStatus, PropertyType } from './hotel.types';

export type HotelWhereInput = Prisma.HotelWhereInput;
export type HotelCreateInput = Prisma.HotelCreateInput;
export type HotelUpdateInput = Prisma.HotelUpdateInput;

export class HotelRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Retrieves a hotel by identifier with optional relation includes.
   *
   * @param id - Hotel UUID.
   * @param include - Optional Prisma include graph.
   * @returns Matching hotel, or `null` when no row exists.
   */
  async findById(id: string, include?: Prisma.HotelInclude): Promise<Hotel | null> {
    return prisma.hotel.findUnique({
      where: { id },
      ...(include !== undefined && { include }),
    }) as Promise<Hotel | null>;
  }

  /**
   * Retrieves a hotel by organization and hotel code.
   *
   * @param organizationId - Organization UUID scope.
   * @param code - Hotel code; normalized to uppercase before lookup.
   * @returns Matching hotel, or `null` when absent.
   */
  async findByCode(organizationId: string, code: string): Promise<Hotel | null> {
    return prisma.hotel.findUnique({
      where: {
        uq_hotel_org_code: {
          organizationId,
          code: code.toUpperCase(),
        },
      },
    }) as Promise<Hotel | null>;
  }

  /**
   * Lists organization hotels with optional filters and pagination.
   *
   * Builds a dynamic Prisma `where` object that always scopes to the
   * organization and excludes soft-deleted rows, then fetches page data and
   * total count in parallel.
   *
   * @param organizationId - Organization UUID scope.
   * @param filters - Optional hotel filters for status, type, location, and search text.
   * @param pagination - Optional page and limit configuration.
   * @returns A hotel page plus total matching count.
   * @remarks Complexity: O(p) for result mapping plus two database queries.
   */
  async findByOrganization(
    organizationId: string,
    filters?: {
      status?: HotelStatus;
      propertyType?: PropertyType;
      countryCode?: string;
      city?: string;
      search?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ hotels: Hotel[]; total: number }> {
    const where: Prisma.HotelWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.propertyType) {
      where.propertyType = filters.propertyType;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search.toUpperCase() } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        where,
        ...(pagination && {
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.hotel.count({ where }),
    ]);
    return { hotels: hotels as Hotel[], total };
  }

  /**
   * Creates a hotel record.
   *
   * @param data - Prisma create payload for the hotel.
   * @returns Newly created hotel.
   */
  async create(data: HotelCreateInput): Promise<Hotel> {
    return prisma.hotel.create({ data }) as Promise<Hotel>;
  }

  /**
   * Updates a hotel by identifier.
   *
   * @param id - Hotel UUID to update.
   * @param data - Partial hotel update payload.
   * @returns Updated hotel.
   */
  async update(id: string, data: HotelUpdateInput): Promise<Hotel> {
    return prisma.hotel.update({
      where: {
        id,
      },
      data,
    }) as Promise<Hotel>;
  }

  /**
   * Soft-deletes a hotel and marks status as `'CLOSED'`.
   *
   * @param id - Hotel UUID to mark deleted.
   * @returns Resolves when the update completes.
   */
  async softDelete(id: string): Promise<void> {
    await prisma.hotel.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'CLOSED',
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // CAPACITY & COUNTS
  // ============================================================================

  /**
   * Recalculates and persists total active room count for a hotel.
   *
   * @param hotelId - Hotel UUID to recalculate.
   * @returns Resolves after count and update operations complete.
   */
  async updateRoomCount(hotelId: string): Promise<void> {
    const count = await prisma.room.count({
      where: { hotelId, deletedAt: null },
    });

    await prisma.hotel.update({
      where: { id: hotelId },
      data: { totalRooms: count },
    });
  }

  /**
   * Aggregates room counts by status for a hotel.
   *
   * @param hotelId - Hotel UUID scope.
   * @returns Map where keys are room statuses and values are counts.
   * @remarks Complexity: O(s) in number of grouped statuses returned.
   */
  async getRoomStatusCount(hotelId: string): Promise<Record<string, number>> {
    const results = await prisma.room.groupBy({
      by: ['status'],
      where: {
        hotelId,
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    });

    return results.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  // ============================================================================
  // AVAILABILITY & INVENTORY
  // ============================================================================

  /**
   * Returns room inventory rows for a date range and optional room type.
   *
   * @param hotelId - Hotel UUID scope.
   * @param startDate - Inclusive range start.
   * @param endDate - Inclusive range end.
   * @param roomTypeId - Optional room type UUID filter.
   * @returns Inventory rows ordered by room type then date.
   */
  async getAvailabilityCalendar(
    hotelId: string,
    startDate: Date,
    endDate: Date,
    roomTypeId?: string
  ): Promise<unknown[]> {
    const where: Prisma.RoomInventoryWhereInput = {
      roomType: { hotelId },
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    return prisma.roomInventory.findMany({
      where,
      include: {
        roomType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ roomTypeId: 'asc' }, { date: 'asc' }],
    });
  }

  // ============================================================================
  // DASHBOARD DATA
  // ============================================================================

  /**
   * Computes same-day arrivals, departures, and in-house reservation counts.
   *
   * @param hotelId - Hotel UUID scope.
   * @param businessDate - Business date used for reservation cutoffs.
   * @returns Dashboard counters for arrivals, departures, and in-house stays.
   * @remarks Complexity: O(1) in application code with three parallel DB counts.
   */
  async getTodayStats(
    hotelId: string,
    businessDate: Date
  ): Promise<{
    arrivals: number;
    departures: number;
    inHouse: number;
  }> {
    const [arrivals, departures, inHouse] = await Promise.all([
      // Arrivals today
      prisma.reservation.count({
        where: {
          hotelId,
          checkInDate: businessDate,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          deletedAt: null,
        },
      }),

      // Departures today
      prisma.reservation.count({
        where: {
          hotelId,
          checkOutDate: businessDate,
          status: { in: ['CHECKED_IN'] },
          deletedAt: null,
        },
      }),

      // Currently in house
      prisma.reservation.count({
        where: {
          hotelId,
          checkInDate: { lte: businessDate },
          checkOutDate: { gt: businessDate },
          status: 'CHECKED_IN',
          deletedAt: null,
        },
      }),
    ]);

    return { arrivals, departures, inHouse };
  }

  /**
   * Returns room availability metrics grouped by room type.
   *
   * @param hotelId - Hotel UUID scope.
   * @returns Raw SQL result rows containing total, available, occupied, and out-of-order counts.
   */
  async getRoomTypeAvailability(hotelId: string): Promise<unknown[]> {
    return prisma.$queryRaw`
      SELECT 
        rt.id as "roomTypeId",
        rt.code as "roomTypeCode",
        rt.name as "roomTypeName",
        COUNT(r.id) as total,
        COUNT(CASE WHEN r.status = 'VACANT_CLEAN' THEN 1 END) as available,
        COUNT(CASE WHEN r.status LIKE 'OCCUPIED%' THEN 1 END) as occupied,
        COUNT(CASE WHEN r.status = 'OUT_OF_ORDER' THEN 1 END) as ooo
      FROM room_types rt
      LEFT JOIN rooms r ON r.room_type_id = rt.id AND r.deleted_at IS NULL
      WHERE rt.hotel_id = ${hotelId}::uuid
        AND rt.deleted_at IS NULL
        AND rt.is_active = true
      GROUP BY rt.id, rt.code, rt.name
      ORDER BY rt.display_order, rt.name
    `;
  }

  // ============================================================================
  // CLONE OPERATIONS
  // ============================================================================

  /**
   * Clones a hotel into a new target hotel inside a transaction.
   *
   * The transaction loads source hotel data, creates a new hotel row with
   * copied profile fields, and optionally duplicates room types. Rate-plan
   * cloning is intentionally rejected to avoid partially supported behavior.
   *
   * @param sourceHotelId - Source hotel UUID to clone from.
   * @param targetData - Target organization/code/name for the cloned hotel.
   * @param options - Clone feature flags for room types, rate plans, and settings.
   * @returns Newly created cloned hotel.
   * @throws {Error} Thrown when rate-plan copying is requested or the source hotel does not exist.
   * @remarks Complexity: O(r) in number of copied room types, inside one DB transaction.
   */
  async cloneHotel(
    sourceHotelId: string,
    targetData: {
      organizationId: string;
      code: string;
      name: string;
    },
    options: {
      copyRoomTypes: boolean;
      copyRatePlans: boolean;
      copySettings: boolean;
    }
  ): Promise<Hotel> {
    if (options.copyRatePlans) {
      throw new Error(
        'The copyRatePlans option is not supported for hotel cloning. Rate plans must be created separately after cloning.'
      );
    }
    return prisma.$transaction(async (tx) => {
      // Get source hotel
      const source = await tx.hotel.findUnique({
        where: { id: sourceHotelId },
        include: {
          roomTypes: options.copyRoomTypes
            ? {
                where: { deletedAt: null },
              }
            : false,
        },
      });

      if (!source) {
        throw new Error('Source hotel not found');
      }

      // Create new hotel
      const newHotel = await tx.hotel.create({
        data: {
          organizationId: targetData.organizationId,
          code: targetData.code,
          name: targetData.name,
          legalName: source.legalName,
          brand: source.brand,
          starRating: source.starRating,
          propertyType: source.propertyType,
          email: source.email,
          phone: source.phone,
          fax: source.fax,
          website: source.website,
          addressLine1: source.addressLine1,
          addressLine2: source.addressLine2,
          city: source.city,
          stateProvince: source.stateProvince,
          postalCode: source.postalCode,
          countryCode: source.countryCode,
          latitude: source.latitude,
          longitude: source.longitude,
          timezone: source.timezone,
          checkInTime: source.checkInTime,
          checkOutTime: source.checkOutTime,
          currencyCode: source.currencyCode,
          defaultLanguage: source.defaultLanguage,
          totalRooms: 0, // Will be updated after room types copied
          totalFloors: source.totalFloors,
          operationalSettings: options.copySettings
            ? (source.operationalSettings as Prisma.InputJsonValue)
            : {},
          amenities: options.copySettings ? (source.amenities as Prisma.InputJsonValue) : [],
          policies: options.copySettings ? (source.policies as Prisma.InputJsonValue) : {},
          status: 'ACTIVE',
          version: 1,
        },
      });

      // Copy room types if requested
      if (options.copyRoomTypes && source.roomTypes) {
        for (const rt of source.roomTypes) {
          await tx.roomType.create({
            data: {
              organizationId: targetData.organizationId,
              hotelId: newHotel.id,
              code: rt.code,
              name: rt.name,
              description: rt.description,
              baseOccupancy: rt.baseOccupancy,
              maxOccupancy: rt.maxOccupancy,
              maxAdults: rt.maxAdults,
              maxChildren: rt.maxChildren,
              sizeSqm: rt.sizeSqm,
              sizeSqft: rt.sizeSqft,
              bedTypes: rt.bedTypes,
              amenities: rt.amenities,
              viewType: rt.viewType,
              defaultCleaningTime: rt.defaultCleaningTime,
              images: rt.images as Prisma.InputJsonValue[],
              isActive: rt.isActive,
              isBookable: rt.isBookable,
              displayOrder: rt.displayOrder,
            },
          });
        }
      }

      return newHotel as Hotel;
    });
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Checks whether a non-deleted hotel belongs to an organization.
   *
   * @param organizationId - Organization UUID scope.
   * @param hotelId - Hotel UUID to verify.
   * @returns `true` when the hotel exists inside the organization.
   */
  async existsInOrganization(organizationId: string, hotelId: string): Promise<boolean> {
    const count = await prisma.hotel.count({
      where: {
        id: hotelId,
        organizationId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  /**
   * Counts non-deleted hotels owned by an organization.
   *
   * @param organizationId - Organization UUID scope.
   * @returns Total hotel count for the organization.
   */
  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.hotel.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });
  }
}

export const hotelRepository = new HotelRepository();
