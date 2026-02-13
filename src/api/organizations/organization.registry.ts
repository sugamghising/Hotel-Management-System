import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';

// ============ Request/Response Schemas with OpenAPI metadata ============

export const OrganizationTypeSchema = z.enum(['CHAIN', 'INDEPENDENT']).openapi('OrganizationType');

export const SubscriptionTierSchema = z
  .enum(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'])
  .openapi('SubscriptionTier');

export const SubscriptionStatusSchema = z
  .enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'])
  .openapi('SubscriptionStatus');

export const SubscriptionSchema = z
  .object({
    tier: SubscriptionTierSchema,
    status: SubscriptionStatusSchema,
    maxHotels: z.number().int().positive(),
    maxRooms: z.number().int().positive(),
    maxUsers: z.number().int().positive(),
    endDate: z.string().datetime().nullable(),
  })
  .openapi('Subscription');

export const OrganizationResponseSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    legalName: z.string(),
    organizationType: OrganizationTypeSchema,
    taxId: z.string().nullable(),
    email: z.string().email(),
    phone: z.string().nullable(),
    website: z.string().url().nullable(),
    logoUrl: z.string().url().nullable(),
    subscription: SubscriptionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('OrganizationResponse');

export const CreateOrganizationRequestSchema = z
  .object({
    code: z
      .string()
      .min(2, 'Organization code must be at least 2 characters')
      .max(50)
      .regex(
        /^[A-Z0-9_-]+$/,
        'Code can only contain uppercase letters, numbers, hyphens, and underscores'
      ),
    name: z.string().min(2).max(255),
    legalName: z.string().min(2).max(255),
    organizationType: OrganizationTypeSchema.default('INDEPENDENT'),
    taxId: z.string().max(100).nullable().optional(),
    email: z.string().email(),
    phone: z.string().max(50).nullable().optional(),
    website: z.string().url().max(500).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    subscriptionTier: SubscriptionTierSchema.default('TRIAL'),
    maxHotels: z.number().int().positive().optional(),
    maxRooms: z.number().int().positive().optional(),
    maxUsers: z.number().int().positive().optional(),
    settings: z.record(z.unknown()).default({}),
    enabledFeatures: z.array(z.string()).default([]),
  })
  .openapi('CreateOrganizationRequest');

export const UpdateOrganizationRequestSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    legalName: z.string().min(2).max(255).optional(),
    taxId: z.string().max(100).nullable().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).nullable().optional(),
    website: z.string().url().max(500).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    organizationType: OrganizationTypeSchema.optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .openapi('UpdateOrganizationRequest');

export const UpdateSubscriptionRequestSchema = z
  .object({
    tier: SubscriptionTierSchema,
    customLimits: z
      .object({
        maxHotels: z.number().int().positive(),
        maxRooms: z.number().int().positive(),
        maxUsers: z.number().int().positive(),
      })
      .optional(),
  })
  .openapi('UpdateSubscriptionRequest');

export const OrganizationQuerySchema = z
  .object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    status: SubscriptionStatusSchema.optional(),
    type: OrganizationTypeSchema.optional(),
    sortBy: z
      .enum(['createdAt', 'name', 'code', 'subscriptionTier'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .openapi('OrganizationQuery');

export const OrganizationIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid organization ID format'),
  })
  .openapi('OrganizationIdParam');

export const LimitsQuerySchema = z
  .object({
    resource: z.enum(['hotel', 'user', 'room']),
    count: z.string().optional(),
  })
  .openapi('LimitsQuery');

export const OrganizationStatsResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
    stats: z.object({
      totalHotels: z.number(),
      totalUsers: z.number(),
      totalReservations: z.number(),
      hotels: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          status: z.string(),
          totalRooms: z.number(),
        })
      ),
    }),
    subscription: z.object({
      tier: SubscriptionTierSchema,
      status: SubscriptionStatusSchema,
      maxHotels: z.number(),
      maxRooms: z.number(),
      maxUsers: z.number(),
      startDate: z.string().datetime().nullable(),
      endDate: z.string().datetime().nullable(),
    }),
    usage: z.object({
      hotelsUsed: z.number(),
      hotelsRemaining: z.number(),
      usersUsed: z.number(),
      usersRemaining: z.number(),
    }),
  })
  .openapi('OrganizationStatsResponse');

export const LimitsCheckResponseSchema = z
  .object({
    resource: z.enum(['hotel', 'user', 'room']),
    current: z.number(),
    max: z.number(),
    remaining: z.number(),
    canCreate: z.boolean(),
  })
  .openapi('LimitsCheckResponse');

