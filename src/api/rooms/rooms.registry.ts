import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  BulkStatusUpdateSchema,
  CreateRoomSchema,
  HotelIdParamSchema,
  MaintenanceStatusSchema,
  OrganizationIdParamSchema,
  RemoveOutOfOrderSchema,
  RoomIdParamSchema,
  RoomQuerySchema,
  RoomStatusSchema,
  SetOutOfOrderSchema,
  UpdateRoomSchema,
  UpdateRoomStatusSchema,
  ViewTypeSchema,
} from './rooms.schema';

// ============================================================================
// Response Schemas with OpenAPI metadata
// ============================================================================

const RoomTypeInfoSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    baseOccupancy: z.number().int(),
    maxOccupancy: z.number().int(),
  })
  .openapi('RoomTypeInfo');

const RoomIdentificationSchema = z
  .object({
    roomNumber: z.string(),
    floor: z.number().int().nullable(),
    building: z.string().nullable(),
    wing: z.string().nullable(),
    fullLocation: z.string(),
  })
  .openapi('RoomIdentification');

const RoomStatusDetailSchema = z
  .object({
    current: RoomStatusSchema,
    isOutOfOrder: z.boolean(),
    oooDetails: z
      .object({
        reason: z.string().nullable(),
        from: z.string().datetime().nullable(),
        until: z.string().datetime().nullable(),
      })
      .nullable(),
    lastCleanedAt: z.string().datetime().nullable(),
    cleaningPriority: z.number().int(),
    maintenanceStatus: MaintenanceStatusSchema,
  })
  .openapi('RoomStatusDetail');

const RoomFeaturesSchema = z
  .object({
    isSmoking: z.boolean(),
    isAccessible: z.boolean(),
    viewType: ViewTypeSchema.nullable(),
  })
  .openapi('RoomFeatures');

const RoomFinancialSchema = z
  .object({
    rackRate: z.number().nullable(),
  })
  .openapi('RoomFinancial');

const ReservationSummarySchema = z
  .object({
    id: z.string().uuid(),
    guestName: z.string(),
    checkIn: z.string().datetime(),
    checkOut: z.string().datetime(),
    nights: z.number().int(),
  })
  .openapi('ReservationSummary');

const NextReservationSummarySchema = z
  .object({
    id: z.string().uuid(),
    guestName: z.string(),
    checkIn: z.string().datetime(),
    nights: z.number().int(),
  })
  .openapi('NextReservationSummary');

export const RoomResponseSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    hotelId: z.string().uuid(),
    identification: RoomIdentificationSchema,
    type: RoomTypeInfoSchema,
    status: RoomStatusDetailSchema,
    features: RoomFeaturesSchema,
    financial: RoomFinancialSchema,
    currentReservation: ReservationSummarySchema.nullable().optional(),
    nextReservation: NextReservationSummarySchema.nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('RoomResponse');

export const RoomListItemSchema = z
  .object({
    id: z.string().uuid(),
    roomNumber: z.string(),
    floor: z.number().int().nullable(),
    status: RoomStatusSchema,
    roomType: RoomTypeInfoSchema,
    isOutOfOrder: z.boolean(),
    cleaningPriority: z.number().int(),
    currentGuest: z.string().optional(),
  })
  .openapi('RoomListItem');

const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi('RoomPagination');

