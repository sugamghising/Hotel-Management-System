import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const GuestTypeSchema = z.enum([
  'TRANSIENT',
  'CORPORATE',
  'GROUP',
  'CONTRACTUAL',
  'COMP',
  'STAFF',
  'FAMILY_FRIENDS',
]);

export const VIPStatusSchema = z.enum(['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'BLACK']);

export const IDTypeSchema = z.enum([
  'PASSPORT',
  'DRIVERS_LICENSE',
  'NATIONAL_ID',
  'RESIDENCE_PERMIT',
  'MILITARY_ID',
  'OTHER',
]);

export const CountryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 characters (ISO 3166-1 alpha-2)')
  .regex(/^[A-Z]{2}$/i)
  .transform((val) => val.toUpperCase());

export const LanguageCodeSchema = z
  .string()
  .length(2, 'Language code must be 2 characters (ISO 639-1)')
  .regex(/^[a-z]{2}$/i)
  .transform((val) => val.toLowerCase());

// ============================================================================
// CREATE GUEST SCHEMA
// ============================================================================

export const CreateGuestSchema = z.object({
  // Profile (required)
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),

  // Profile (optional)
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  dateOfBirth: z.coerce.date().optional(),
  nationality: CountryCodeSchema.optional(),
  languageCode: LanguageCodeSchema.default('en'),

  // Identification
  idType: IDTypeSchema.optional(),
  idNumber: z.string().max(255).optional(),
  idExpiryDate: z.coerce.date().optional(),

  // Address
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  stateProvince: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  countryCode: CountryCodeSchema.optional(),

  // Classification
  guestType: GuestTypeSchema.default('TRANSIENT'),
  vipStatus: VIPStatusSchema.default('NONE'),
  vipReason: z.string().max(1000).optional(),

  // Corporate
  companyName: z.string().max(255).optional(),
  companyTaxId: z.string().max(100).optional(),

  // Preferences
  roomPreferences: z.record(z.any()).optional(),
  dietaryRequirements: z.string().max(500).optional(),
  specialNeeds: z.string().max(500).optional(),

  // Marketing
  marketingConsent: z.boolean().default(false),
  emailOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),

  // Notes
  internalNotes: z.string().max(5000).optional(),
  alertNotes: z.string().max(500).optional(),
});

// ============================================================================
// UPDATE GUEST SCHEMA
// ============================================================================

export const UpdateGuestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  nationality: CountryCodeSchema.optional().nullable(),
  languageCode: LanguageCodeSchema.optional(),

  idType: IDTypeSchema.optional().nullable(),
  idNumber: z.string().max(255).optional().nullable(),
  idExpiryDate: z.coerce.date().optional().nullable(),

  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  stateProvince: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  countryCode: CountryCodeSchema.optional().nullable(),

  guestType: GuestTypeSchema.optional(),
  vipStatus: VIPStatusSchema.optional(),
  vipReason: z.string().max(1000).optional().nullable(),

  companyName: z.string().max(255).optional().nullable(),
  companyTaxId: z.string().max(100).optional().nullable(),

  roomPreferences: z.record(z.any()).optional().nullable(),
  dietaryRequirements: z.string().max(500).optional().nullable(),
  specialNeeds: z.string().max(500).optional().nullable(),

  marketingConsent: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),

  internalNotes: z.string().max(5000).optional().nullable(),
  alertNotes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const GuestQuerySchema = z.object({
  search: z.string().optional(),
  vipStatus: VIPStatusSchema.optional(),
  guestType: GuestTypeSchema.optional(),
  companyName: z.string().optional(),
  hasEmail: z.coerce.boolean().optional(),
  hasPhone: z.coerce.boolean().optional(),
  lastStayAfter: z.coerce.date().optional(),
  lastStayBefore: z.coerce.date().optional(),
  minStays: z.coerce.number().int().min(0).optional(),
  minRevenue: z.coerce.number().min(0).optional(),
  marketingConsent: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// DUPLICATE DETECTION SCHEMA
// ============================================================================

export const DuplicateDetectionSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  threshold: z.number().min(0).max(100).default(70),
});

// ============================================================================
// MERGE SCHEMAS
// ============================================================================

export const MergeGuestsSchema = z.object({
  targetGuestId: z.string().uuid(),
  sourceGuestIds: z.array(z.string().uuid()).min(1),
  mergeStrategy: z
    .object({
      keepSourceIfNewer: z.boolean().default(false),
      preferSourceFields: z.array(z.string()).default([]),
    })
    .default({}),
});

// ============================================================================
// VIP UPDATE SCHEMA
// ============================================================================

export const UpdateVIPSchema = z.object({
  vipStatus: VIPStatusSchema,
  vipReason: z.string().max(1000).optional(),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const GuestIdParamSchema = z.object({
  guestId: z.string().uuid(),
});

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;
export type GuestQueryInput = z.infer<typeof GuestQuerySchema>;
export type DuplicateDetectionInput = z.infer<typeof DuplicateDetectionSchema>;
export type MergeGuestsInput = z.infer<typeof MergeGuestsSchema>;
export type UpdateVIPInput = z.infer<typeof UpdateVIPSchema>;
