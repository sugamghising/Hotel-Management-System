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
  /**
   * Retrieves a rate plan by UUID with optional relation expansion.
   *
   * @param id - Rate plan UUID.
   * @param include - Optional Prisma include graph.
   * @returns Matching rate plan or `null`.
   */
  async findById(id: string, include?: Prisma.RatePlanInclude): Promise<RatePlan | null> {
    return prisma.ratePlan.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    }) as Promise<RatePlan | null>;
  }

  /**
   * Retrieves a rate plan by hotel and canonical uppercase code.
   *
   * @param hotelId - Hotel UUID that scopes the code.
   * @param code - Rate plan code; normalized to uppercase before lookup.
   * @returns Matching rate plan or `null`.
   */
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

  /**
   * Lists rate plans for a hotel with optional commercial filters.
   *
   * Supports room type, active/public flags, channel membership, validity-on-date checks,
   * and text search across name/code/description. List and total count are fetched in parallel.
   *
   * @param hotelId - Hotel UUID.
   * @param filters - Optional rate plan filters.
   * @param pagination - Optional pagination configuration.
   * @returns Filtered rate plans and total number of matches.
   * @remarks Complexity: O(R) for returned rows plus two DB queries (`findMany` + `count`).
   */
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

  /**
   * Creates a rate plan.
   *
   * @param data - Prisma unchecked create payload.
   * @returns Newly created rate plan.
   */
  async create(data: RatePlanCreateInput): Promise<RatePlan> {
    return prisma.ratePlan.create({
      data,
    }) as unknown as Promise<RatePlan>;
  }

  /**
   * Updates a rate plan by UUID.
   *
   * @param id - Rate plan UUID.
   * @param data - Prisma update payload.
   * @returns Updated rate plan.
   */
  async update(id: string, data: RatePlanUpdateInput): Promise<RatePlan> {
    return prisma.ratePlan.update({
      where: { id },
      data,
    }) as unknown as Promise<RatePlan>;
  }

  /**
   * Soft-deletes a rate plan and deactivates it.
   *
   * @param id - Rate plan UUID.
   * @returns Resolves when the update is persisted.
   */
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

  /**
   * Retrieves date-level overrides for a rate plan within an inclusive range.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param startDate - Inclusive start date.
   * @param endDate - Inclusive end date.
   * @returns Override rows ordered by date.
   */
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

  /**
   * Creates or updates a single override day for a rate plan.
   *
   * The date key is normalized to midnight to ensure deterministic uniqueness across
   * callers. Optional fields are only overwritten when explicitly provided.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param date - Business date for the override.
   * @param rate - Override nightly rate.
   * @param stopSell - Optional stop-sell flag, defaulting to `false`.
   * @param minStay - Optional minimum stay override; `null` clears the value.
   * @param reason - Optional operator note for audit context.
   * @returns Upserted override row.
   */
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

  /**
   * Deletes one override day for a rate plan.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param date - Override business date.
   * @returns Resolves when the override is removed.
   */
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

  /**
   * Upserts or partial-updates many override dates in one transaction.
   *
   * Entries with `rate` create/upsert full override rows. Entries without `rate` apply
   * partial field updates (`stopSell`, `minStay`, `reason`) only when a row already exists.
   * All date keys are normalized to midnight before persistence.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param overrides - Override mutation entries for one or more dates.
   * @returns Number of transactional operations executed.
   * @remarks Complexity: O(O) Prisma operations where `O` is override entry count.
   */
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

  /**
   * Finds active rate plans that can apply to a check-in date and distribution context.
   *
   * Validity windows are evaluated with inclusive bounds (`validFrom <= checkIn <= validUntil`)
   * when present. Optional channel and public/private filters are appended when supplied.
   *
   * @param hotelId - Hotel UUID.
   * @param roomTypeId - Room type UUID.
   * @param checkIn - Arrival date used for validity evaluation.
   * @param channelCode - Optional channel code that must exist in `channelCodes`.
   * @param isPublic - Optional public/private visibility filter.
   * @returns Applicable rate plans sorted by base rate ascending.
   * @remarks Complexity: O(P) where `P` is returned plans after one filtered DB query.
   */
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

  /**
   * Clones a rate plan into a new private draft with optional rate adjustment.
   *
   * The clone copies commercial restrictions and inclusions, resets distribution to private,
   * clears validity dates, and optionally applies a percentage adjustment to `baseRate`.
   *
   * @param sourceId - Source rate plan UUID.
   * @param newCode - New uppercase code for the clone.
   * @param newName - Display name for the clone.
   * @param targetRoomTypeId - Optional target room type UUID; defaults to source room type.
   * @param rateAdjustment - Optional percentage adjustment applied to base rate.
   * @returns Newly created cloned rate plan.
   * @throws {Error} When the source rate plan does not exist.
   */
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

  /**
   * Aggregates booking performance metrics for a rate plan.
   *
   * Cancelled and no-show reservations are excluded from all aggregates.
   *
   * @param ratePlanId - Rate plan UUID.
   * @returns Booking count, total revenue, and average rate.
   */
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

  /**
   * Checks whether a rate plan exists in a hotel and is not soft-deleted.
   *
   * @param hotelId - Hotel UUID.
   * @param ratePlanId - Rate plan UUID.
   * @returns `true` when the rate plan exists and is active.
   */
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

  /**
   * Checks whether a rate plan has active or future reservations.
   *
   * @param ratePlanId - Rate plan UUID.
   * @returns `true` when reservations in `CONFIRMED`/`CHECKED_IN` status remain uncompleted.
   */
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