export const RoomListResponseSchema = z
  .object({
    rooms: z.array(RoomListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('RoomListResponse');

const RoomGridFloorSchema = z
  .object({
    floor: z.number().int().nullable(),
    rooms: z.array(
      z.object({
        id: z.string().uuid(),
        roomNumber: z.string(),
        status: RoomStatusSchema,
        roomTypeCode: z.string(),
        roomTypeName: z.string(),
        isOutOfOrder: z.boolean(),
        cleaningPriority: z.number().int(),
        currentGuest: z.string().optional(),
        nextArrival: z.string().optional(),
      })
    ),
  })
  .openapi('RoomGridFloor');

export const RoomGridResponseSchema = z
  .object({
    floors: z.array(RoomGridFloorSchema),
    stats: z.object({
      total: z.number().int(),
      vacantClean: z.number().int(),
      vacantDirty: z.number().int(),
      occupied: z.number().int(),
      outOfOrder: z.number().int(),
    }),
  })
  .openapi('RoomGridResponse');

const RoomConflictSchema = z
  .object({
    reservationId: z.string().uuid().nullable(),
    guestName: z.string(),
    checkIn: z.string().datetime(),
    checkOut: z.string().datetime(),
  })
  .openapi('RoomConflict');

export const RoomAvailabilityCheckSchema = z
  .object({
    available: z.boolean(),
    conflicts: z.array(RoomConflictSchema),
  })
  .openapi('RoomAvailabilityCheck');

export const AvailableRoomItemSchema = z
  .object({
    id: z.string().uuid(),
    roomNumber: z.string(),
    floor: z.number().int().nullable(),
    roomType: RoomTypeInfoSchema,
    features: RoomFeaturesSchema,
  })
  .openapi('AvailableRoomItem');

const RoomHistoryEntrySchema = z
  .object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    action: z.string(),
    previousStatus: RoomStatusSchema.optional(),
    newStatus: RoomStatusSchema.optional(),
    userId: z.string(),
    userName: z.string(),
    notes: z.string().optional(),
  })
  .openapi('RoomHistoryEntry');

const RoomMaintenanceRecordSchema = z
  .object({
    id: z.string().uuid(),
    category: z.string(),
    priority: z.string(),
    title: z.string(),
    status: z.string(),
    reportedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .openapi('RoomMaintenanceRecord');

const CleaningTaskItemSchema = z
  .object({
    id: z.string().uuid(),
    roomNumber: z.string(),
    floor: z.number().int().nullable(),
    status: RoomStatusSchema,
    roomType: z.object({
      code: z.string(),
      name: z.string(),
      defaultCleaningTime: z.number().int(),
    }),
    cleaningPriority: z.number().int(),
    estimatedMinutes: z.number().int(),
    currentTask: z.unknown().nullable(),
  })
  .openapi('CleaningTaskItem');

const BulkUpdateResultSchema = z
  .object({
    updatedCount: z.number().int(),
  })
  .openapi('BulkUpdateResult');

// ============================================================================
// Shared param schemas
// ============================================================================

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelRoomParams = OrgHotelParams.merge(RoomIdParamSchema);

// ============================================================================
// OpenAPI Registry
// ============================================================================

export const roomsRegistry = new OpenAPIRegistry();

// Register schemas
roomsRegistry.register('RoomResponse', RoomResponseSchema);
roomsRegistry.register('RoomListItem', RoomListItemSchema);
roomsRegistry.register('RoomGridResponse', RoomGridResponseSchema);
roomsRegistry.register('CreateRoomInput', CreateRoomSchema);
roomsRegistry.register('UpdateRoomInput', UpdateRoomSchema);
roomsRegistry.register('UpdateRoomStatusInput', UpdateRoomStatusSchema);
roomsRegistry.register('SetOutOfOrderInput', SetOutOfOrderSchema);
roomsRegistry.register('BulkStatusUpdateInput', BulkStatusUpdateSchema);
roomsRegistry.register('RoomStatus', RoomStatusSchema);
roomsRegistry.register('ViewType', ViewTypeSchema);

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms
// ============================================================================
roomsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms',
  tags: ['Rooms'],
  summary: 'Create a new room',
  description: 'Create a new room within a hotel',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateRoomSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ room: RoomResponseSchema }),
    'Room created successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms',
  tags: ['Rooms'],
  summary: 'List rooms',
  description: 'Get a paginated list of rooms for a hotel with optional filters',
  request: {
    params: OrgHotelParams,
    query: RoomQuerySchema,
  },
  responses: createApiResponse(RoomListResponseSchema, 'List of rooms retrieved successfully'),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/grid
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/grid',
  tags: ['Rooms'],
  summary: 'Get room grid',
  description: 'Get rooms organized by floor for housekeeping grid view',
  request: {
    params: OrgHotelParams,
  },
  responses: createApiResponse(
    z.object({ grid: RoomGridResponseSchema }),
    'Room grid retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}',
  tags: ['Rooms'],
  summary: 'Get room by ID',
  description: 'Retrieve detailed information about a specific room',
  request: {
    params: OrgHotelRoomParams,
    query: z.object({
      reservations: z.coerce
        .boolean()
        .optional()
        .openapi({ description: 'Include reservation details' }),
    }),
  },
  responses: createApiResponse(
    z.object({ room: RoomResponseSchema }),
    'Room retrieved successfully'
  ),
});

// ============================================================================
// PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}
// ============================================================================
roomsRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}',
  tags: ['Rooms'],
  summary: 'Update room',
  description: 'Update room details',
  request: {
    params: OrgHotelRoomParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateRoomSchema,
        },
      },
    },
  },
  responses: createApiResponse(z.object({ room: RoomResponseSchema }), 'Room updated successfully'),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}
