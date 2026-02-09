// src/features/organizations/organization.schema.ts
import { z } from 'zod';
import { SUBSCRIPTION_CONFIG } from './organization.types';

// ============================================================================
// BASE SCHEMAS (Reusable components)
// ============================================================================

export const OrganizationCodeSchema = z
  .string()
  .min(2, 'Organization code must be at least 2 characters')
  .max(50, 'Organization code must not exceed 50 characters')
  .regex(
    /^[A-Z0-9_-]+$/,
    'Code can only contain uppercase letters, numbers, hyphens, and underscores'
  )
  .transform((val) => val.toUpperCase().trim());

export const OrganizationNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name must not exceed 255 characters')
  .trim();

export const EmailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const PhoneSchema = z
  .string()
  .max(50, 'Phone number too long')
  .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
  .nullable()
  .optional();

export const UrlSchema = z
  .string()
  .url('Invalid URL format')
  .max(500, 'URL too long')
  .nullable()
  .optional()
  .or(z.literal(''));

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const OrganizationTypeSchema = z.enum(['CHAIN', 'INDEPENDENT']).default('INDEPENDENT');

export const SubscriptionTierSchema = z.enum(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE']);

export const SubscriptionStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']);

// ============================================================================
// CREATE SCHEMA
// ============================================================================

export const OrganizationCreateSchema = z.object({
  code: OrganizationCodeSchema,
  name: OrganizationNameSchema,
  legalName: OrganizationNameSchema,
  organizationType: OrganizationTypeSchema,
  taxId: z.string().max(100).nullable().optional(),
  email: EmailSchema,
  phone: PhoneSchema,
  website: UrlSchema,
  logoUrl: UrlSchema,

  // Subscription (optional, defaults to TRIAL)
  subscriptionTier: SubscriptionTierSchema.default('TRIAL'),

  // Limits (optional, defaults from tier config)
  maxHotels: z.number().int().positive().optional(),
  maxRooms: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),

  // Settings
  settings: z.record(z.unknown()).default({}),
  enabledFeatures: z.array(z.string()).default([]),
});

// Apply tier defaults if limits not provided
export const OrganizationCreateSchemaWithDefaults = OrganizationCreateSchema.transform((data) => {
  const tierConfig = SUBSCRIPTION_CONFIG[data.subscriptionTier];

  return {
    ...data,
    maxHotels: data.maxHotels ?? tierConfig.hotels,
    maxRooms: data.maxRooms ?? tierConfig.rooms,
    maxUsers: data.maxUsers ?? tierConfig.users,
    enabledFeatures: data.enabledFeatures.length > 0 ? data.enabledFeatures : tierConfig.features,
  };
});

// ============================================================================
// UPDATE SCHEMA
// ============================================================================

export const OrganizationUpdateSchema = z
  .object({
    name: OrganizationNameSchema.optional(),
    legalName: OrganizationNameSchema.optional(),
    taxId: z.string().max(100).nullable().optional(),
    email: EmailSchema.optional(),
    phone: PhoneSchema,
    website: UrlSchema,
    logoUrl: UrlSchema,
    organizationType: OrganizationTypeSchema.optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict(); // No unknown properties

// ============================================================================
// SUBSCRIPTION UPDATE SCHEMA
// ============================================================================

export const SubscriptionUpdateSchema = z.object({
  tier: SubscriptionTierSchema,
  // Optional: custom limits (only for ENTERPRISE usually)
  customLimits: z
    .object({
      maxHotels: z.number().int().positive(),
      maxRooms: z.number().int().positive(),
      maxUsers: z.number().int().positive(),
    })
    .optional(),
});

// ============================================================================
// QUERY/FILTER SCHEMAS
// ============================================================================

export const OrganizationQuerySchema = z.object({
  page: z
    .string()
    .or(z.number())
    .optional()
    .transform((val) => (val ? Number(val) : 1))
    .refine((val) => val > 0, 'Page must be positive'),

  limit: z
    .string()
    .or(z.number())
    .optional()
    .transform((val) => (val ? Number(val) : 10))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),

  search: z.string().optional(),

  status: SubscriptionStatusSchema.optional(),

  type: OrganizationTypeSchema.optional(),

  sortBy: z.enum(['createdAt', 'name', 'code', 'subscriptionTier']).default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const OrganizationIdParamSchema = z.object({
  id: z.string().uuid('Invalid organization ID format'),
});

// ============================================================================
// RESPONSE SCHEMAS (For API documentation/validation)
// ============================================================================

export const OrganizationResponseSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  legalName: z.string(),
  organizationType: OrganizationTypeSchema,
  email: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  subscription: z.object({
    tier: SubscriptionTierSchema,
    status: SubscriptionStatusSchema,
    maxHotels: z.number(),
    maxRooms: z.number(),
    maxUsers: z.number(),
    endDate: z.date().nullable(),
  }),
  stats: z
    .object({
      hotelCount: z.number(),
      userCount: z.number(),
      roomCount: z.number().optional(),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// TYPE EXPORTS (Infer from schemas)
// ============================================================================

export type OrganizationCreateInput = z.infer<typeof OrganizationCreateSchema>;
export type OrganizationCreateWithDefaults = z.infer<typeof OrganizationCreateSchemaWithDefaults>;
export type OrganizationUpdateInput = z.infer<typeof OrganizationUpdateSchema>;
export type OrganizationQueryInput = z.infer<typeof OrganizationQuerySchema>;
export type SubscriptionUpdateInput = z.infer<typeof SubscriptionUpdateSchema>;
export type OrganizationResponse = z.infer<typeof OrganizationResponseSchema>;
