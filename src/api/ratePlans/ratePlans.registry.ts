import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  CalendarQuerySchema,
  CancellationPolicySchema,
  ChannelCodeSchema,
  CloneRatePlanSchema,
  CreateRatePlanSchema,
  HotelIdParamSchema,
  MealPlanSchema,
  OrganizationIdParamSchema,
  PricingRuleSchema,
  PricingTypeSchema,
  RateCalculationSchema,
  RateOverrideBulkSchema,
  RateOverrideSchema,
  RatePlanIdParamSchema,
  RatePlanQuerySchema,
  UpdateRatePlanSchema,
} from './ratePlans.schema';

// ============================================================================
// Response Schemas with OpenAPI metadata
// ============================================================================

const PricingInfoSchema = z
  .object({
    type: PricingTypeSchema,
    baseRate: z.number(),
    currencyCode: z.string(),
    calculatedRate: z.number().optional(),
  })
  .openapi('PricingInfo');

const RestrictionsSchema = z
  .object({
    minAdvanceDays: z.number().int().nullable(),
    maxAdvanceDays: z.number().int().nullable(),
    minStay: z.number().int(),
    maxStay: z.number().int().nullable(),
    isRefundable: z.boolean(),
    cancellationPolicy: CancellationPolicySchema,
  })
  .openapi('Restrictions');

const DistributionSchema = z
  .object({
    isPublic: z.boolean(),
    channelCodes: z.array(z.string()),
  })
  .openapi('Distribution');

const InclusionsSchema = z
  .object({
    mealPlan: MealPlanSchema,
    includedAmenities: z.array(z.string()),
  })
  .openapi('Inclusions');

const DynamicPricingSchema = z
  .object({
    rules: z.array(PricingRuleSchema),
    isActive: z.boolean(),
  })
  .openapi('DynamicPricing');

const ValiditySchema = z
  .object({
    isActive: z.boolean(),
    validFrom: z.string().datetime().nullable(),
    validUntil: z.string().datetime().nullable(),
    isCurrentlyValid: z.boolean(),
  })
  .openapi('Validity');

const RatePlanStatsSchema = z
  .object({
    bookingsCount: z.number().int(),
    totalRevenue: z.number(),
    averageRate: z.number(),
  })
  .openapi('RatePlanStats');

const RatePlanResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    hotelId: z.string().uuid(),
    roomTypeId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    pricing: PricingInfoSchema,
    restrictions: RestrictionsSchema,
    distribution: DistributionSchema,
    inclusions: InclusionsSchema,
    dynamicPricing: DynamicPricingSchema,
    validity: ValiditySchema,
    stats: RatePlanStatsSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('RatePlanResponse');

const RatePlanListItemSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    roomType: z.object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
    }),
    baseRate: z.number(),
    currencyCode: z.string(),
    isActive: z.boolean(),
    isPublic: z.boolean(),
    validFrom: z.string().datetime().nullable(),
    validUntil: z.string().datetime().nullable(),
  })
  .openapi('RatePlanListItem');

const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi('RatePlanPagination');

