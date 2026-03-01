import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import { type HotelRepository, hotelRepository } from '../hotel';
import { type RoomTypesRepository, roomTypesRepository } from '../roomTypes';
import type { RatePlanListResponse } from './ratePlans.dto';
import {
  type RatePlanCreateInput,
  type RatePlansRepository,
  ratePlansRepository,
} from './ratePlans.repository';
import type {
  CreateRatePlanInput,
  PricingRule,
  RateCalculationInput,
  RateCalculationResult,
  RateCalendarResponse,
  RateOverride,
  RateOverrideBulkInput,
  RateOverrideInput,
  RatePlan,
  RatePlanCloneInput,
  RatePlanQueryFilters,
  RatePlanResponse,
  UpdateRatePlanInput,
} from './ratePlans.types';

export class RatePlansService {
  private ratePlanRepo: RatePlansRepository;
  private roomTypeRepo: RoomTypesRepository;
  private hotelRepo: HotelRepository;

  constructor(
    ratePlansRepo: RatePlansRepository = ratePlansRepository,
    roomTypeRepo: RoomTypesRepository = roomTypesRepository,
    hotelRepo: HotelRepository = hotelRepository
  ) {
    this.ratePlanRepo = ratePlansRepo;
    this.roomTypeRepo = roomTypeRepo;
    this.hotelRepo = hotelRepo;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  async create(
    organizationId: string,
    hotelId: string,
    input: CreateRatePlanInput,
    _createdBy?: string
  ): Promise<RatePlanResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    // Verify room type exists in this hotel
    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || roomType.deletedAt || roomType.hotelId !== hotelId) {
      throw new NotFoundError(`Room type '${input.roomTypeId}' not found`);
    }

    // Check code uniqueness
    const existing = await this.ratePlanRepo.findByCode(hotelId, input.code);
    if (existing) {
      throw new ConflictError(`Rate plan code '${input.code}' already exists`);
    }

    // Validate pricing rules
    if (input.pricingRules) {
      this.validatePricingRules(input.pricingRules);
    }

    const createData: RatePlanCreateInput = {
      organizationId,
      hotelId,
      roomTypeId: input.roomTypeId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      pricingType: input.pricingType || 'DAILY',
      baseRate: input.baseRate,
      currencyCode: input.currencyCode || 'USD',
      minAdvanceDays: input.minAdvanceDays || null,
      maxAdvanceDays: input.maxAdvanceDays || null,
      minStay: input.minStay || 1,
      maxStay: input.maxStay || null,
      isRefundable: input.isRefundable ?? true,
      cancellationPolicy: input.cancellationPolicy || 'FLEXIBLE',
      isPublic: input.isPublic ?? true,
      channelCodes: input.channelCodes || ['DIRECT_WEB'],
      mealPlan: input.mealPlan || 'ROOM_ONLY',
      includedAmenities: input.includedAmenities || [],
      isActive: true,
      validFrom: input.validFrom || null,
      validUntil: input.validUntil || null,
    };

    if (input.pricingRules) {
      createData.pricingRules = input.pricingRules as unknown as Exclude<
        RatePlanCreateInput['pricingRules'],
        undefined
      >;
    }

    const ratePlan = await this.ratePlanRepo.create(createData);

    logger.info(`Rate plan created: ${ratePlan.name} (${ratePlan.code})`, {
      ratePlanId: ratePlan.id,
      hotelId,
      roomTypeId: input.roomTypeId,
      baseRate: input.baseRate,
    });