// ============================================================================
roomsRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}',
  tags: ['Rooms'],
  summary: 'Delete room',
  description: 'Soft delete a room',
  request: {
    params: OrgHotelRoomParams,
  },
  responses: {
    204: {
      description: 'Room deleted successfully',
    },
  },
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/status
// ============================================================================
roomsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/status',
  tags: ['Rooms'],
  summary: 'Update room status',
  description: 'Change the status of a room (e.g., vacant clean, occupied, dirty)',
  request: {
    params: OrgHotelRoomParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateRoomStatusSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ room: RoomResponseSchema }),
    'Room status updated successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/ooo
// ============================================================================
roomsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/ooo',
  tags: ['Rooms'],
  summary: 'Set room out of order',
  description: 'Mark a room as out of order with a reason and date range',
  request: {
    params: OrgHotelRoomParams,
    body: {
      content: {
        'application/json': {
          schema: SetOutOfOrderSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ room: RoomResponseSchema }),
    'Room set out of order successfully'
  ),
});

// ============================================================================
// DELETE /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/ooo
// ============================================================================
roomsRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/ooo',
  tags: ['Rooms'],
  summary: 'Remove out of order',
  description: 'Return a room to service by removing the out-of-order status',
  request: {
    params: OrgHotelRoomParams,
    body: {
      content: {
        'application/json': {
          schema: RemoveOutOfOrderSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ room: RoomResponseSchema }),
    'Room returned to service successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/bulk-status
// ============================================================================
roomsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/bulk-status',
  tags: ['Rooms'],
  summary: 'Bulk update room status',
  description: 'Update the status of multiple rooms at once',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: BulkStatusUpdateSchema,
        },
      },
    },
  },
  responses: createApiResponse(BulkUpdateResultSchema, 'Rooms updated successfully'),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/availability
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/availability',
  tags: ['Rooms'],
  summary: 'Check room availability',
  description: 'Check if a specific room is available for a date range',
  request: {
    params: OrgHotelRoomParams,
    query: z.object({
      checkIn: z.string().date().openapi({ description: 'Check-in date (YYYY-MM-DD)' }),
      checkOut: z.string().date().openapi({ description: 'Check-out date (YYYY-MM-DD)' }),
      excludeReservationId: z
        .string()
        .uuid()
        .optional()
        .openapi({ description: 'Reservation ID to exclude from conflict check' }),
    }),
  },
  responses: createApiResponse(RoomAvailabilityCheckSchema, 'Availability checked successfully'),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/available
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/available',
  tags: ['Rooms'],
  summary: 'Find available rooms',
  description: 'Find rooms available for a given date range, optionally filtered by room type',
  request: {
    params: OrgHotelParams,
    query: z.object({
      checkIn: z.string().date().openapi({ description: 'Check-in date (YYYY-MM-DD)' }),
      checkOut: z.string().date().openapi({ description: 'Check-out date (YYYY-MM-DD)' }),
      roomTypeId: z.string().uuid().optional().openapi({ description: 'Filter by room type' }),
      limit: z.coerce
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .openapi({ description: 'Max results (default 10)' }),
    }),
  },
  responses: createApiResponse(
    z.object({ rooms: z.array(AvailableRoomItemSchema) }),
    'Available rooms retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/history
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/history',
  tags: ['Rooms'],
  summary: 'Get room history',
  description: 'Retrieve the status change history of a room',
  request: {
    params: OrgHotelRoomParams,
    query: z.object({
      limit: z.coerce
        .number()
        .int()
        .positive()
        .max(200)
        .optional()
        .openapi({ description: 'Max entries (default 50)' }),
    }),
  },
  responses: createApiResponse(
    z.object({ history: z.array(RoomHistoryEntrySchema) }),
    'Room history retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/maintenance-history
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/{roomId}/maintenance-history',
  tags: ['Rooms'],
  summary: 'Get maintenance history',
  description: 'Retrieve the maintenance request history for a room',
  request: {
    params: OrgHotelRoomParams,
  },
  responses: createApiResponse(
    z.object({ history: z.array(RoomMaintenanceRecordSchema) }),
    'Maintenance history retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/cleaning-tasks
// ============================================================================
roomsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/rooms/cleaning-tasks',
  tags: ['Rooms'],
  summary: 'Get cleaning tasks',
  description: 'Get a prioritized list of rooms needing cleaning',
  request: {
    params: OrgHotelParams,
    query: z.object({
      status: z
        .enum(['dirty', 'cleaning', 'priority'])
        .optional()
        .openapi({ description: 'Filter by cleaning status (dirty, cleaning, priority)' }),
    }),
  },
  responses: createApiResponse(
    z.object({ tasks: z.array(CleaningTaskItemSchema) }),
    'Cleaning tasks retrieved successfully'
  ),
});