export const PaginatedOrganizationsSchema = z
  .object({
    items: z.array(OrganizationResponseSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi('PaginatedOrganizations');

export const DeleteResponseSchema = z
  .object({
    deleted: z.boolean(),
  })
  .openapi('DeleteResponse');

// ============ OpenAPI Registry ============

export const organizationRegistry = new OpenAPIRegistry();

// Register schemas
organizationRegistry.register('OrganizationResponse', OrganizationResponseSchema);
organizationRegistry.register('CreateOrganizationRequest', CreateOrganizationRequestSchema);
organizationRegistry.register('UpdateOrganizationRequest', UpdateOrganizationRequestSchema);
organizationRegistry.register('OrganizationStatsResponse', OrganizationStatsResponseSchema);

// GET /api/v1/organizations - List organizations
organizationRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations',
  tags: ['Organizations'],
  summary: 'Get all organizations',
  description: 'Retrieve a paginated list of organizations with optional filtering',
  request: {
    query: OrganizationQuerySchema,
  },
  responses: createApiResponse(
    PaginatedOrganizationsSchema,
    'Organizations retrieved successfully',
    StatusCodes.OK
  ),
});

// GET /api/v1/organizations/{id} - Get organization by ID
organizationRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Get organization by ID',
  description: 'Retrieve detailed information about a specific organization',
  request: {
    params: OrganizationIdParamSchema,
  },
  responses: {
    ...createApiResponse(OrganizationResponseSchema, 'Organization found', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
  },
});

// POST /api/v1/organizations - Create organization
organizationRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations',
  tags: ['Organizations'],
  summary: 'Create a new organization',
  description:
    'Create a new organization with subscription tier and limits. Defaults to TRIAL tier if not specified.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOrganizationRequestSchema,
          example: {
            code: 'HOTEL001',
            name: 'Grand Hotel Group',
            legalName: 'Grand Hotel Group LLC',
            organizationType: 'CHAIN',
            email: 'admin@grandhotel.com',
            phone: '+1234567890',
            website: 'https://grandhotel.com',
            subscriptionTier: 'PRO',
            taxId: '12-3456789',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      OrganizationResponseSchema,
      'Organization created successfully',
      StatusCodes.CREATED
    ),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
    ...createApiResponse(z.null(), 'Organization code already exists', StatusCodes.CONFLICT),
  },
});

// PATCH /api/v1/organizations/{id} - Update organization
organizationRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Update an organization',
  description:
    'Update organization details (does not update subscription - use dedicated endpoint)',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateOrganizationRequestSchema,
          example: {
            name: 'Updated Hotel Name',
            email: 'newemail@grandhotel.com',
            phone: '+9876543210',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      OrganizationResponseSchema,
      'Organization updated successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// DELETE /api/v1/organizations/{id} - Delete organization
organizationRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Delete an organization',
  description: 'Soft delete an organization (sets deletedAt timestamp)',
  request: {
    params: OrganizationIdParamSchema,
  },
  responses: {
    ...createApiResponse(
      DeleteResponseSchema,
      'Organization deleted successfully',
      StatusCodes.NO_CONTENT
    ),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
  },
});

// POST /api/v1/organizations/{id}/subscription - Update subscription
organizationRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{id}/subscription',
  tags: ['Organizations', 'Subscriptions'],
  summary: 'Update organization subscription',
  description:
    'Update subscription tier and optionally set custom limits (typically for ENTERPRISE tier)',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateSubscriptionRequestSchema,
          examples: {
            standardUpgrade: {
              summary: 'Standard tier upgrade',
              value: {
                tier: 'PRO',
              },
            },
            enterpriseWithCustomLimits: {
              summary: 'Enterprise with custom limits',
              value: {
                tier: 'ENTERPRISE',
                customLimits: {
                  maxHotels: 50,
                  maxRooms: 5000,
                  maxUsers: 500,
                },
              },
            },
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      OrganizationResponseSchema,
      'Subscription updated successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// GET /api/v1/organizations/{id}/stats - Get organization statistics
organizationRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{id}/stats',
  tags: ['Organizations', 'Statistics'],
  summary: 'Get organization statistics',
  description:
    'Retrieve comprehensive statistics including usage counts, subscription details, and hotel breakdown',
  request: {
    params: OrganizationIdParamSchema,
  },
  responses: {
    ...createApiResponse(
      OrganizationStatsResponseSchema,
      'Organization stats retrieved successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
  },
});

// GET /api/v1/organizations/{id}/limits - Check resource limits
organizationRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{id}/limits',
  tags: ['Organizations', 'Subscriptions'],
  summary: 'Check resource limits',
  description:
    'Check if organization can create more resources (hotels, users, rooms) based on subscription limits',
  request: {
    params: OrganizationIdParamSchema,
    query: LimitsQuerySchema,
  },
  responses: {
    ...createApiResponse(LimitsCheckResponseSchema, 'Limit check completed', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Organization not found', StatusCodes.NOT_FOUND),
    ...createApiResponse(z.null(), 'Invalid resource type', StatusCodes.BAD_REQUEST),
  },
});
