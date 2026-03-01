import { prisma } from '../../database/prisma';
import { Prisma as PrismaNamespace } from '../../generated/prisma';
import type { Prisma } from '../../generated/prisma';
import type { RateOverride, RatePlan } from './ratePlans.types';

export type RatePlanWhereInput = Prisma.RatePlanWhereInput;
export type RatePlanCreateInput = Prisma.RatePlanUncheckedCreateInput;
export type RatePlanUpdateInput = Prisma.RatePlanUpdateInput;

export class RatePlansRepository {
  //===============================================================
  //CRUD OPERATIONS
  //===============================================================
  async findById(id: string, include?: Prisma.RatePlanInclude): Promise<RatePlan | null> {
    return prisma.ratePlan.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    }) as Promise<RatePlan | null>;
  }

  async findByCode(hotelId: string, code: string): Promise<RatePlan | null> {
    return prisma.ratePlan.findUnique({
      where: {
        uq_rateplan_hotel_code: {
          hotelId,
          code: code.toUpperCase(),
        },
      },
    }) as Promise<RatePlan | null>;
  }

  async findByHotel(
    hotelId: string,
    filters?: {
      roomTypeId?: string;
      isActive?: boolean;
      isPublic?: boolean;
      channelCode?: string;
      validOnDate?: Date;
      search?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ ratePlans: RatePlan[]; total: number }> {
    const where: Prisma.RatePlanWhereInput = {
      hotelId,
      deletedAt: null,
    };

    if (filters?.roomTypeId) {
      where.roomTypeId = filters.roomTypeId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters?.channelCode) {
      where.channelCodes = { has: filters.channelCode };
    }

    if (filters?.validOnDate) {
      where.AND = [
        {
          OR: [{ validFrom: null }, { validFrom: { lte: filters.validOnDate } }],
        },
        {
          OR: [{ validUntil: null }, { validUntil: { gte: filters.validOnDate } }],
        },
      ];
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search.toUpperCase() } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [ratePlans, total] = await Promise.all([
      prisma.ratePlan.findMany({
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
        ...(pagination
          ? { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }
          : {}),
        orderBy: [{ roomTypeId: 'asc' }, { name: 'asc' }],
      }),
      prisma.ratePlan.count({ where }),
    ]);

    return { ratePlans: ratePlans as unknown as RatePlan[], total };
  }

  async create(data: RatePlanCreateInput): Promise<RatePlan> {
    return prisma.ratePlan.create({
      data,
    }) as unknown as Promise<RatePlan>;
  }

  async update(id: string, data: RatePlanUpdateInput): Promise<RatePlan> {
    return prisma.ratePlan.update({
      where: { id },
      data,
    }) as unknown as Promise<RatePlan>;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.ratePlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // RATE OVERRIDES
  // ============================================================================

  async getOverrides(ratePlanId: string, startDate: Date, endDate: Date): Promise<RateOverride[]> {
    return prisma.rateOverride.findMany({
      where: {
        ratePlanId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    }) as unknown as Promise<RateOverride[]>;
  }

  async upsertOverride(
    ratePlanId: string,
    date: Date,
    rate: number,
    stopSell: boolean = false,
    minStay?: number | null,
    reason?: string
  ): Promise<RateOverride> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    return prisma.rateOverride.upsert({
      where: {
        uq_rateoverride_plan_date: {
          ratePlanId,
          date: normalizedDate,
        },
      },
      create: {
        ratePlanId,
        date: normalizedDate,
        rate,
        stopSell,
        minStay: minStay ?? null,
        reason: reason ?? null,
      },
      update: {
        rate,
        stopSell,
        ...(minStay !== undefined ? { minStay } : {}),
        ...(reason !== undefined ? { reason } : {}),
      },
    }) as unknown as Promise<RateOverride>;
  }

  async deleteOverride(ratePlanId: string, date: Date): Promise<void> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    await prisma.rateOverride.delete({
      where: {
        uq_rateoverride_plan_date: {
          ratePlanId,
          date: normalizedDate,
        },
      },
    });
  }

  async bulkUpsertOverrides(
    ratePlanId: string,
    overrides: Array<{
      date: Date;
      rate?: number;
      stopSell?: boolean;
      minStay?: number | null;
      reason?: string;
    }>
  ): Promise<number> {
    type OverrideWithRate = {
      date: Date;
      rate: number;
      stopSell?: boolean;
      minStay?: number | null;
      reason?: string;
    };
    const withRate = overrides.filter((o): o is OverrideWithRate => o.rate !== undefined);
    const withoutRate = overrides.filter((o) => o.rate === undefined);

    const results = await prisma.$transaction([
      ...withRate.map((o) => {
        const normalizedDate = new Date(o.date);
        normalizedDate.setHours(0, 0, 0, 0);
        return prisma.rateOverride.upsert({
          where: {
            uq_rateoverride_plan_date: {
              ratePlanId,
              date: normalizedDate,
            },
          },
          create: {
            ratePlanId,
            date: normalizedDate,
            rate: o.rate,
            stopSell: o.stopSell ?? false,
            minStay: o.minStay ?? null,
            reason: o.reason ?? null,
          },
          update: {
            rate: o.rate,
            ...(o.stopSell !== undefined ? { stopSell: o.stopSell } : {}),
            ...(o.minStay !== undefined ? { minStay: o.minStay } : {}),
            ...(o.reason !== undefined ? { reason: o.reason } : {}),
          },
        });
      }),
      ...withoutRate.map((o) => {
        const normalizedDate = new Date(o.date);
        normalizedDate.setHours(0, 0, 0, 0);
        return prisma.rateOverride.updateMany({
          where: {
            ratePlanId,
            date: normalizedDate,
          },
          data: {
            ...(o.stopSell !== undefined ? { stopSell: o.stopSell } : {}),
            ...(o.minStay !== undefined ? { minStay: o.minStay } : {}),
            ...(o.reason !== undefined ? { reason: o.reason } : {}),
          },
        });
      }),
    ]);

    return results.length;
  }

  // ============================================================================
  // CALCULATION & PRICING
  // ============================================================================

  async findApplicableRatePlans(
    hotelId: string,
    roomTypeId: string,
    checkIn: Date,
    channelCode?: string,
    isPublic?: boolean
  ): Promise<RatePlan[]> {
    const where: Prisma.RatePlanWhereInput = {
      hotelId,
      roomTypeId,
      isActive: true,
      deletedAt: null,
      AND: [
        {
          OR: [{ validFrom: null }, { validFrom: { lte: checkIn } }],
        },
        {
          OR: [{ validUntil: null }, { validUntil: { gte: checkIn } }],
        },
      ],
    };

    if (channelCode) {
      where.channelCodes = { has: channelCode };
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    return prisma.ratePlan.findMany({
      where,
      include: {
        roomType: true,
      },
      orderBy: { baseRate: 'asc' },
    }) as unknown as Promise<RatePlan[]>;
  }

  // ============================================================================
  // CLONE
  // ============================================================================

  async clone(
    sourceId: string,
    newCode: string,
    newName: string,
    targetRoomTypeId?: string,
    rateAdjustment?: number
  ): Promise<RatePlan> {
    const source = await prisma.ratePlan.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw new Error('Source rate plan not found');
    }

    let newBaseRate = Number(source.baseRate);
    if (rateAdjustment) {
      newBaseRate = Math.round(newBaseRate * (1 + rateAdjustment / 100) * 100) / 100;
    }

    return prisma.ratePlan.create({
      data: {
        organizationId: source.organizationId,
        hotelId: source.hotelId,
        roomTypeId: targetRoomTypeId || source.roomTypeId,
        code: newCode.toUpperCase(),
        name: newName,
        description: source.description,
        pricingType: source.pricingType,
        baseRate: newBaseRate,
        currencyCode: source.currencyCode,
        minAdvanceDays: source.minAdvanceDays,
        maxAdvanceDays: source.maxAdvanceDays,
        minStay: source.minStay,
        maxStay: source.maxStay,
        isRefundable: source.isRefundable,
        cancellationPolicy: source.cancellationPolicy,
        isPublic: false, // Clone as private by default
        channelCodes: [],
        mealPlan: source.mealPlan,
        includedAmenities: source.includedAmenities,
        pricingRules: source.pricingRules === null ? PrismaNamespace.DbNull : source.pricingRules,
        isActive: true,
        validFrom: null,
        validUntil: null,
      },
    }) as unknown as Promise<RatePlan>;
  }

  // ============================================================================
  // STATS
  // ============================================================================

  async getBookingStats(ratePlanId: string): Promise<{
    bookingsCount: number;
    totalRevenue: number;
    averageRate: number;
  }> {
    const result = await prisma.reservation.aggregate({
      where: {
        ratePlanId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      },
      _avg: {
        averageRate: true,
      },
    });

    return {
      bookingsCount: result._count.id,
      totalRevenue: Number(result._sum.totalAmount || 0),
      averageRate: Number(result._avg.averageRate || 0),
    };
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  async existsInHotel(hotelId: string, ratePlanId: string): Promise<boolean> {
    const count = await prisma.ratePlan.count({
      where: {
        id: ratePlanId,
        hotelId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async hasActiveBookings(ratePlanId: string): Promise<boolean> {
    const count = await prisma.reservation.count({
      where: {
        ratePlanId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkOutDate: { gte: new Date() },
      },
    });
    return count > 0;
  }
}

export const ratePlansRepository = new RatePlansRepository();
