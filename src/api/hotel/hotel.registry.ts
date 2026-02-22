import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AvailabilityCalendarQuerySchema,
  CloneHotelSchema,
  CreateHotelSchema,
  HotelIdParamSchema,
  HotelQuerySchema,
  HotelStatusSchema,
  OrganizationIdParamSchema,
  PropertyTypeSchema,
  UpdateHotelSchema,
} from './hotel.schema';

// ============ Response Schemas with OpenAPI metadata ============

export const HotelOperationalSettingsSchema = z
  .object({
    earlyCheckInAllowed: z.boolean().optional(),
    earlyCheckInFee: z.number().optional(),
    lateCheckOutAllowed: z.boolean().optional(),
    lateCheckOutFee: z.number().optional(),
    expressCheckout: z.boolean().optional(),
    keyCardSystem: z.string().optional(),
    parkingAvailable: z.boolean().optional(),
    parkingFee: z.number().optional(),
    petPolicy: z.enum(['ALLOWED', 'NOT_ALLOWED', 'RESTRICTED']).optional(),
    petFee: z.number().optional(),
    smokingPolicy: z.enum(['ALLOWED', 'NOT_ALLOWED', 'DESIGNATED_AREAS']).optional(),
    wifiPolicy: z.enum(['FREE', 'PAID', 'TIERED']).optional(),
  })
  .openapi('HotelOperationalSettings');

export const HotelPoliciesSchema = z
  .object({
    cancellationPolicyDefault: z.string().optional(),
    depositPolicy: z.string().optional(),
    childPolicy: z.string().optional(),
    groupPolicy: z.string().optional(),
  })
  .openapi('HotelPolicies');

export const HotelResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    legalName: z.string().nullable(),
    brand: z.string().nullable(),
    starRating: z.number().nullable(),
    propertyType: PropertyTypeSchema,
    email: z.string().email(),
    phone: z.string(),
    fax: z.string().nullable(),
    website: z.string().url().nullable(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    stateProvince: z.string().nullable(),
    postalCode: z.string(),
    countryCode: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    timezone: z.string(),
    checkInTime: z.string().datetime(),
    checkOutTime: z.string().datetime(),
    currencyCode: z.string(),
    defaultLanguage: z.string(),
    totalRooms: z.number().int(),
    totalFloors: z.number().int().nullable(),
    operationalSettings: HotelOperationalSettingsSchema,
    amenities: z.array(z.string()),
    policies: HotelPoliciesSchema,
    status: HotelStatusSchema,
    openingDate: z.string().datetime().nullable(),
    closingDate: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('HotelResponse');

export const HotelListItemSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    propertyType: PropertyTypeSchema,
    starRating: z.number().nullable(),
    city: z.string(),
    countryCode: z.string(),
    status: HotelStatusSchema,
    totalRooms: z.number().int(),
  })
  .openapi('HotelListItem');

export const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi('Pagination');

