// src/features/hotels/index.ts

// Controller & Service
export { HotelController, hotelController } from './hotel.controller';
export { HotelService, hotelService } from './hotel.service';
export { HotelRepository, hotelRepository } from './hotel.repository';
export { default as hotelsRoutes } from './hotel.routes';
export { hotelRegistry } from './hotel.registry';

// Types
export type {
  Hotel,
  HotelStatus,
  PropertyType,
  HotelOperationalSettings,
  HotelPolicies,
  CreateHotelInput,
  UpdateHotelInput,
  HotelResponse,
  HotelStats,
  HotelDashboardData,
  HotelCloneInput,
  HotelQueryFilters,
  RoomStatusSummary,
} from './hotel.types';

// Schemas & DTOs
export {
  CreateHotelSchema,
  UpdateHotelSchema,
  CloneHotelSchema,
  HotelQuerySchema,
  AvailabilityCalendarQuerySchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  HotelCodeSchema,
  PropertyTypeSchema,
  HotelStatusSchema,
  TimeStringSchema,
  CountryCodeSchema,
  CurrencyCodeSchema,
  LanguageCodeSchema,
  // Types
  type CreateHotelInput as CreateHotelInputType,
  type UpdateHotelInput as UpdateHotelInputType,
  type CloneHotelInput as CloneHotelInputType,
  type HotelQueryInput,
  type AvailabilityCalendarQueryInput,
} from './hotel.schema';

export type {
  HotelListResponse as HotelListResponseDTO,
  RoomAvailabilityResponse,
} from './hotel.dto';
