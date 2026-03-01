// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type PricingType = 'DAILY' | 'PACKAGE' | 'DERIVED' | 'NEGOTIATED';
export type MealPlan = 'ROOM_ONLY' | 'BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD' | 'ALL_INCLUSIVE';
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT' | 'NON_REFUNDABLE';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface RatePlan {
  id: string;
  organizationId: string;
  hotelId: string;
  roomTypeId: string;

  // Identification
  code: string;
  name: string;
  description: string | null;

  // Pricing
  pricingType: PricingType;
  baseRate: number;
  currencyCode: string;

  // Restrictions
  minAdvanceDays: number | null;
  maxAdvanceDays: number | null;
  minStay: number;
  maxStay: number | null;
  isRefundable: boolean;
  cancellationPolicy: CancellationPolicy;

  // Channel distribution
  isPublic: boolean;
  channelCodes: string[]; // BOOKING_COM, EXPEDIA, DIRECT, etc.

  // Inclusions
  mealPlan: MealPlan;
  includedAmenities: string[];

  // Dynamic pricing rules (JSONB)
  pricingRules: PricingRule[] | null;

  // Validity
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PricingRule {
  type: 'EARLY_BIRD' | 'LAST_MINUTE' | 'LENGTH_OF_STAY' | 'OCCUPANCY_BASED' | 'DAY_OF_WEEK';
  condition: {
    daysInAdvance?: number;
    minNights?: number;
    maxNights?: number;
    occupancyThreshold?: number;
    daysOfWeek?: number[];
    dateRange?: { from: string; to: string };
  };
  adjustment: {
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    operation: 'ADD' | 'SUBTRACT' | 'MULTIPLY';
  };
  priority: number;
}

export interface RateOverride {
  id: string;
  ratePlanId: string;
  date: Date;
  rate: number;
  stopSell: boolean;
  minStay: number | null;
  reason: string | null;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateRatePlanInput {
  code: string;
  name: string;
  description?: string;
  roomTypeId: string;

  pricingType?: PricingType;
  baseRate: number;
  currencyCode?: string;

  // Restrictions
  minAdvanceDays?: number;
  maxAdvanceDays?: number;
  minStay?: number;
  maxStay?: number;
  isRefundable?: boolean;
  cancellationPolicy?: CancellationPolicy;

  // Channels
  isPublic?: boolean;
  channelCodes?: string[];

  // Inclusions
  mealPlan?: MealPlan;
  includedAmenities?: string[];

  // Dynamic pricing
  pricingRules?: PricingRule[];

  // Validity
  validFrom?: Date;
  validUntil?: Date;
}

export interface UpdateRatePlanInput {
  name?: string;
  description?: string | null;

  baseRate?: number;

  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
  minStay?: number;
  maxStay?: number | null;
  isRefundable?: boolean;
  cancellationPolicy?: CancellationPolicy;

  isPublic?: boolean;
  channelCodes?: string[];

  mealPlan?: MealPlan;
  includedAmenities?: string[];

  pricingRules?: PricingRule[] | null;

  isActive?: boolean;
  validFrom?: Date | null;
  validUntil?: Date | null;
}

export interface RatePlanResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  roomTypeId: string;

  code: string;
  name: string;
  description: string | null;

  pricing: {
    type: PricingType;
    baseRate: number;
    currencyCode: string;
    calculatedRate?: number; // With rules applied
  };

  restrictions: {
    minAdvanceDays: number | null;
    maxAdvanceDays: number | null;
    minStay: number;
    maxStay: number | null;
    isRefundable: boolean;
    cancellationPolicy: CancellationPolicy;
  };

  distribution: {
    isPublic: boolean;
    channelCodes: string[];
  };

  inclusions: {
    mealPlan: MealPlan;
    includedAmenities: string[];
  };

  dynamicPricing: {
    rules: PricingRule[];
    isActive: boolean;
  };

  validity: {
    isActive: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
    isCurrentlyValid: boolean;
  };

  stats?: {
    bookingsCount: number;
    totalRevenue: number;
    averageRate: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface RateOverrideInput {
  date: Date;
  rate: number;
  stopSell?: boolean;
  minStay?: number | null;
  reason?: string;
}

export interface RateOverrideBulkInput {
  startDate: Date;
  endDate: Date;
  rate?: number;
  stopSell?: boolean;
  minStay?: number | null;
  reason?: string;
  daysOfWeek?: number[];
}

export interface RateCalendarResponse {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  roomTypeId: string;
  roomTypeCode: string;
  currencyCode: string;
  dates: Array<{
    date: string;
    baseRate: number;
    overrideRate: number | null;
    finalRate: number;
    stopSell: boolean;
    minStay: number | null;
    isValid: boolean;
  }>;
}

export interface RateCalculationInput {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  channelCode?: string;
  promoCode?: string;
}

export interface RateCalculationResult {
  roomTypeId: string;
  roomTypeName: string;
  availableRatePlans: Array<{
    ratePlanId: string;
    ratePlanCode: string;
    ratePlanName: string;
    nightlyRates: Array<{
      date: string;
      baseRate: number;
      adjustments: Array<{
        ruleType: string;
        description: string;
        amount: number;
      }>;
      finalRate: number;
    }>;
    totalNights: number;
    subtotal: number;
    taxes: number;
    total: number;
    currencyCode: string;

    restrictions: {
      minStayMet: boolean;
      maxStayMet: boolean;
      advanceBookingMet: boolean;
      cancellationPolicy: CancellationPolicy;
    };

    inclusions: {
      mealPlan: MealPlan;
      amenities: string[];
    };
  }>;
  bestAvailableRate: number | null;
}

export interface RatePlanQueryFilters {
  roomTypeId?: string;
  isActive?: boolean;
  isPublic?: boolean;
  channelCode?: string;
  validOnDate?: Date;
  search?: string;
}

export interface RatePlanCloneInput {
  newCode: string;
  newName: string;
  roomTypeId?: string; // Optional: clone to different room type
  adjustRateByPercent?: number;
}