const RatePlanListResponseSchema = z
  .object({
    ratePlans: z.array(RatePlanListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('RatePlanListResponse');

const RateOverrideResponseSchema = z
  .object({
    id: z.string().uuid(),
    ratePlanId: z.string().uuid(),
    date: z.string().datetime(),
    rate: z.number(),
    stopSell: z.boolean(),
    minStay: z.number().int().nullable(),
    reason: z.string().nullable(),
  })
  .openapi('RateOverrideResponse');

const CalendarDateEntrySchema = z
  .object({
    date: z.string(),
    baseRate: z.number(),
    overrideRate: z.number().nullable(),
    finalRate: z.number(),
    stopSell: z.boolean(),
    minStay: z.number().int().nullable(),
    isValid: z.boolean(),
  })
  .openapi('CalendarDateEntry');

const RateCalendarResponseSchema = z
  .object({
    ratePlanId: z.string().uuid(),
    ratePlanCode: z.string(),
    ratePlanName: z.string(),
    roomTypeId: z.string().uuid(),
    roomTypeCode: z.string(),
    currencyCode: z.string(),
    dates: z.array(CalendarDateEntrySchema),
  })
  .openapi('RateCalendarResponse');

const NightlyRateSchema = z
  .object({
    date: z.string(),
    baseRate: z.number(),
    adjustments: z.array(
      z.object({
        ruleType: z.string(),
        description: z.string(),
        amount: z.number(),
      })
    ),
    finalRate: z.number(),
  })
  .openapi('NightlyRate');

const RateCalculationResultSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    roomTypeName: z.string(),
    availableRatePlans: z.array(
      z.object({
        ratePlanId: z.string().uuid(),
        ratePlanCode: z.string(),
        ratePlanName: z.string(),
        nightlyRates: z.array(NightlyRateSchema),
        totalNights: z.number().int(),
        subtotal: z.number(),
        taxes: z.number(),
        total: z.number(),
        currencyCode: z.string(),
        restrictions: z.object({
          minStayMet: z.boolean(),
          maxStayMet: z.boolean(),
          advanceBookingMet: z.boolean(),
          cancellationPolicy: CancellationPolicySchema,
        }),
        inclusions: z.object({
          mealPlan: MealPlanSchema,
          amenities: z.array(z.string()),
        }),
      })
    ),
    bestAvailableRate: z.number().nullable(),
  })
  .openapi('RateCalculationResult');

const BulkOverrideResultSchema = z
  .object({
    updatedCount: z.number().int(),
  })
  .openapi('BulkOverrideResult');

// ============================================================================
// Shared param schemas
// ============================================================================

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelRatePlanParams = OrgHotelParams.merge(RatePlanIdParamSchema);

// ============================================================================
// OpenAPI Registry
// ============================================================================

export const ratePlansRegistry = new OpenAPIRegistry();

// Register schemas
ratePlansRegistry.register('RatePlanResponse', RatePlanResponseSchema);
ratePlansRegistry.register('RatePlanListItem', RatePlanListItemSchema);
ratePlansRegistry.register('RatePlanListResponse', RatePlanListResponseSchema);
ratePlansRegistry.register('RateOverrideResponse', RateOverrideResponseSchema);
ratePlansRegistry.register('RateCalendarResponse', RateCalendarResponseSchema);
ratePlansRegistry.register('RateCalculationResult', RateCalculationResultSchema);
ratePlansRegistry.register('CreateRatePlanInput', CreateRatePlanSchema);
ratePlansRegistry.register('UpdateRatePlanInput', UpdateRatePlanSchema);
ratePlansRegistry.register('RateOverrideInput', RateOverrideSchema);
ratePlansRegistry.register('RateOverrideBulkInput', RateOverrideBulkSchema);
ratePlansRegistry.register('RateCalculationInput', RateCalculationSchema);
ratePlansRegistry.register('CloneRatePlanInput', CloneRatePlanSchema);
ratePlansRegistry.register('PricingType', PricingTypeSchema);
ratePlansRegistry.register('MealPlan', MealPlanSchema);
ratePlansRegistry.register('CancellationPolicy', CancellationPolicySchema);
ratePlansRegistry.register('ChannelCode', ChannelCodeSchema);

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans',
  tags: ['Rate Plans'],
  summary: 'Create a new rate plan',
  description: 'Create a new rate plan for a hotel room type with pricing rules and restrictions',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateRatePlanSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ ratePlan: RatePlanResponseSchema }),
    'Rate plan created successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans',
  tags: ['Rate Plans'],
  summary: 'List rate plans',
  description: 'Get a paginated list of rate plans for a hotel with optional filters',
  request: {
    params: OrgHotelParams,
    query: RatePlanQuerySchema,
  },
  responses: createApiResponse(RatePlanListResponseSchema, 'Rate plans retrieved successfully'),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}',
  tags: ['Rate Plans'],
  summary: 'Get rate plan by ID',
  description:
    'Retrieve detailed information about a specific rate plan, optionally including booking stats',
  request: {
    params: OrgHotelRatePlanParams,
    query: z.object({
      stats: z.coerce.boolean().optional().openapi({ description: 'Include booking statistics' }),
    }),
  },
  responses: createApiResponse(
    z.object({ ratePlan: RatePlanResponseSchema }),
    'Rate plan retrieved successfully'
  ),
});