    return this.mapToResponse(ratePlan);
  }

  // ============================================================================
  // READ
  // ============================================================================

  async findById(
    id: string,
    organizationId: string,
    includeStats: boolean = false
  ): Promise<RatePlanResponse> {
    const ratePlan = await this.ratePlanRepo.findById(id, {
      roomType: true,
    });

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${id}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    let stats: RatePlanResponse['stats'] | undefined;
    if (includeStats) {
      stats = await this.ratePlanRepo.getBookingStats(id);
    }

    return this.mapToResponse(ratePlan, stats);
  }

  async findByHotel(
    hotelId: string,
    organizationId: string,
    filters: RatePlanQueryFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<RatePlanListResponse> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const { ratePlans, total } = await this.ratePlanRepo.findByHotel(hotelId, filters, pagination);

    return {
      ratePlans: ratePlans.map((rp) => {
        const rpWithType = rp as RatePlan & {
          roomType?: { id: string; code: string; name: string };
        };
        return {
          id: rp.id,
          code: rp.code,
          name: rp.name,
          roomType: rpWithType.roomType ?? { id: rp.roomTypeId, code: '', name: '' },
          baseRate: rp.baseRate,
          currencyCode: rp.currencyCode,
          isActive: rp.isActive,
          isPublic: rp.isPublic,
          validFrom: rp.validFrom,
          validUntil: rp.validUntil,
        };
      }),
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
    input: UpdateRatePlanInput,
    _updatedBy?: string
  ): Promise<RatePlanResponse> {
    const ratePlan = await this.ratePlanRepo.findById(id);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${id}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Validate pricing rules if provided
    if (input.pricingRules) {
      this.validatePricingRules(input.pricingRules);
    }

    // Check for channel conflicts if changing channel codes
    if (input.channelCodes && input.isPublic !== false) {
      const conflicting = await this.findChannelConflicts(
        ratePlan.hotelId,
        ratePlan.roomTypeId,
        id,
        input.channelCodes
      );
      if (conflicting.length > 0) {
        throw new BadRequestError(
          `Channel conflict with rate plans: ${conflicting.map((c) => c.code).join(', ')}`
        );
      }
    }

    const { pricingRules, ...rest } = input;
    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (pricingRules !== undefined) {
      updateData['pricingRules'] =
        pricingRules === null
          ? { set: null }
          : (pricingRules as unknown as RatePlanCreateInput['pricingRules']);
    }

    const updated = await this.ratePlanRepo.update(
      id,
      updateData as unknown as import('./ratePlans.repository').RatePlanUpdateInput
    );

    logger.info(`Rate plan updated: ${updated.name}`, { ratePlanId: id });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  async delete(id: string, organizationId: string, deletedBy?: string): Promise<void> {
    const ratePlan = await this.ratePlanRepo.findById(id);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${id}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Check for active bookings
    const hasBookings = await this.ratePlanRepo.hasActiveBookings(id);
    if (hasBookings) {
      throw new BadRequestError(
        'Cannot delete rate plan with active or future reservations. ' +
          'Please deactivate instead.'
      );
    }

    await this.ratePlanRepo.softDelete(id);

    logger.warn(`Rate plan deleted: ${ratePlan.name}`, { ratePlanId: id, deletedBy });
  }

  // ============================================================================
  // RATE OVERRIDES
  // ============================================================================

  async getCalendar(
    ratePlanId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RateCalendarResponse> {
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${ratePlanId}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const [overrides, roomType] = await Promise.all([
      this.ratePlanRepo.getOverrides(ratePlanId, startDate, endDate),
      this.roomTypeRepo.findById(ratePlan.roomTypeId),
    ]);

    // Build calendar with base rate and overrides
    const dates: RateCalendarResponse['dates'] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0] ?? '';
      const override = overrides.find((o) => o.date.toISOString().split('T')[0] === dateStr);

      const isValid = this.isDateInValidityPeriod(current, ratePlan.validFrom, ratePlan.validUntil);

      dates.push({
        date: dateStr,
        baseRate: ratePlan.baseRate,
        overrideRate: override?.rate || null,
        finalRate: override?.rate || ratePlan.baseRate,
        stopSell: override?.stopSell || false,
        minStay: override?.minStay !== undefined ? override.minStay : ratePlan.minStay,
        isValid,
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      ratePlanId,
      ratePlanCode: ratePlan.code,
      ratePlanName: ratePlan.name,
      roomTypeId: ratePlan.roomTypeId,
      roomTypeCode: roomType?.code || 'UNKNOWN',
      currencyCode: ratePlan.currencyCode,
      dates,
    };
  }

  async updateOverride(
    ratePlanId: string,
    organizationId: string,
    input: RateOverrideInput
  ): Promise<RateOverride> {
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${ratePlanId}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const override = await this.ratePlanRepo.upsertOverride(
      ratePlanId,
      input.date,
      input.rate,
      input.stopSell,
      input.minStay,
      input.reason
    );

    logger.info(
      `Rate override set: ${ratePlan.code} @ ${input.date.toISOString().split('T')[0]} = ${input.rate}`,
      {
        ratePlanId,
        date: input.date,
      }
    );

    return override;
  }

  async bulkUpdateOverrides(
    ratePlanId: string,
    organizationId: string,
    input: RateOverrideBulkInput
  ): Promise<{ updatedCount: number }> {
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${ratePlanId}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Generate dates
    const dates: Date[] = [];
    const current = new Date(input.startDate);

    while (current <= input.endDate) {
      const dayOfWeek = current.getDay();
      if (!input.daysOfWeek || input.daysOfWeek.includes(dayOfWeek)) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    const overrides = dates.map((date) => {
      const entry: {
        date: Date;
        rate?: number;
        stopSell?: boolean;
        minStay?: number | null;
        reason?: string;
      } = { date };
      if (input.rate !== undefined) entry.rate = input.rate;
      if (input.stopSell !== undefined) entry.stopSell = input.stopSell;
      if (input.minStay !== undefined) entry.minStay = input.minStay;
      if (input.reason !== undefined) entry.reason = input.reason;
      return entry;
    });

    const updatedCount = await this.ratePlanRepo.bulkUpsertOverrides(ratePlanId, overrides);

    logger.info(`Bulk rate overrides: ${updatedCount} days updated`, {
      ratePlanId,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    return { updatedCount };
  }

  async deleteOverride(ratePlanId: string, organizationId: string, date: Date): Promise<void> {
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${ratePlanId}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await this.ratePlanRepo.deleteOverride(ratePlanId, date);
  }

  // ============================================================================
  // RATE CALCULATION (BOOKING ENGINE)
  // ============================================================================

  async calculateRates(
    hotelId: string,
    organizationId: string,
    input: RateCalculationInput
  ): Promise<RateCalculationResult> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || roomType.deletedAt || roomType.hotelId !== hotelId) {
      throw new NotFoundError(`Roomtype with id ${input.roomTypeId} not found.`);
    }

    const nights = Math.ceil(
      (input.checkOut.getTime() - input.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Find applicable rate plans
    const ratePlans = await this.ratePlanRepo.findApplicableRatePlans(
      hotelId,
      input.roomTypeId,
      input.checkIn,
      input.channelCode,
      undefined // Both public and private for internal calculation
    );

    const results: RateCalculationResult['availableRatePlans'] = [];

    for (const rp of ratePlans) {
      // Check basic restrictions
      const daysInAdvance = Math.ceil(
        (input.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const minAdvanceMet = !rp.minAdvanceDays || daysInAdvance >= rp.minAdvanceDays;
      const maxAdvanceMet = !rp.maxAdvanceDays || daysInAdvance <= rp.maxAdvanceDays;
      const minStayMet = nights >= rp.minStay;
      const maxStayMet = !rp.maxStay || nights <= rp.maxStay;

      if (!minAdvanceMet || !maxAdvanceMet || !minStayMet || !maxStayMet) {
        continue; // Skip this rate plan - restrictions not met
      }

      // Calculate nightly rates
      const nightlyRates: Array<{
        date: string;
        baseRate: number;
        adjustments: Array<{ ruleType: string; description: string; amount: number }>;
        finalRate: number;
      }> = [];
      let subtotal = 0;

      const current = new Date(input.checkIn);
      for (let i = 0; i < nights; i++) {
        const dateStr = current.toISOString().split('T')[0] ?? '';

        // Get override if exists
        const overrides = await this.ratePlanRepo.getOverrides(rp.id, current, current);
        const override = overrides[0];

        let baseRate = override?.rate || rp.baseRate;
        const adjustments: Array<{ ruleType: string; description: string; amount: number }> = [];

        // Apply dynamic pricing rules
        if (rp.pricingRules && Array.isArray(rp.pricingRules)) {
          const sortedRules = (rp.pricingRules as PricingRule[])
            .filter((r) => this.ruleApplies(r, current, daysInAdvance, nights, 0)) // occupancy not checked here
            .sort((a, b) => b.priority - a.priority);

          for (const rule of sortedRules) {
            const adjustmentAmount = this.calculateAdjustment(baseRate, rule.adjustment);
            adjustments.push({
              ruleType: rule.type,
              description: this.describeRule(rule),
              amount: adjustmentAmount,
            });
            baseRate += adjustmentAmount;
          }
        }

        const finalRate = Math.max(0, Math.round(baseRate * 100) / 100);
        nightlyRates.push({
          date: dateStr,
          baseRate: override?.rate || rp.baseRate,
          adjustments,
          finalRate,
        });

        subtotal += finalRate;
        current.setDate(current.getDate() + 1);
      }

      // Calculate taxes (simplified - would use tax engine)
      const taxRate = 0.15; // 15% placeholder
      const taxes = Math.round(subtotal * taxRate * 100) / 100;
      const total = Math.round((subtotal + taxes) * 100) / 100;

      results.push({
        ratePlanId: rp.id,
        ratePlanCode: rp.code,
        ratePlanName: rp.name,
        nightlyRates,
        totalNights: nights,
        subtotal: Math.round(subtotal * 100) / 100,
        taxes,
        total,
        currencyCode: rp.currencyCode,
        restrictions: {
          minStayMet,
          maxStayMet,
          advanceBookingMet: minAdvanceMet && maxAdvanceMet,
          cancellationPolicy: rp.cancellationPolicy,
        },
        inclusions: {
          mealPlan: rp.mealPlan,
          amenities: rp.includedAmenities,
        },
      });
    }

    // Sort by total price
    results.sort((a, b) => a.total - b.total);

    return {
      roomTypeId: input.roomTypeId,
      roomTypeName: roomType.name,
      availableRatePlans: results,
      bestAvailableRate: results.length > 0 ? (results[0]?.total ?? null) : null,
    };
  }

  // ============================================================================
  // CLONE
  // ============================================================================

  async clone(
    id: string,
    organizationId: string,
    input: RatePlanCloneInput,
    _createdBy?: string
  ): Promise<RatePlanResponse> {
    const source = await this.ratePlanRepo.findById(id);

    if (!source || source.deletedAt) {
      throw new NotFoundError(`Rate plan '${id}' not found`);
    }

    if (source.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // If cloning to different room type, verify it exists
    if (input.roomTypeId) {
      const targetRoomType = await this.roomTypeRepo.findById(input.roomTypeId);
      if (!targetRoomType || targetRoomType.deletedAt) {
        throw new NotFoundError(`Target room type not found. ${input.roomTypeId}`);
      }
      if (targetRoomType.hotelId !== source.hotelId) {
        throw new BadRequestError('Cannot clone to room type in different hotel');
      }
    }

    // Check new code uniqueness
    const existing = await this.ratePlanRepo.findByCode(source.hotelId, input.newCode);
    if (existing) {
      throw new ConflictError(`Rate plan code '${input.newCode}' already exists`);
    }

    const cloned = await this.ratePlanRepo.clone(
      id,
      input.newCode,
      input.newName,
      input.roomTypeId,
      input.adjustRateByPercent
    );

    logger.info(`Rate plan cloned: ${source.code} -> ${cloned.code}`, {
      sourceId: id,
      newId: cloned.id,
    });

    return this.mapToResponse(cloned);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel '${hotelId}' not found`);
    }
  }

  private async findChannelConflicts(
    hotelId: string,
    roomTypeId: string,
    excludeRatePlanId: string,
    channelCodes: string[]
  ): Promise<Array<{ id: string; code: string }>> {
    const conflicting = await this.ratePlanRepo.findByHotel(hotelId, {
      roomTypeId,
      isActive: true,
    });

    return conflicting.ratePlans
      .filter(
        (rp) =>
          rp.id !== excludeRatePlanId &&
          rp.isPublic &&
          rp.channelCodes.some((c) => channelCodes.includes(c))
      )
      .map((rp) => ({ id: rp.id, code: rp.code }));
  }

  private validatePricingRules(rules: PricingRule[]): void {
    // Validate rule conditions don't conflict excessively
    const hasEarlyBird = rules.some((r) => r.type === 'EARLY_BIRD');
    const hasLastMinute = rules.some((r) => r.type === 'LAST_MINUTE');

    if (hasEarlyBird && hasLastMinute) {
      // This is valid but worth logging
      logger.debug('Rate plan has both early bird and last minute rules');
    }

    // Check priority uniqueness isn't required but recommended
    const priorities = rules.map((r) => r.priority);
    const uniquePriorities = new Set(priorities);
    if (priorities.length !== uniquePriorities.size) {
      logger.warn('Pricing rules have duplicate priorities');
    }
  }

  private isDateInValidityPeriod(
    date: Date,
    validFrom: Date | null,
    validUntil: Date | null
  ): boolean {
    if (validFrom && date < validFrom) return false;
    if (validUntil && date > validUntil) return false;
    return true;
  }

  private ruleApplies(
    rule: PricingRule,
    date: Date,
    daysInAdvance: number,
    lengthOfStay: number,
    occupancyPercent: number
  ): boolean {
    const cond = rule.condition;

    switch (rule.type) {
      case 'EARLY_BIRD':
        return cond.daysInAdvance !== undefined && daysInAdvance >= cond.daysInAdvance;

      case 'LAST_MINUTE':
        return cond.daysInAdvance !== undefined && daysInAdvance <= cond.daysInAdvance;

      case 'LENGTH_OF_STAY': {
        const minNights = cond.minNights || 0;
        const maxNights = cond.maxNights || Number.POSITIVE_INFINITY;
        return lengthOfStay >= minNights && lengthOfStay <= maxNights;
      }

      case 'OCCUPANCY_BASED':
        return cond.occupancyThreshold !== undefined && occupancyPercent >= cond.occupancyThreshold;

      case 'DAY_OF_WEEK':
        return cond.daysOfWeek?.includes(date.getDay()) ?? false;

      default:
        return false;
    }
  }

  private calculateAdjustment(baseRate: number, adjustment: PricingRule['adjustment']): number {
    switch (adjustment.type) {
      case 'PERCENTAGE': {
        const percentChange = baseRate * (adjustment.value / 100);
        return adjustment.operation === 'SUBTRACT'
          ? -percentChange
          : adjustment.operation === 'ADD'
            ? percentChange
            : percentChange; // MULTIPLY would be different
      }

      case 'FIXED_AMOUNT':
        return adjustment.operation === 'SUBTRACT' ? -adjustment.value : adjustment.value;

      default:
        return 0;
    }
  }

  private describeRule(rule: PricingRule): string {
    const desc: Record<string, string> = {
      EARLY_BIRD: `Early bird (${rule.condition.daysInAdvance}+ days)`,
      LAST_MINUTE: `Last minute (${rule.condition.daysInAdvance} days)`,
      LENGTH_OF_STAY: `Stay ${rule.condition.minNights}+ nights`,
      OCCUPANCY_BASED: `Occupancy ${rule.condition.occupancyThreshold}%+`,
      DAY_OF_WEEK: 'Specific days',
    };
    return desc[rule.type] || rule.type;
  }

  private mapToResponse(ratePlan: RatePlan, stats?: RatePlanResponse['stats']): RatePlanResponse {
    const now = new Date();
    const isCurrentlyValid = this.isDateInValidityPeriod(
      now,
      ratePlan.validFrom,
      ratePlan.validUntil
    );

    return {
      id: ratePlan.id,
      organizationId: ratePlan.organizationId,
      hotelId: ratePlan.hotelId,
      roomTypeId: ratePlan.roomTypeId,

      code: ratePlan.code,
      name: ratePlan.name,
      description: ratePlan.description,

      pricing: {
        type: ratePlan.pricingType,
        baseRate: ratePlan.baseRate,
        currencyCode: ratePlan.currencyCode,
      },

      restrictions: {
        minAdvanceDays: ratePlan.minAdvanceDays,
        maxAdvanceDays: ratePlan.maxAdvanceDays,
        minStay: ratePlan.minStay,
        maxStay: ratePlan.maxStay,
        isRefundable: ratePlan.isRefundable,
        cancellationPolicy: ratePlan.cancellationPolicy,
      },

      distribution: {
        isPublic: ratePlan.isPublic,
        channelCodes: ratePlan.channelCodes,
      },

      inclusions: {
        mealPlan: ratePlan.mealPlan,
        includedAmenities: ratePlan.includedAmenities,
      },

      dynamicPricing: {
        rules: (ratePlan.pricingRules as PricingRule[]) || [],
        isActive: !!(ratePlan.pricingRules && (ratePlan.pricingRules as PricingRule[]).length > 0),
      },

      validity: {
        isActive: ratePlan.isActive,
        validFrom: ratePlan.validFrom,
        validUntil: ratePlan.validUntil,
        isCurrentlyValid,
      },

      ...(stats !== undefined ? { stats } : {}),

      createdAt: ratePlan.createdAt,
      updatedAt: ratePlan.updatedAt,
    };
  }
}

export const ratePlansService = new RatePlansService();
