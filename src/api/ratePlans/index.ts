// Controller & Service
export { RatePlansController, ratePlansController } from './ratePlans.controller';
export { RatePlansService, ratePlansService } from './ratePlans.service';
export { RatePlansRepository, ratePlansRepository } from './ratePlans.repository';
export { default as ratePlansRoutes } from './ratePlans.routes';

// Types
export type {
  RatePlan,
  RateOverride,
  PricingType,
  MealPlan,
  CancellationPolicy,
  PricingRule,
  CreateRatePlanInput,
  UpdateRatePlanInput,
  RatePlanResponse,
  RateOverrideInput,
  RateOverrideBulkInput,
  RateCalculationInput,
  RateCalculationResult,
  RatePlanQueryFilters,
  RateCalendarResponse,
  RatePlanCloneInput,
} from './ratePlans.types';

// Schemas & DTOs
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
  type CreateRatePlanInput as CreateRatePlanInputType,
  type UpdateRatePlanInput as UpdateRatePlanInputType,
  type RateOverrideInput as RateOverrideInputType,
  type RateOverrideBulkInput as RateOverrideBulkInputType,
  type RateCalculationInput as RateCalculationInputType,
  type CloneRatePlanInput as CloneRatePlanInputType,
  type PricingRule as PricingRuleType,
  type RatePlanQueryInput,
  type CalendarQueryInput,
} from './ratePlans.schema';

export type {
  RatePlanListResponse as RatePlanListResponseDTO,
  RateCalculationResponse,
} from './ratePlans.dto';

// OpenAPI / Registry
export { ratePlansRegistry } from './ratePlans.registry';
