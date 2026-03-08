import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  CreateGuestSchema,
  DuplicateDetectionSchema,
  GuestIdParamSchema,
  GuestQuerySchema,
  GuestTypeSchema,
  IDTypeSchema,
  MergeGuestsSchema,
  OrganizationIdParamSchema,
  UpdateGuestSchema,
  UpdateVIPSchema,
  VIPStatusSchema,
} from './guests.schema';

// ============ Response Schemas with OpenAPI metadata ============

export const GuestIdentificationSchema = z
  .object({
    idType: z.string().nullable(),
    idNumber: z.string().nullable().describe('Masked: last 4 digits only'),
    idExpiryDate: z.string().datetime().nullable(),
    verified: z.boolean(),
  })
  .openapi('GuestIdentification');

export const GuestAddressSchema = z
  .object({
    line1: z.string().nullable(),
    line2: z.string().nullable(),
    city: z.string().nullable(),
    stateProvince: z.string().nullable(),
    postalCode: z.string().nullable(),
    countryCode: z.string().nullable(),
    fullAddress: z.string().nullable(),
  })
  .openapi('GuestAddress');

export const GuestResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    hotelId: z.string().uuid().nullable(),

    firstName: z.string(),
    lastName: z.string(),
    fullName: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    mobile: z.string().nullable(),
    dateOfBirth: z.string().datetime().nullable(),
    nationality: z.string().nullable(),
    languageCode: z.string(),

    identification: GuestIdentificationSchema,
    address: GuestAddressSchema,

    guestType: GuestTypeSchema,
    vipStatus: VIPStatusSchema,
    vipReason: z.string().nullable(),

    company: z.object({
      name: z.string().nullable(),
      taxId: z.string().nullable(),
    }),

    preferences: z.object({
      room: z.record(z.unknown()).nullable(),
      dietary: z.string().nullable(),
      specialNeeds: z.string().nullable(),
    }),

    history: z.object({
      totalStays: z.number().int(),
      totalNights: z.number().int(),
      totalRevenue: z.number(),
      lastStayDate: z.string().datetime().nullable(),
      averageRate: z.number(),
    }),

    marketing: z.object({
      consent: z.boolean(),
      emailOptIn: z.boolean(),
      smsOptIn: z.boolean(),
    }),

    notes: z.object({
      internal: z.string().nullable(),
      alert: z.string().nullable(),
    }),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('GuestResponse');

export const GuestListItemSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    vipStatus: VIPStatusSchema,
    guestType: GuestTypeSchema,
    companyName: z.string().nullable(),
    totalStays: z.number().int(),
    lastStayDate: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('GuestListItem');

export const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi('GuestPagination');

export const GuestListResponseSchema = z
  .object({
    guests: z.array(GuestListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('GuestListResponse');

export const GuestDuplicateSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    matchScore: z.number().min(0).max(100),
    matchReasons: z.array(z.string()),
  })
  .openapi('GuestDuplicate');

export const GuestStayHistorySchema = z
  .object({
    reservationId: z.string().uuid(),
    confirmationNumber: z.string(),
    hotelId: z.string().uuid(),
    hotelName: z.string(),
    checkInDate: z.string().datetime(),
    checkOutDate: z.string().datetime(),
    nights: z.number().int(),
    roomType: z.string(),
    roomNumber: z.string().nullable(),
    ratePlan: z.string(),
    totalAmount: z.number(),
    status: z.string(),
    notes: z.string().nullable(),
  })
  .openapi('GuestStayHistory');

export const InHouseGuestSchema = z
  .object({
    reservationId: z.string().uuid(),
    confirmationNumber: z.string(),
    guestId: z.string().uuid(),
    guestName: z.string(),
    vipStatus: z.string(),
    roomNumber: z.string(),
    roomType: z.string(),
    checkInDate: z.string().datetime(),
    checkOutDate: z.string().datetime(),
    nights: z.number().int(),
    balance: z.number(),
    folioTotal: z.number(),
    paymentTotal: z.number(),
    alerts: z.array(z.string()),
  })
  .openapi('InHouseGuest');

export const GuestStatsSchema = z
  .object({
    totalGuests: z.number().int(),
    byVIPStatus: z.record(z.number().int()),
    byGuestType: z.record(z.number().int()),
    byNationality: z.array(z.object({ country: z.string(), count: z.number().int() })),
    topCompanies: z.array(
      z.object({ name: z.string(), guestCount: z.number().int(), totalRevenue: z.number() })
    ),
    recentArrivals: z.number().int(),
    returningGuests: z.number().int(),
  })
  .openapi('GuestStats');

const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

// ============ OpenAPI Registry ============

export const guestsRegistry = new OpenAPIRegistry();

// Register schemas
guestsRegistry.register('GuestResponse', GuestResponseSchema);
guestsRegistry.register('GuestListItem', GuestListItemSchema);
guestsRegistry.register('CreateGuestInput', CreateGuestSchema);
guestsRegistry.register('UpdateGuestInput', UpdateGuestSchema);
guestsRegistry.register('GuestType', GuestTypeSchema);
guestsRegistry.register('VIPStatus', VIPStatusSchema);
guestsRegistry.register('IDType', IDTypeSchema);

// ============ POST /api/v1/organizations/{organizationId}/guests ============
guestsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/guests',
  tags: ['Guests'],
  summary: 'Create a new guest',
  description: 'Create a new guest profile within an organization',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateGuestSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ guest: GuestResponseSchema }),
    'Guest created successfully',
    StatusCodes.CREATED
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/guests ============
guestsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/guests',
  tags: ['Guests'],
  summary: 'List guests',
  description: 'Get a paginated and filterable list of guests for an organization',
  request: {
    params: OrganizationIdParamSchema,
    query: GuestQuerySchema,
  },
  responses: createApiResponse(GuestListResponseSchema, 'Guests retrieved successfully'),
});