// ============================================================================
// PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}',
  tags: ['Rate Plans'],
  summary: 'Update rate plan',
  description:
    'Update rate plan details including pricing, restrictions, and distribution settings',
  request: {
    params: OrgHotelRatePlanParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateRatePlanSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ ratePlan: RatePlanResponseSchema }),
    'Rate plan updated successfully'
  ),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}',
  tags: ['Rate Plans'],
  summary: 'Delete rate plan',
  description: 'Soft delete a rate plan. Cannot delete rate plans with active bookings.',
  request: {
    params: OrgHotelRatePlanParams,
  },
  responses: {
    204: {
      description: 'Rate plan deleted successfully',
    },
  },
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/clone
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/clone',
  tags: ['Rate Plans'],
  summary: 'Clone rate plan',
  description:
    'Create a copy of an existing rate plan with a new code and name, optionally adjusting the rate',
  request: {
    params: OrgHotelRatePlanParams,
    body: {
      content: {
        'application/json': {
          schema: CloneRatePlanSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ ratePlan: RatePlanResponseSchema }),
    'Rate plan cloned successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/calendar
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/calendar',
  tags: ['Rate Plans'],
  summary: 'Get rate calendar',
  description:
    'Retrieve rate calendar showing base rates, overrides, and final rates for a date range',
  request: {
    params: OrgHotelRatePlanParams,
    query: CalendarQuerySchema,
  },
  responses: createApiResponse(
    z.object({ calendar: RateCalendarResponseSchema }),
    'Rate calendar retrieved successfully'
  ),
});

// ============================================================================
// PUT /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'put',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides',
  tags: ['Rate Plans'],
  summary: 'Set rate override',
  description: 'Create or update a rate override for a specific date',
  request: {
    params: OrgHotelRatePlanParams,
    body: {
      content: {
        'application/json': {
          schema: RateOverrideSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ override: RateOverrideResponseSchema }),
    'Rate override updated successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides/bulk
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides/bulk',
  tags: ['Rate Plans'],
  summary: 'Bulk update rate overrides',
  description:
    'Create or update rate overrides for a date range, optionally filtered by days of week',
  request: {
    params: OrgHotelRatePlanParams,
    body: {
      content: {
        'application/json': {
          schema: RateOverrideBulkSchema,
        },
      },
    },
  },
  responses: createApiResponse(BulkOverrideResultSchema, 'Bulk overrides updated successfully'),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/{ratePlanId}/overrides',
  tags: ['Rate Plans'],
  summary: 'Delete rate override',
  description: 'Remove a rate override for a specific date',
  request: {
    params: OrgHotelRatePlanParams,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            date: z.coerce.date().openapi({ description: 'Date of the override to remove' }),
          }),
        },
      },
    },
  },
  responses: {
    204: {
      description: 'Rate override deleted successfully',
    },
  },
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/calculate
// ============================================================================
ratePlansRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rate-plans/calculate',
  tags: ['Rate Plans'],
  summary: 'Calculate rates',
  description:
    'Calculate available rates for a room type and date range. Used by the booking engine to show pricing options.',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: RateCalculationSchema,
        },
      },
    },
  },
  responses: createApiResponse(RateCalculationResultSchema, 'Rates calculated successfully'),
});