export const HotelListResponseSchema = z
  .object({
    hotels: z.array(HotelListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('HotelListResponse');

export const RoomStatusSummarySchema = z
  .object({
    totalRooms: z.number().int(),
    vacant: z.number().int(),
    occupied: z.number().int(),
    reserved: z.number().int(),
    outOfOrder: z.number().int(),
    blocked: z.number().int(),
    dirty: z.number().int(),
    clean: z.number().int(),
    inspected: z.number().int(),
  })
  .openapi('RoomStatusSummary');

export const HotelStatsSchema = z
  .object({
    occupancyRate: z.number(),
    averageDailyRate: z.number(),
    revPAR: z.number(),
    totalRevenue: z.number(),
    bookedNights: z.number().int(),
    checkInsToday: z.number().int(),
    checkOutsToday: z.number().int(),
    inHouseGuests: z.number().int(),
  })
  .openapi('HotelStats');

export const HotelDashboardResponseSchema = z
  .object({
    hotel: HotelResponseSchema,
    stats: HotelStatsSchema,
    roomStatus: RoomStatusSummarySchema,
  })
  .openapi('HotelDashboardResponse');

export const AvailabilityRestrictionsSchema = z
  .object({
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    stopSell: z.boolean(),
    closedToArrival: z.boolean(),
    closedToDeparture: z.boolean(),
  })
  .openapi('AvailabilityRestrictions');

export const RoomAvailabilitySchema = z
  .object({
    date: z.string().date(),
    roomTypeId: z.string().uuid(),
    roomTypeCode: z.string(),
    roomTypeName: z.string(),
    totalRooms: z.number().int(),
    sold: z.number().int(),
    available: z.number().int(),
    outOfOrder: z.number().int(),
    blocked: z.number().int(),
    rateOverride: z.number().nullable(),
    restrictions: AvailabilityRestrictionsSchema,
  })
  .openapi('RoomAvailability');

export const AvailabilityCalendarResponseSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    availability: z.array(RoomAvailabilitySchema),
  })
  .openapi('AvailabilityCalendarResponse');

export const HotelSettingsResponseSchema = z
  .object({
    operationalSettings: HotelOperationalSettingsSchema,
    policies: HotelPoliciesSchema,
  })
  .openapi('HotelSettingsResponse');

export const DeleteResponseSchema = z
  .object({
    deleted: z.boolean(),
  })
  .openapi('DeleteResponse');

// ============ OpenAPI Registry ============

export const hotelRegistry = new OpenAPIRegistry();

// Register schemas
hotelRegistry.register('Hotel', HotelResponseSchema);
hotelRegistry.register('HotelListItem', HotelListItemSchema);
hotelRegistry.register('CreateHotelInput', CreateHotelSchema);
hotelRegistry.register('UpdateHotelInput', UpdateHotelSchema);
hotelRegistry.register('CloneHotelInput', CloneHotelSchema);
hotelRegistry.register('PropertyType', PropertyTypeSchema);
hotelRegistry.register('HotelStatus', HotelStatusSchema);

// ============ POST /api/v1/organizations/{organizationId}/hotels ============
hotelRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels',
  tags: ['Hotels'],
  summary: 'Create a new hotel',
  description: 'Create a new hotel within an organization',
  request: {
    params: OrganizationIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateHotelSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ hotel: HotelResponseSchema }),
    'Hotel created successfully',
    StatusCodes.CREATED
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels',
  tags: ['Hotels'],
  summary: 'List hotels',
  description: 'Get a paginated list of hotels for an organization',
  request: {
    params: OrganizationIdParamSchema,
    query: HotelQuerySchema,
  },
  responses: createApiResponse(HotelListResponseSchema, 'List of hotels retrieved successfully'),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId} ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}',
  tags: ['Hotels'],
  summary: 'Get hotel by ID',
  description: 'Retrieve detailed information about a specific hotel',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  },
  responses: createApiResponse(
    z.object({ hotel: HotelResponseSchema }),
    'Hotel retrieved successfully'
  ),
});

// ============ PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId} ============
hotelRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}',
  tags: ['Hotels'],
  summary: 'Update hotel',
  description: 'Update hotel details',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: {
      content: {
        'application/json': {
          schema: UpdateHotelSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ hotel: HotelResponseSchema }),
    'Hotel updated successfully'
  ),
});

// ============ DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId} ============
hotelRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}',
  tags: ['Hotels'],
  summary: 'Delete hotel',
  description: 'Soft delete a hotel',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  },
  responses: createApiResponse(DeleteResponseSchema, 'Hotel deleted successfully'),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/dashboard ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/dashboard',
  tags: ['Hotels'],
  summary: 'Get hotel dashboard',
  description: 'Retrieve dashboard data including stats and room status summary',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  },
  responses: createApiResponse(
    HotelDashboardResponseSchema,
    'Dashboard data retrieved successfully'
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/status-summary ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/status-summary',
  tags: ['Hotels', 'Rooms'],
  summary: 'Get room status summary',
  description: 'Get a summary of room statuses for a hotel',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  },
  responses: createApiResponse(
    RoomStatusSummarySchema,
    'Room status summary retrieved successfully'
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/availability ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/availability',
  tags: ['Hotels', 'Rooms', 'Rates'],
  summary: 'Get room availability calendar',
  description: 'Retrieve room availability and rates for a date range',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: AvailabilityCalendarQuerySchema,
  },
  responses: createApiResponse(
    AvailabilityCalendarResponseSchema,
    'Availability calendar retrieved successfully'
  ),
});

// ============ GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/settings ============
hotelRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/settings',
  tags: ['Hotels', 'Settings'],
  summary: 'Get hotel settings',
  description: 'Retrieve hotel operational settings and policies',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  },
  responses: createApiResponse(HotelSettingsResponseSchema, 'Settings retrieved successfully'),
});

// ============ PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId}/settings ============
hotelRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/settings',
  tags: ['Hotels', 'Settings'],
  summary: 'Update hotel settings',
  description: 'Update hotel operational settings and policies',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            operationalSettings: HotelOperationalSettingsSchema.partial().optional(),
            policies: HotelPoliciesSchema.partial().optional(),
          }),
        },
      },
    },
  },
  responses: createApiResponse(HotelSettingsResponseSchema, 'Settings updated successfully'),
});

// ============ POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/clone ============
hotelRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/clone',
  tags: ['Hotels'],
  summary: 'Clone hotel',
  description: 'Create a copy of an existing hotel with optional data',
  request: {
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: {
      content: {
        'application/json': {
          schema: CloneHotelSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ hotel: HotelResponseSchema }),
    'Hotel cloned successfully',
    StatusCodes.CREATED
  ),
});
