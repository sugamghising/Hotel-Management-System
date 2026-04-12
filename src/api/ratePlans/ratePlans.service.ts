import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import { prisma } from '../../database/prisma';
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

  /**
   * Creates a rate plan service with repository dependencies.
   *
   * @param ratePlansRepo - Repository used for rate plan persistence and override lookups.
   * @param roomTypeRepo - Repository used to validate room type scope.
   * @param hotelRepo - Repository used to validate hotel ownership boundaries.
   */
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

  /**
   * Creates a rate plan after validating hotel access, room type scope, code uniqueness, and rules.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID where the plan is created.
   * @param input - Commercial, distribution, and pricing configuration for the new rate plan.
   * @param _createdBy - Optional actor identifier reserved for audit integration.
   * @returns Created rate plan mapped to API response format.
   * @throws {NotFoundError} When the hotel or room type is missing in the expected scope.
   * @throws {ConflictError} When the rate plan code already exists for the hotel.
   */
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
      description: input.description ?? null,
      pricingType: input.pricingType ?? 'DAILY',
      baseRate: input.baseRate,
      currencyCode: input.currencyCode ?? 'USD',
      minAdvanceDays: input.minAdvanceDays ?? null,
      maxAdvanceDays: input.maxAdvanceDays ?? null,
      minStay: input.minStay ?? 1,
      maxStay: input.maxStay ?? null,
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

  /**
   * Retrieves one rate plan by ID and optionally adds booking performance metrics.
   *
   * @param id - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param includeStats - When `true`, includes booking count and revenue aggregates.
   * @returns Rate plan details mapped to the response contract.
   * @throws {NotFoundError} When the rate plan does not exist or is soft-deleted.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   */
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

  /**
   * Lists hotel rate plans with optional filters and pagination.
   *
   * @param hotelId - Hotel UUID whose rate plans are queried.
   * @param organizationId - Organization UUID used for hotel access checks.
   * @param filters - Optional filter criteria (room type, activity, channel, search).
   * @param pagination - Page and limit values for result slicing.
   * @returns Paginated rate plan summaries.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   */
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

  /**
   * Updates a rate plan and emits an outbox event for downstream pricing consumers.
   *
   * Validates organization ownership, optional dynamic pricing rules, and distribution-channel
   * conflicts before persisting updates. Pricing rules support explicit `null` to clear rules.
   *
   * @param id - Rate plan UUID.
   * @param organizationId - Organization UUID used for authorization.
   * @param input - Partial rate plan fields to modify.
   * @param _updatedBy - Optional actor identifier reserved for audit integration.
   * @returns Updated rate plan mapped to API response format.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   * @throws {BadRequestError} When requested channel codes conflict with other public plans.
   */
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

    await this.emitRatePlanUpdatedEvent({
      organizationId,
      hotelId: updated.hotelId,
      ratePlanId: updated.id,
      reason: 'rate_plan_updated',
    });

    logger.info(`Rate plan updated: ${updated.name}`, { ratePlanId: id });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * Soft-deletes a rate plan after ensuring it has no active or future bookings.
   *
   * @param id - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership validation.
   * @param deletedBy - Optional actor identifier for audit logs.
   * @returns Resolves when soft-delete is persisted.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   * @throws {BadRequestError} When active/future reservations still reference the plan.
   */
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

  /**
   * Builds a date-by-date pricing calendar for a rate plan.
   *
   * For each date in the inclusive range, the calendar includes base rate, override value,
   * effective rate, stop-sell/min-stay data, and whether the date is inside validity bounds.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param startDate - Inclusive calendar start date.
   * @param endDate - Inclusive calendar end date.
   * @returns Calendar payload scoped to one rate plan and room type.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   * @remarks Complexity: O(D * O) where `D` is date count and `O` is override count searched per date.
   */
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
        overrideRate: override?.rate ?? null,
        finalRate: override?.rate ?? ratePlan.baseRate,
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

  /**
   * Creates or updates one date-level override for a rate plan and emits update events.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param input - Override date, rate, and optional restriction fields.
   * @returns Persisted override row.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   */
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

    await this.emitRatePlanUpdatedEvent({
      organizationId,
      hotelId: ratePlan.hotelId,
      ratePlanId,
      dateFrom: input.date,
      dateTo: input.date,
      reason: 'rate_override_updated',
    });

    return override;
  }

  /**
   * Applies override values across a date range, optionally filtered by weekdays.
   *
   * Generates concrete dates, projects partial override fields, persists them in bulk, and emits
   * one outbox event describing the affected range.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param input - Date range, optional weekday filter, and override values to apply.
   * @returns Number of override dates updated.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   * @remarks Complexity: O(D) where `D` is days iterated in the requested range.
   */
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

    await this.emitRatePlanUpdatedEvent({
      organizationId,
      hotelId: ratePlan.hotelId,
      ratePlanId,
      dateFrom: input.startDate,
      dateTo: input.endDate,
      reason: 'rate_override_bulk_updated',
    });

    return { updatedCount };
  }

  /**
   * Removes one override day from a rate plan and emits a pricing update event.
   *
   * @param ratePlanId - Rate plan UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param date - Business date whose override should be removed.
   * @returns Resolves when deletion and outbox event write complete.
   * @throws {NotFoundError} When the rate plan does not exist.
   * @throws {ForbiddenError} When the rate plan belongs to another organization.
   */
  async deleteOverride(ratePlanId: string, organizationId: string, date: Date): Promise<void> {
    const ratePlan = await this.ratePlanRepo.findById(ratePlanId);

    if (!ratePlan || ratePlan.deletedAt) {
      throw new NotFoundError(`Rate plan '${ratePlanId}' not found`);
    }

    if (ratePlan.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await this.ratePlanRepo.deleteOverride(ratePlanId, date);

    await this.emitRatePlanUpdatedEvent({
      organizationId,
      hotelId: ratePlan.hotelId,
      ratePlanId,
      dateFrom: date,
      dateTo: date,
      reason: 'rate_override_deleted',
    });
  }

  // ============================================================================
  // RATE CALCULATION (BOOKING ENGINE)
  // ============================================================================

  /**
   * Calculates sellable rate plans and total prices for a stay request.
   *
   * The calculator validates room type scope, finds applicable active plans, enforces advance/stay
   * restrictions, applies date overrides and dynamic pricing rules per night, then computes
   * subtotal, tax placeholder, and final totals before sorting by cheapest total.
   *
   * @param hotelId - Hotel UUID where pricing is requested.
   * @param organizationId - Organization UUID used for hotel access validation.
   * @param input - Stay dates, room type, and optional distribution context.
   * @returns Calculated rate plan options and best available total.
   * @throws {NotFoundError} When the hotel or room type is missing in scope.
   * @remarks Complexity: O(P * N * R) where `P` is applicable plans, `N` is nights, and `R` is active rules.
   * @example
   * const quote = await service.calculateRates(hotelId, organizationId, {
   *   roomTypeId,
   *   checkIn: new Date('2026-08-10'),
   *   checkOut: new Date('2026-08-13'),
   *   channelCode: 'DIRECT_WEB',
   * });
   */
  async calculateRates(
    hotelId: string,
    organizationId: string,
    input: RateCalculationInput
  ): Promise<RateCalculationResult> {
    await this.verifyHotelAccess(organizationId, hotelId);

    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || roomType.deletedAt || roomType.hotelId !== hotelId) {
      throw new NotFoundError(`Room type '${input.roomTypeId}' not found`);
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

      // Fetch all overrides for the date range once to avoid N+1 queries
      const lastNight = new Date(input.checkOut);
      lastNight.setDate(lastNight.getDate() - 1);
      const allOverrides = await this.ratePlanRepo.getOverrides(rp.id, input.checkIn, lastNight);
      const overrideMap = new Map(allOverrides.map((o) => [o.date.toISOString().split('T')[0], o]));

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
        const override = overrideMap.get(dateStr);

        let baseRate = override?.rate ?? rp.baseRate;
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
          baseRate: override?.rate ?? rp.baseRate,
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

  /**
   * Clones an existing rate plan with a new code/name and optional room type/rate adjustments.
   *
   * @param id - Source rate plan UUID.
   * @param organizationId - Organization UUID used for ownership validation.
   * @param input - Clone options including new code/name and optional adjustments.
   * @param _createdBy - Optional actor identifier reserved for audit integration.
   * @returns Newly created cloned rate plan mapped to response format.
   * @throws {NotFoundError} When the source plan or target room type is missing.
   * @throws {ForbiddenError} When the source plan belongs to another organization.
   * @throws {BadRequestError} When target room type is in a different hotel.
   * @throws {ConflictError} When the clone code already exists.
   */
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
        throw new NotFoundError(`Target room type '${input.roomTypeId}' not found`);
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

  /**
   * Writes a `rate_plan.updated` outbox event and suppresses persistence failures.
   *
   * @param payload - Event payload fields describing affected organization, hotel, plan, and date scope.
   * @returns Resolves when the outbox write attempt completes.
   */
  private async emitRatePlanUpdatedEvent(payload: {
    organizationId: string;
    hotelId: string;
    ratePlanId: string;
    dateFrom?: Date;
    dateTo?: Date;
    reason?: string;
  }): Promise<void> {
    try {
      await prisma.outboxEvent.create({
        data: {
          eventType: 'rate_plan.updated',
          aggregateType: 'RatePlan',
          aggregateId: payload.ratePlanId,
          payload: {
            organizationId: payload.organizationId,
            hotelId: payload.hotelId,
            ratePlanId: payload.ratePlanId,
            ...(payload.dateFrom ? { dateFrom: payload.dateFrom.toISOString() } : {}),
            ...(payload.dateTo ? { dateTo: payload.dateTo.toISOString() } : {}),
            ...(payload.reason ? { reason: payload.reason } : {}),
          },
        },
      });
    } catch (error) {
      logger.warn('Failed to create rate_plan.updated outbox event', {
        ratePlanId: payload.ratePlanId,
        hotelId: payload.hotelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verifies that a hotel exists within the provided organization scope.
   *
   * @param organizationId - Organization UUID.
   * @param hotelId - Hotel UUID.
   * @returns Resolves when scope validation succeeds.
   * @throws {NotFoundError} When the hotel is not found in the organization.
   */
  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel '${hotelId}' not found`);
    }
  }

  /**
   * Finds public active rate plans in the same room type that conflict on channel codes.
   *
   * @param hotelId - Hotel UUID used to scope the search.
   * @param roomTypeId - Room type UUID that must match candidate plans.
   * @param excludeRatePlanId - Rate plan UUID to exclude from conflict checks.
   * @param channelCodes - Channel codes requested by the candidate plan.
   * @returns Conflicting rate plan IDs and codes.
   */
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

  /**
   * Performs lightweight validation and diagnostics for dynamic pricing rule sets.
   *
   * @param rules - Pricing rules attached to a rate plan.
   * @returns Resolves when validation checks complete.
   */
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

  /**
   * Checks whether a business date falls within optional validity bounds.
   *
   * @param date - Date being evaluated.
   * @param validFrom - Inclusive lower bound; `null` means no lower limit.
   * @param validUntil - Inclusive upper bound; `null` means no upper limit.
   * @returns `true` when the date is inside the validity window.
   */
  private isDateInValidityPeriod(
    date: Date,
    validFrom: Date | null,
    validUntil: Date | null
  ): boolean {
    if (validFrom && date < validFrom) return false;
    if (validUntil && date > validUntil) return false;
    return true;
  }

  /**
   * Evaluates whether a dynamic pricing rule applies to the current pricing context.
   *
   * @param rule - Pricing rule definition.
   * @param date - Stay date being priced.
   * @param daysInAdvance - Days between booking moment and check-in.
   * @param lengthOfStay - Total nights in the requested stay.
   * @param occupancyPercent - Current occupancy percentage context.
   * @returns `true` when the rule condition is satisfied.
   */
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

  /**
   * Converts a pricing-rule adjustment descriptor into a monetary delta for one night.
   *
   * @param baseRate - Current nightly base rate before this rule is applied.
   * @param adjustment - Adjustment descriptor (percentage or fixed amount with operation).
   * @returns Positive or negative amount to add to the current nightly rate.
   */
  private calculateAdjustment(baseRate: number, adjustment: PricingRule['adjustment']): number {
    switch (adjustment.type) {
      case 'PERCENTAGE': {
        const percentChange = baseRate * (adjustment.value / 100);
        if (adjustment.operation === 'SUBTRACT') return -percentChange;
        if (adjustment.operation === 'ADD') return percentChange;
        // MULTIPLY: new rate = baseRate * (value / 100), delta = new rate - baseRate
        return baseRate * (adjustment.value / 100) - baseRate;
      }

      case 'FIXED_AMOUNT':
        return adjustment.operation === 'SUBTRACT' ? -adjustment.value : adjustment.value;

      default:
        return 0;
    }
  }

  /**
   * Builds a human-readable description for a pricing rule.
   *
   * @param rule - Pricing rule to describe.
   * @returns Display label used in nightly adjustment breakdowns.
   */
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

  /**
   * Maps a rate plan entity to the API response contract with validity and dynamic-pricing sections.
   *
   * @param ratePlan - Persisted rate plan entity.
   * @param stats - Optional booking aggregate metrics.
   * @returns Rate plan response with grouped pricing, restrictions, distribution, and inclusions.
   */
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
