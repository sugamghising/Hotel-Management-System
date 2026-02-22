import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const HotelCodeSchema = z
  .string()
  .min(2, 'Hotel code must be at least 2 characters')
  .max(20, 'Hotel code must not exceed 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, and underscores')
  .transform((val) => val.toUpperCase());

export const PropertyTypeSchema = z.enum([
  'HOTEL',
  'RESORT',
  'MOTEL',
  'HOSTEL',
  'APARTMENT',
  'VILLA',
  'BNB',
]);

export const HotelStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'UNDER_CONSTRUCTION',
  'MAINTENANCE',
  'CLOSED',
]);

export const TimeStringSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format');

export const CountryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 characters (ISO 3166-1 alpha-2)')
  .regex(/^[A-Z]{2}$/i)
  .transform((val) => val.toUpperCase());

export const CurrencyCodeSchema = z
  .string()
  .length(3, 'Currency code must be 3 characters (ISO 4217)')
  .regex(/^[A-Z]{3}$/i)
  .transform((val) => val.toUpperCase());

export const LanguageCodeSchema = z
  .string()
  .length(2, 'Language code must be 2 characters (ISO 639-1)')
  .regex(/^[a-z]{2}$/i)
  .transform((val) => val.toLowerCase());

// ============================================================================
// CREATE HOTEL SCHEMA
// ============================================================================

export const CreateHotelSchema = z.object({
  code: HotelCodeSchema,
  name: z.string().min(2).max(255),
  legalName: z.string().min(2).max(255).optional(),
  brand: z.string().max(100).optional(),
  propertyType: PropertyTypeSchema.default('HOTEL'),
  starRating: z.number().min(1).max(5).multipleOf(0.5).optional(),

  // Contact
  email: z.string().email(),
  phone: z.string().max(50),
  fax: z.string().max(50).optional(),
  website: z.string().url().optional(),

  // Address
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  stateProvince: z.string().max(100).optional(),
  postalCode: z.string().max(20),
  countryCode: CountryCodeSchema,

  // Geolocation
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().max(50).default('UTC'),

  // Operational
  checkInTime: TimeStringSchema.default('15:00'),
  checkOutTime: TimeStringSchema.default('11:00'),
  currencyCode: CurrencyCodeSchema.default('USD'),
  defaultLanguage: LanguageCodeSchema.default('en'),

  // Capacity
  totalFloors: z.number().int().positive().optional(),

  // Configuration
  amenities: z.array(z.string()).default([]),
  operationalSettings: z.record(z.any()).default({}),
  policies: z.record(z.any()).default({}),

  // Status
  status: HotelStatusSchema.default('ACTIVE'),
  openingDate: z.coerce.date().optional(),
});

// ============================================================================
// UPDATE HOTEL SCHEMA
// ============================================================================

export const UpdateHotelSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legalName: z.string().min(2).max(255).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  starRating: z.number().min(1).max(5).multipleOf(0.5).optional().nullable(),
  propertyType: PropertyTypeSchema.optional(),

  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  fax: z.string().max(50).optional().nullable(),
  website: z.string().url().optional().nullable(),

  addressLine1: z.string().min(1).max(255).optional(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().min(1).max(100).optional(),
  stateProvince: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional(),
  countryCode: CountryCodeSchema.optional(),

  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone: z.string().max(50).optional(),

  checkInTime: TimeStringSchema.optional(),
  checkOutTime: TimeStringSchema.optional(),
  currencyCode: CurrencyCodeSchema.optional(),
  defaultLanguage: LanguageCodeSchema.optional(),

  amenities: z.array(z.string()).optional(),
  operationalSettings: z.record(z.any()).optional(),
  policies: z.record(z.any()).optional(),

  status: HotelStatusSchema.optional(),
  openingDate: z.coerce.date().optional().nullable(),
  closingDate: z.coerce.date().optional().nullable(),
});

// ============================================================================
// CLONE HOTEL SCHEMA
// ============================================================================

export const CloneHotelSchema = z.object({
  targetOrganizationId: z.string().uuid().optional(),
  newCode: HotelCodeSchema,
  newName: z.string().min(2).max(255),
  copyRoomTypes: z.boolean().default(true),
  copyRatePlans: z.boolean().default(false),
  copySettings: z.boolean().default(true),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const HotelQuerySchema = z.object({
  status: HotelStatusSchema.optional(),
  propertyType: PropertyTypeSchema.optional(),
  countryCode: CountryCodeSchema.optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const AvailabilityCalendarQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  roomTypeId: z.string().uuid().optional(),
});

export const UpdateHotelSettingsSchema = z.object({
  operational: z.record(z.any()).optional(),
  policies: z.record(z.any()).optional(),
  amenities: z.array(z.string()).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateHotelInput = z.infer<typeof CreateHotelSchema>;
export type UpdateHotelInput = z.infer<typeof UpdateHotelSchema>;
export type CloneHotelInput = z.infer<typeof CloneHotelSchema>;
export type HotelQueryInput = z.infer<typeof HotelQuerySchema>;
export type AvailabilityCalendarQueryInput = z.infer<typeof AvailabilityCalendarQuerySchema>;
