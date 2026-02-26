import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const RatePlanCodeSchema = z
  .string()
  .min(2, 'Rate plan code must be at least 2 characters')
  .max(50, 'Rate plan code must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, and underscores')
  .transform((val) => val.toUpperCase());

export const PricingTypeSchema = z.enum(['DAILY', 'PACKAGE', 'DERIVED', 'NEGOTIATED']);
export const MealPlanSchema = z.enum([
  'ROOM_ONLY',
  'BREAKFAST',
  'HALF_BOARD',
  'FULL_BOARD',
  'ALL_INCLUSIVE',
]);
export const CancellationPolicySchema = z.enum([
  'FLEXIBLE',
  'MODERATE',
  'STRICT',
  'NON_REFUNDABLE',
]);

export const ChannelCodeSchema = z.enum([
  'DIRECT_WEB',
  'DIRECT_PHONE',
  'DIRECT_WALKIN',
  'BOOKING_COM',
  'EXPEDIA',
  'AIRBNB',
  'AGODA',
  'TRIPADVISOR',
  'CORPORATE',
  'TRAVEL_AGENT',
  'METASEARCH',
]);

// ============================================================================
// PRICING RULE SCHEMAS
// ============================================================================

export const PricingRuleSchema = z.object({
  type: z.enum(['EARLY_BIRD', 'LAST_MINUTE', 'LENGTH_OF_STAY', 'OCCUPANCY_BASED', 'DAY_OF_WEEK']),
  condition: z.object({
    daysInAdvance: z.number().int().min(0).optional(),
    minNights: z.number().int().min(1).optional(),
    maxNights: z.number().int().min(1).optional(),
    occupancyThreshold: z.number().int().min(0).max(100).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    dateRange: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
  }),
  adjustment: z.object({
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    value: z.number(),
    operation: z.enum(['ADD', 'SUBTRACT', 'MULTIPLY']),
  }),
  priority: z.number().int().min(0).default(0),
});

// ============================================================================
// CREATE RATE PLAN SCHEMA
// ============================================================================

export const CreateRatePlanSchema = z
  .object({
    code: RatePlanCodeSchema,
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    roomTypeId: z.string().uuid('Invalid room type ID'),

    pricingType: PricingTypeSchema.default('DAILY'),
    baseRate: z.number().positive('Base rate must be positive').max(999999),
    currencyCode: z.string().length(3).default('USD'),

    // Restrictions
    minAdvanceDays: z.number().int().min(0).optional(),
    maxAdvanceDays: z.number().int().min(0).optional(),
    minStay: z.number().int().min(1).default(1),
    maxStay: z.number().int().min(1).optional(),
    isRefundable: z.boolean().default(true),
    cancellationPolicy: CancellationPolicySchema.default('FLEXIBLE'),

    // Channels
    isPublic: z.boolean().default(true),
    channelCodes: z.array(z.string()).default(['DIRECT_WEB']),

    // Inclusions
    mealPlan: MealPlanSchema.default('ROOM_ONLY'),
    includedAmenities: z.array(z.string()).default([]),

    // Dynamic pricing
    pricingRules: z.array(PricingRuleSchema).max(10).default([]),

    // Validity
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.validFrom && data.validUntil && data.validFrom > data.validUntil) {
        return false;
      }
      return true;
    },
    {
      message: 'Valid from date must be before valid until date',
      path: ['validUntil'],
    }
  )
  .refine(
    (data) => {
      if (data.minAdvanceDays && data.maxAdvanceDays && data.minAdvanceDays > data.maxAdvanceDays) {
        return false;
      }
      return true;
    },
    {
      message: 'Min advance days cannot exceed max advance days',
      path: ['maxAdvanceDays'],
    }
  );

// ============================================================================
// UPDATE RATE PLAN SCHEMA
// ============================================================================

export const UpdateRatePlanSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),

  baseRate: z.number().positive().max(999999).optional(),

  minAdvanceDays: z.number().int().min(0).optional().nullable(),
  maxAdvanceDays: z.number().int().min(0).optional().nullable(),
  minStay: z.number().int().min(1).optional(),
  maxStay: z.number().int().min(1).optional().nullable(),
  isRefundable: z.boolean().optional(),
  cancellationPolicy: CancellationPolicySchema.optional(),

  isPublic: z.boolean().optional(),
  channelCodes: z.array(z.string()).optional(),

  mealPlan: MealPlanSchema.optional(),
  includedAmenities: z.array(z.string()).optional(),

  pricingRules: z.array(PricingRuleSchema).max(10).optional().nullable(),

  isActive: z.boolean().optional(),
  validFrom: z.coerce.date().optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
});

// ============================================================================
// RATE OVERRIDE SCHEMAS
// ============================================================================

export const RateOverrideSchema = z.object({
  date: z.coerce.date(),
  rate: z.number().positive(),
  stopSell: z.boolean().default(false),
  minStay: z.number().int().min(1).optional().nullable(),
  reason: z.string().max(255).optional(),
});

export const RateOverrideBulkSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    rate: z.number().positive().optional(),
    stopSell: z.boolean().optional(),
    minStay: z.number().int().min(1).optional().nullable(),
    reason: z.string().max(255).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  });

// ============================================================================
// CALCULATION SCHEMAS
// ============================================================================

export const RateCalculationSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    adults: z.number().int().min(1).default(2),
    children: z.number().int().min(0).default(0),
    channelCode: z.string().optional(),
    promoCode: z.string().optional(),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

// ============================================================================
// CLONE SCHEMA
// ============================================================================

export const CloneRatePlanSchema = z.object({
  newCode: RatePlanCodeSchema,
  newName: z.string().min(2).max(100),
  roomTypeId: z.string().uuid().optional(),
  adjustRateByPercent: z.number().min(-90).max(100).optional(),
});

// ============================================================================
// PARAM & QUERY SCHEMAS
// ============================================================================

export const RatePlanIdParamSchema = z.object({
  ratePlanId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const RatePlanQuerySchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
  channelCode: z.string().optional(),
  validOnDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const CalendarQuerySchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine(
    (data) => {
      const daysDiff = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 365;
    },
    {
      message: 'Date range cannot exceed 365 days',
      path: ['endDate'],
    }
  );

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateRatePlanInput = z.infer<typeof CreateRatePlanSchema>;
export type UpdateRatePlanInput = z.infer<typeof UpdateRatePlanSchema>;
export type RateOverrideInput = z.infer<typeof RateOverrideSchema>;
export type RateOverrideBulkInput = z.infer<typeof RateOverrideBulkSchema>;
export type RateCalculationInput = z.infer<typeof RateCalculationSchema>;
export type CloneRatePlanInput = z.infer<typeof CloneRatePlanSchema>;
export type PricingRule = z.infer<typeof PricingRuleSchema>;
export type RatePlanQueryInput = z.infer<typeof RatePlanQuerySchema>;
export type CalendarQueryInput = z.infer<typeof CalendarQuerySchema>;
