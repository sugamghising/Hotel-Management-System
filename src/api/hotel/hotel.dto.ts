export {
  CreateHotelSchema,
  UpdateHotelSchema,
  CloneHotelSchema,
  HotelQuerySchema,
  AvailabilityCalendarQuerySchema,
  UpdateHotelSettingsSchema,
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
  type CreateHotelInput,
  type UpdateHotelInput,
  type CloneHotelInput,
  type HotelQueryInput,
  type AvailabilityCalendarQueryInput,
} from './hotel.schema';

// API-specific DTOs
export interface HotelListResponse {
  hotels: Array<{
    id: string;
    code: string;
    name: string;
    propertyType: string;
    starRating: number | null;
    city: string;
    countryCode: string;
    status: string;
    totalRooms: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RoomAvailabilityResponse {
  date: string;
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  totalRooms: number;
  sold: number;
  available: number;
  outOfOrder: number;
  blocked: number;
  rateOverride: number | null;
  restrictions: {
    minStay: number | null;
    maxStay: number | null;
    stopSell: boolean;
    closedToArrival: boolean;
    closedToDeparture: boolean;
  };
}
