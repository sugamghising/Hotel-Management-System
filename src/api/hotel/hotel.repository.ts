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

  async findById(id: string, include?: Prisma.HotelInclude): Promise<Hotel | null> {
    return prisma.hotel.findUnique({
      where: { id },
      ...(include !== undefined && { include }),
    }) as Promise<Hotel | null>;
  }

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

  async create(data: HotelCreateInput): Promise<Hotel> {
    return prisma.hotel.create({ data }) as Promise<Hotel>;
  }

  async update(id: string, data: HotelUpdateInput): Promise<Hotel> {
    return prisma.hotel.update({
      where: {
        id,
      },
      data,
    }) as Promise<Hotel>;
  }

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

  async updateRoomCount(hotelId: string): Promise<void> {
    const count = await prisma.room.count({
      where: { hotelId, deletedAt: null },
    });

    await prisma.hotel.update({
      where: { id: hotelId },
      data: { totalRooms: count },
    });
  }

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
