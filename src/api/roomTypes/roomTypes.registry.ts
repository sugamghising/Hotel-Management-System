import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AddImageSchema,
  BedTypeSchema,
  CreateRoomTypeSchema,
  HotelIdParamSchema,
  InventoryQuerySchema,
  OrganizationIdParamSchema,
  RoomTypeIdParamSchema,
  RoomTypeInventoryBulkSchema,
  RoomTypeInventorySchema,
  RoomTypeQuerySchema,
  UpdateRoomTypeSchema,
  ViewTypeSchema,
} from './roomTypes.schema';

// ============================================================================
// RESPONSE SCHEMAS WITH OPENAPI METADATA
// ============================================================================

export const RoomTypeImageSchema = z
  .object({
    url: z.string().url(),
    caption: z.string().nullable(),
    order: z.number().int(),
    isPrimary: z.boolean(),
  })
  .openapi('RoomTypeImage');

export const RoomTypeResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    hotelId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    capacity: z.object({
      baseOccupancy: z.number().int(),
      maxOccupancy: z.number().int(),
      maxAdults: z.number().int(),
      maxChildren: z.number().int(),
    }),
    physical: z.object({
      sizeSqm: z.number().nullable(),
      sizeSqft: z.number().nullable(),
      bedTypes: z.array(BedTypeSchema),
    }),
    features: z.object({
      amenities: z.array(z.string()),
      viewType: z.string().nullable(),
    }),
    housekeeping: z.object({
      defaultCleaningTime: z.number().int(),
    }),
    media: z.object({
      images: z.array(RoomTypeImageSchema),
      primaryImage: RoomTypeImageSchema.nullable(),
    }),
    settings: z.object({
      isActive: z.boolean(),
      isBookable: z.boolean(),
      displayOrder: z.number().int(),
    }),
    stats: z
      .object({
        totalRooms: z.number().int(),
        availableRooms: z.number().int(),
        occupiedRooms: z.number().int(),
        oooRooms: z.number().int(),
        averageRate: z.number().nullable(),
      })
      .optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('RoomTypeResponse');

export const RoomTypeListItemSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    capacity: z.object({
      baseOccupancy: z.number().int(),
      maxOccupancy: z.number().int(),
    }),
    features: z.object({
      amenities: z.array(z.string()),
      viewType: z.string().nullable(),
    }),
    settings: z.object({
      isActive: z.boolean(),
      isBookable: z.boolean(),
      displayOrder: z.number().int(),
    }),
    stats: z.object({
      totalRooms: z.number().int(),
      availableToday: z.number().int(),
    }),
  })
  .openapi('RoomTypeListItem');

export const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi('RoomTypePagination');

export const RoomTypeListResponseSchema = z
  .object({
    roomTypes: z.array(RoomTypeListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('RoomTypeListResponse');

export const InventoryDaySchema = z
  .object({
    date: z.string().date(),
    totalRooms: z.number().int(),
    sold: z.number().int(),
    available: z.number().int(),
    outOfOrder: z.number().int(),
    blocked: z.number().int(),
    stopSell: z.boolean(),
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    closedToArrival: z.boolean(),
    closedToDeparture: z.boolean(),
    rateOverride: z.number().nullable(),
  })
  .openapi('InventoryDay');

export const InventoryCalendarResponseSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    roomTypeCode: z.string(),
    roomTypeName: z.string(),
    dates: z.array(InventoryDaySchema),
  })
  .openapi('InventoryCalendarResponse');

export const InventoryRecordSchema = z
  .object({
    id: z.string().uuid(),
    roomTypeId: z.string().uuid(),
    date: z.string().datetime(),
    totalRooms: z.number().int(),
    outOfOrder: z.number().int(),
    blocked: z.number().int(),
    sold: z.number().int(),
    available: z.number().int(),
    overbookingLimit: z.number().int(),
    stopSell: z.boolean(),
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    closedToArrival: z.boolean(),
    closedToDeparture: z.boolean(),
    rateOverride: z.number().nullable(),
    reason: z.string().nullable(),
    updatedAt: z.string().datetime(),
  })
  .openapi('InventoryRecord');

export const BulkUpdateResultSchema = z
  .object({
    updatedCount: z.number().int(),
  })
  .openapi('BulkUpdateResult');

export const AvailabilityCheckResponseSchema = z
  .object({
    available: z.boolean(),
    maxGuests: z.number().int(),
    inventory: z.array(InventoryRecordSchema),
    restrictions: z.object({
      minStay: z.number().int().nullable(),
      maxStay: z.number().int().nullable(),
      closedToArrival: z.boolean(),
    }),
  })
  .openapi('AvailabilityCheckResponse');

// ============================================================================
// OPENAPI REGISTRY
// ============================================================================

export const roomTypesRegistry = new OpenAPIRegistry();

// Register schemas
roomTypesRegistry.register('RoomTypeResponse', RoomTypeResponseSchema);
roomTypesRegistry.register('RoomTypeListItem', RoomTypeListItemSchema);
roomTypesRegistry.register('RoomTypeImage', RoomTypeImageSchema);
roomTypesRegistry.register('CreateRoomTypeInput', CreateRoomTypeSchema);
roomTypesRegistry.register('UpdateRoomTypeInput', UpdateRoomTypeSchema);
roomTypesRegistry.register('BedType', BedTypeSchema);
roomTypesRegistry.register('ViewType', ViewTypeSchema);

// Common param schemas
const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelRoomTypeParams = OrgHotelParams.merge(RoomTypeIdParamSchema);

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types',
  tags: ['Room Types'],
  summary: 'Create a new room type',
  description: 'Create a new room type within a hotel. Requires ROOM_TYPE.CREATE permission.',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateRoomTypeSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Room type created successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types',
  tags: ['Room Types'],
  summary: 'List room types',
  description:
    'Get a paginated list of room types for a hotel. Supports filtering by active status, bookable status, view type, and search.',
  request: {
    params: OrgHotelParams,
    query: RoomTypeQuerySchema,
  },
  responses: createApiResponse(RoomTypeListResponseSchema, 'Room types retrieved successfully'),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}',
  tags: ['Room Types'],
  summary: 'Get room type by ID',
  description:
    'Retrieve detailed information about a specific room type. Optionally include room stats with ?stats=true.',
  request: {
    params: OrgHotelRoomTypeParams,
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Room type retrieved successfully'
  ),
});