// ============ GET /api/v1/organizations/{organizationId}/guests/{guestId} ============
guestsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/guests/{guestId}',
  tags: ['Guests'],
  summary: 'Get guest by ID',
  description:
    'Retrieve detailed information about a specific guest. Use ?history=true for reservation history.',
  request: {
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  },
  responses: createApiResponse(
    z.object({ guest: GuestResponseSchema }),
    'Guest retrieved successfully'
  ),
});

// ============ PATCH /api/v1/organizations/{organizationId}/guests/{guestId} ============
guestsRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/guests/{guestId}',
  tags: ['Guests'],
  summary: 'Update guest',
  description: 'Update guest profile details',
  request: {
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
    body: {
      content: {
        'application/json': {
          schema: UpdateGuestSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ guest: GuestResponseSchema }),
    'Guest updated successfully'
  ),
});

// ============ DELETE /api/v1/organizations/{organizationId}/guests/{guestId} ============
guestsRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/guests/{guestId}',
  tags: ['Guests'],
  summary: 'Delete guest',
  description: 'Soft delete a guest profile. Fails if guest has active reservations.',
  request: {
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  },
  responses: {
    204: {
      description: 'Guest deleted successfully',
    },
  },
});

// ============ POST /api/v1/organizations/{organizationId}/guests/search/duplicates ============
guestsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/guests/search/duplicates',
  tags: ['Guests'],
  summary: 'Find duplicate guests',
  description: 'Search for potential duplicate guest profiles based on matching criteria',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: DuplicateDetectionSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ duplicates: z.array(GuestDuplicateSchema) }),
    'Duplicate search completed'
  ),
});

// ============ POST /api/v1/organizations/{organizationId}/guests/merge ============
guestsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/guests/merge',
  tags: ['Guests'],
  summary: 'Merge guest profiles',
  description: 'Merge multiple source guest profiles into a target guest',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: MergeGuestsSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ guest: GuestResponseSchema }),
    'Guests merged successfully'
  ),
});

// ============ POST /api/v1/organizations/{organizationId}/guests/{guestId}/vip ============
guestsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/guests/{guestId}/vip',
  tags: ['Guests'],
  summary: 'Update VIP status',
  description: 'Update the VIP status and reason for a guest',
  request: {
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
    body: {
      content: {
        'application/json': {
          schema: UpdateVIPSchema,
        },
      },
    },
  },
  responses: createApiResponse(z.object({ guest: GuestResponseSchema }), 'VIP status updated'),
});

// ============ GET /api/v1/organizations/{organizationId}/guests/{guestId}/history ============
guestsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/guests/{guestId}/history',
  tags: ['Guests'],
  summary: 'Get stay history',
  description: 'Retrieve the stay history for a specific guest',
  request: {
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  },
  responses: createApiResponse(
    z.object({ history: z.array(GuestStayHistorySchema) }),
    'Stay history retrieved'
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/guests/in-house ============
guestsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/guests/in-house',
  tags: ['Guests', 'Hotels'],
  summary: 'Get in-house guests',
  description: 'Retrieve all currently checked-in guests for a hotel',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: z.object({
      date: z.string().date().optional().describe('Business date (YYYY-MM-DD). Defaults to today.'),
    }),
  },
  responses: createApiResponse(
    z.object({ guests: z.array(InHouseGuestSchema) }),
    'In-house guests retrieved'
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/guests/stats ============
guestsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/guests/stats',
  tags: ['Guests'],
  summary: 'Get guest statistics',
  description: 'Retrieve aggregated guest statistics for an organization',
  request: {
    params: OrganizationIdParamSchema,
  },
  responses: createApiResponse(z.object({ stats: GuestStatsSchema }), 'Guest statistics retrieved'),
});
