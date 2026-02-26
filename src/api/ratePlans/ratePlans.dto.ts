export {
  CreateRatePlanSchema,
  UpdateRatePlanSchema,
  RateOverrideSchema,
  RateOverrideBulkSchema,
  RateCalculationSchema,
  CloneRatePlanSchema,
  PricingRuleSchema,
  RatePlanQuerySchema,
  CalendarQuerySchema,
  RatePlanIdParamSchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  RatePlanCodeSchema,
  PricingTypeSchema,
  MealPlanSchema,
  CancellationPolicySchema,
  ChannelCodeSchema,
  // Types
  type CreateRatePlanInput,
  type UpdateRatePlanInput,
  type RateOverrideInput,
  type RateOverrideBulkInput,
  type RateCalculationInput,
  type CloneRatePlanInput,
  type PricingRule as PricingRuleType,
  type RatePlanQueryInput,
  type CalendarQueryInput,
} from './ratePlans.schema';

// API-specific DTOs
export interface RatePlanListResponse {
  ratePlans: Array<{
    id: string;
    code: string;
    name: string;
    roomType: {
      id: string;
      code: string;
      name: string;
    };
    baseRate: number;
    currencyCode: string;
    isActive: boolean;
    isPublic: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RateCalculationResponse {
  results: unknown[];
  bestRate: number | null;
  currencyCode: string;
}