// ============================================================================
// PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}',
  tags: ['Room Types'],
  summary: 'Update room type',
  description: 'Update room type details. Only provided fields will be updated.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateRoomTypeSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Room type updated successfully'
  ),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}',
  tags: ['Room Types'],
  summary: 'Delete room type',
  description:
    'Soft delete a room type. Fails if there are active reservations or associated rooms.',
  request: {
    params: OrgHotelRoomTypeParams,
  },
  responses: {
    204: {
      description: 'Room type deleted successfully',
    },
  },
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images',
  tags: ['Room Types', 'Images'],
  summary: 'Add image to room type',
  description: 'Add a new image to a room type. The first image is automatically set as primary.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: AddImageSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Image added successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images',
  tags: ['Room Types', 'Images'],
  summary: 'Remove image from room type',
  description: 'Remove an image from a room type by URL.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({ description: 'URL of the image to remove' }),
          }),
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Image removed successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images/reorder
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/images/reorder',
  tags: ['Room Types', 'Images'],
  summary: 'Reorder room type images',
  description: 'Update the display order of images for a room type.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            orders: z.array(
              z.object({
                url: z.string().url(),
                order: z.number().int().min(0),
              })
            ),
          }),
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ roomType: RoomTypeResponseSchema }),
    'Images reordered successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory',
  tags: ['Room Types', 'Inventory'],
  summary: 'Get inventory calendar',
  description:
    'Retrieve room inventory and availability data for a date range. Shows daily availability, restrictions, and rate overrides.',
  request: {
    params: OrgHotelRoomTypeParams,
    query: InventoryQuerySchema,
  },
  responses: createApiResponse(
    z.object({ calendar: InventoryCalendarResponseSchema }),
    'Inventory calendar retrieved successfully'
  ),
});

// ============================================================================
// PUT /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'put',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory',
  tags: ['Room Types', 'Inventory'],
  summary: 'Update inventory for a single date',
  description:
    'Create or update room inventory for a specific date. Rate limited to 30 requests per minute.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: RoomTypeInventorySchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ inventory: InventoryRecordSchema }),
    'Inventory updated successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory/bulk
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/inventory/bulk',
  tags: ['Room Types', 'Inventory'],
  summary: 'Bulk update inventory',
  description:
    'Update inventory for a date range. Optionally filter by days of week (0=Sunday, 6=Saturday). Rate limited to 10 requests per minute.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: RoomTypeInventoryBulkSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    BulkUpdateResultSchema,
    'Bulk inventory update completed successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/check-availability
// ============================================================================
roomTypesRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/room-types/{roomTypeId}/check-availability',
  tags: ['Room Types', 'Availability'],
  summary: 'Check room type availability',
  description:
    'Check availability for a specific room type between check-in and check-out dates. Used internally by the booking engine.',
  request: {
    params: OrgHotelRoomTypeParams,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            checkIn: z.string().datetime().openapi({ description: 'Check-in date (ISO 8601)' }),
            checkOut: z.string().datetime().openapi({ description: 'Check-out date (ISO 8601)' }),
            adults: z.number().int().min(1).openapi({ description: 'Number of adults' }),
            children: z.number().int().min(0).openapi({ description: 'Number of children' }),
          }),
        },
      },
    },
  },
  responses: createApiResponse(
    AvailabilityCheckResponseSchema,
    'Availability check completed successfully'
  ),
});
