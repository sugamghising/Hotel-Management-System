import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  BookingSourceSchema,
  CancellationPolicySchema,
  CancellationSchema,
  CheckInSchema,
  CheckOutSchema,
  CreateReservationSchema,
  GuaranteeTypeSchema,
  HotelIdParamSchema,
  NoShowSchema,
  OrganizationIdParamSchema,
  ReservationIdParamSchema,
  ReservationSearchSchema,
  RoomAssignmentSchema,
  SplitReservationSchema,
  UpdateReservationSchema,
  WalkInSchema,
} from './reservations.schema';

// ============================================================================
// Response Schemas
// ============================================================================

const ReservationStatusSchema = z
  .enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'WAITLIST'])
  .openapi('ReservationStatus');

const RateBreakdownItemSchema = z
  .object({
    date: z.string(),
    baseRate: z.number(),
    adjustments: z.array(
      z.object({
        description: z.string(),
        amount: z.number(),
      })
    ),
    finalRate: z.number(),
  })
  .openapi('RateBreakdownItem');

const ReservationGuestSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    vipStatus: z.string().nullable(),
  })
  .openapi('ReservationGuest');

const ReservationRoomItemSchema = z
  .object({
    id: z.string().uuid(),
    roomTypeId: z.string().uuid(),
    roomTypeName: z.string(),
    roomTypeCode: z.string(),
    roomId: z.string().uuid().nullable(),
    roomNumber: z.string().nullable(),
    adults: z.number().int(),
    children: z.number().int(),
    infants: z.number().int(),
    ratePlanId: z.string().uuid(),
    ratePlanName: z.string(),
    ratePlanCode: z.string(),
    rateBreakdown: z.array(RateBreakdownItemSchema),
    totalRate: z.number(),
    status: ReservationStatusSchema,
  })
  .openapi('ReservationRoomItem');

const ReservationResponseSchema = z
  .object({
    id: z.string().uuid(),
    confirmationNumber: z.string(),
    organizationId: z.string().uuid(),
    hotelId: z.string().uuid(),
    status: ReservationStatusSchema,

    // Dates
    checkInDate: z.string().datetime(),
    checkOutDate: z.string().datetime(),
    actualCheckIn: z.string().datetime().nullable(),
    actualCheckOut: z.string().datetime().nullable(),
    arrivalTime: z.string().nullable(),
    departureTime: z.string().nullable(),
    nights: z.number().int(),

    // Guest
    guest: ReservationGuestSchema,

    // Rooms
    rooms: z.array(ReservationRoomItemSchema),

    // Financials
    totalAmount: z.number(),
    paidAmount: z.number(),
    balanceDue: z.number(),
    currencyCode: z.string(),

    // Source & Guarantee
    source: BookingSourceSchema,
    channelCode: z.string().nullable(),
    corporateCode: z.string().nullable(),
    guaranteeType: GuaranteeTypeSchema,
    guaranteeAmount: z.number().nullable(),

    // Policies
    cancellationPolicy: CancellationPolicySchema,

    // Notes
    guestNotes: z.string().nullable(),
    specialRequests: z.string().nullable(),
    internalNotes: z.string().nullable(),

    // Cancellation
    cancelledAt: z.string().datetime().nullable(),
    cancellationReason: z.string().nullable(),
    cancellationFee: z.number().nullable(),

    // Metadata
    isWalkIn: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ReservationResponse');

const ReservationListItemSchema = z
  .object({
    id: z.string().uuid(),
    confirmationNumber: z.string(),
    status: ReservationStatusSchema,
    checkInDate: z.string().datetime(),
    checkOutDate: z.string().datetime(),
    nights: z.number().int(),
    guestName: z.string(),
    roomTypeName: z.string(),
    roomNumber: z.string().nullable(),
    totalAmount: z.number(),
    balanceDue: z.number(),
    source: BookingSourceSchema,
    isWalkIn: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .openapi('ReservationListItem');

const PaginationSchema = z
  .object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi('Pagination');

const ReservationListResponseSchema = z
  .object({
    reservations: z.array(ReservationListItemSchema),
    pagination: PaginationSchema,
  })
  .openapi('ReservationListResponse');

const InHouseGuestSchema = z
  .object({
    reservationId: z.string().uuid(),
    confirmationNumber: z.string(),
    guestName: z.string(),
    roomNumber: z.string().nullable(),
    roomTypeName: z.string(),
    checkInDate: z.string().datetime(),
    checkOutDate: z.string().datetime(),
    nights: z.number().int(),
    vipStatus: z.string().nullable(),
    balanceDue: z.number(),
  })
  .openapi('InHouseGuest');

const SplitReservationResponseSchema = z
  .object({
    original: ReservationResponseSchema,
    newReservation: ReservationResponseSchema,
  })
  .openapi('SplitReservationResponse');

// ============================================================================
// Shared param schemas
// ============================================================================

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelReservationParams = OrgHotelParams.merge(ReservationIdParamSchema);

// ============================================================================
// OpenAPI Registry
// ============================================================================

export const reservationsRegistry = new OpenAPIRegistry();

// Register schemas
reservationsRegistry.register('ReservationStatus', ReservationStatusSchema);
reservationsRegistry.register('ReservationResponse', ReservationResponseSchema);
reservationsRegistry.register('ReservationListItem', ReservationListItemSchema);
reservationsRegistry.register('ReservationListResponse', ReservationListResponseSchema);
reservationsRegistry.register('ReservationRoomItem', ReservationRoomItemSchema);
reservationsRegistry.register('RateBreakdownItem', RateBreakdownItemSchema);
reservationsRegistry.register('InHouseGuest', InHouseGuestSchema);
reservationsRegistry.register('SplitReservationResponse', SplitReservationResponseSchema);
reservationsRegistry.register('CreateReservationInput', CreateReservationSchema);
reservationsRegistry.register('UpdateReservationInput', UpdateReservationSchema);
reservationsRegistry.register('CheckInInput', CheckInSchema);
reservationsRegistry.register('CheckOutInput', CheckOutSchema);
reservationsRegistry.register('RoomAssignmentInput', RoomAssignmentSchema);
reservationsRegistry.register('CancellationInput', CancellationSchema);
reservationsRegistry.register('NoShowInput', NoShowSchema);
reservationsRegistry.register('WalkInInput', WalkInSchema);
reservationsRegistry.register('SplitReservationInput', SplitReservationSchema);
reservationsRegistry.register('BookingSource', BookingSourceSchema);
reservationsRegistry.register('GuaranteeType', GuaranteeTypeSchema);
reservationsRegistry.register('CancellationPolicy', CancellationPolicySchema);

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations',
  tags: ['Reservations'],
  summary: 'Create a reservation',
  description:
    'Create a new reservation for a guest. Validates availability and calculates pricing.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateReservationSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Reservation created successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/walk-in
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/walk-in',
  tags: ['Reservations'],
  summary: 'Create a walk-in reservation',
  description:
    'Create a walk-in reservation with immediate room assignment and payment collection.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: WalkInSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Walk-in reservation created successfully',
    StatusCodes.CREATED
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations
// ============================================================================
reservationsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations',
  tags: ['Reservations'],
  summary: 'Search reservations',
  description:
    'Search and filter reservations with pagination. Supports filtering by status, dates, guest name, confirmation number, and more.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
    query: ReservationSearchSchema,
  },
  responses: createApiResponse(
    ReservationListResponseSchema,
    'Reservations retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/today/arrivals
// ============================================================================
reservationsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/today/arrivals',
  tags: ['Reservations'],
  summary: "Get today's arrivals",
  description: 'Retrieve all reservations scheduled to check in today.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
  },
  responses: createApiResponse(
    z.object({ arrivals: z.array(ReservationListItemSchema) }),
    "Today's arrivals retrieved successfully"
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/today/departures
// ============================================================================
reservationsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/today/departures',
  tags: ['Reservations'],
  summary: "Get today's departures",
  description: 'Retrieve all reservations scheduled to check out today.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
  },
  responses: createApiResponse(
    z.object({ departures: z.array(ReservationListItemSchema) }),
    "Today's departures retrieved successfully"
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/in-house
// ============================================================================
reservationsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/in-house',
  tags: ['Reservations'],
  summary: 'Get in-house guests',
  description: 'Retrieve all currently checked-in guests.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelParams,
  },
  responses: createApiResponse(
    z.object({ guests: z.array(InHouseGuestSchema) }),
    'In-house guests retrieved successfully'
  ),
});

// ============================================================================
// GET /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}
// ============================================================================
reservationsRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}',
  tags: ['Reservations'],
  summary: 'Get reservation by ID',
  description:
    'Retrieve full details of a specific reservation including guest info, rooms, and financials.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Reservation retrieved successfully'
  ),
});

// ============================================================================
// PATCH /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}
// ============================================================================
reservationsRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}',
  tags: ['Reservations'],
  summary: 'Update reservation',
  description: 'Update reservation details such as dates, occupancy, and notes.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateReservationSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Reservation updated successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/check-in
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/check-in',
  tags: ['Reservations'],
  summary: 'Check in guest',
  description:
    'Process guest check-in. Optionally assign a room, verify ID, and authorize a payment hold.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: CheckInSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Guest checked in successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/check-out
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/check-out',
  tags: ['Reservations'],
  summary: 'Check out guest',
  description: 'Process guest check-out and collect any outstanding balance.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: CheckOutSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Guest checked out successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/assign-room
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/assign-room',
  tags: ['Reservations'],
  summary: 'Assign room',
  description:
    'Assign a specific room to a reservation. Use force=true to override existing assignment.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: RoomAssignmentSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Room assigned successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/unassign-room
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/unassign-room',
  tags: ['Reservations'],
  summary: 'Unassign room',
  description: 'Remove a room assignment from a reservation.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Room unassigned successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/cancel
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/cancel',
  tags: ['Reservations'],
  summary: 'Cancel reservation',
  description:
    'Cancel a reservation. Cancellation fees may apply depending on the policy. Use waiveFee=true to skip the fee.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: CancellationSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Reservation cancelled successfully'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/no-show
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/no-show',
  tags: ['Reservations'],
  summary: 'Mark as no-show',
  description:
    'Mark a reservation as a no-show. Optionally charge a no-show fee or provide a waive reason.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: NoShowSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ reservation: ReservationResponseSchema }),
    'Reservation marked as no-show'
  ),
});

// ============================================================================
// POST /api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/split
// ============================================================================
reservationsRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/split',
  tags: ['Reservations'],
  summary: 'Split reservation',
  description:
    'Split a reservation into two at a given date. Optionally assign a new room type to the second portion.',
  security: [{ bearerAuth: [] }],
  request: {
    params: OrgHotelReservationParams,
    body: {
      content: {
        'application/json': {
          schema: SplitReservationSchema,
        },
      },
    },
  },
  responses: createApiResponse(SplitReservationResponseSchema, 'Reservation split successfully'),
});
