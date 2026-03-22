import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AssignRoomSchema,
  ChangeRoomSchema,
  CheckInRequestSchema,
  CheckoutSchema,
  EarlyCheckInSchema,
  ExpressCheckoutSchema,
  ExtendStaySchema,
  HotelIdParamSchema,
  LateCheckoutSchema,
  NoShowSchema,
  OrganizationIdParamSchema,
  ReinstateSchema,
  ReservationIdParamSchema,
  ShortenStaySchema,
  UpgradeRoomSchema,
  WalkInCheckInSchema,
} from './checkinCheckout.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelReservationParams = OrgHotelParams.merge(ReservationIdParamSchema);

const GenericReservationSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  checkInStatus: z.string(),
});

const RoomGridItemSchema = z.object({
  roomId: z.string().uuid(),
  roomNumber: z.string(),
  floor: z.number().nullable(),
  status: z.string(),
  roomTypeCode: z.string().nullable(),
  housekeepingPriority: z.number().nullable(),
});

const DashboardSchema = z.object({
  businessDate: z.string(),
  occupancy: z.object({
    totalRooms: z.number().int(),
    occupied: z.number().int(),
    available: z.number().int(),
    outOfOrder: z.number().int(),
    occupancyRate: z.number(),
  }),
  arrivals: z.object({
    expected: z.number().int(),
    checkedIn: z.number().int(),
    pending: z.number().int(),
  }),
  departures: z.object({
    expected: z.number().int(),
    checkedOut: z.number().int(),
    pending: z.number().int(),
  }),
  inHouseCount: z.number().int(),
});

export const checkinCheckoutRegistry = new OpenAPIRegistry();

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/checkin/arrivals',
  tags: ['CheckInCheckout'],
  summary: "Today's arrivals",
  request: { params: OrgHotelParams },
  responses: createApiResponse(
    z.object({ arrivals: z.array(z.record(z.unknown())) }),
    "Today's arrivals retrieved"
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/checkin/pre-checkin/{reservationId}',
  tags: ['CheckInCheckout'],
  summary: 'Pre-check-in summary',
  request: { params: OrgHotelReservationParams },
  responses: createApiResponse(z.record(z.unknown()), 'Pre-check-in data retrieved'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkin',
  tags: ['CheckInCheckout'],
  summary: 'Perform check-in',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: CheckInRequestSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Check-in completed successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkin/early',
  tags: ['CheckInCheckout'],
  summary: 'Perform early check-in',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: EarlyCheckInSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Early check-in completed successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/checkin/walkin',
  tags: ['CheckInCheckout'],
  summary: 'Create and check in walk-in reservation',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: WalkInCheckInSchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: z.record(z.unknown()) }),
    'Walk-in check-in completed successfully',
    StatusCodes.CREATED
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkin/walkin',
  tags: ['CheckInCheckout'],
  summary: 'Create and check in walk-in reservation (compat route)',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: WalkInCheckInSchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: z.record(z.unknown()) }),
    'Walk-in check-in completed successfully',
    StatusCodes.CREATED
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/rooms/assign',
  tags: ['CheckInCheckout'],
  summary: 'Assign room to reservation',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: AssignRoomSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Room assigned successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/rooms/auto-assign',
  tags: ['CheckInCheckout'],
  summary: 'Auto-assign room to reservation',
  request: { params: OrgHotelReservationParams },
  responses: createApiResponse(z.record(z.unknown()), 'Room auto-assigned successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/rooms/upgrade',
  tags: ['CheckInCheckout'],
  summary: 'Upgrade room for reservation',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: UpgradeRoomSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Room upgraded successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/rooms/change',
  tags: ['CheckInCheckout'],
  summary: 'Change room for reservation',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: ChangeRoomSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Room changed successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/checkout/departures',
  tags: ['CheckInCheckout'],
  summary: "Today's departures",
  request: { params: OrgHotelParams },
  responses: createApiResponse(
    z.object({ departures: z.array(z.record(z.unknown())) }),
    "Today's departures retrieved"
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkout/preview',
  tags: ['CheckInCheckout'],
  summary: 'Checkout preview',
  request: { params: OrgHotelReservationParams },
  responses: createApiResponse(z.record(z.unknown()), 'Checkout preview retrieved'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkout',
  tags: ['CheckInCheckout'],
  summary: 'Perform checkout',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: CheckoutSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Checkout completed successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkout/express',
  tags: ['CheckInCheckout'],
  summary: 'Perform express checkout',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: ExpressCheckoutSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Express checkout completed successfully'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/checkout/late',
  tags: ['CheckInCheckout'],
  summary: 'Process late checkout',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: LateCheckoutSchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: GenericReservationSchema }),
    'Late checkout processed successfully'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/no-show',
  tags: ['CheckInCheckout'],
  summary: 'Mark reservation as no-show',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: NoShowSchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: GenericReservationSchema }),
    'Reservation marked as no-show'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/reinstate',
  tags: ['CheckInCheckout'],
  summary: 'Reinstate cancelled/no-show reservation',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: ReinstateSchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: GenericReservationSchema }),
    'Reservation reinstated'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/front-desk/dashboard',
  tags: ['CheckInCheckout'],
  summary: 'Front desk dashboard',
  request: { params: OrgHotelParams },
  responses: createApiResponse(
    z.object({ dashboard: DashboardSchema }),
    'Front desk dashboard retrieved'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/front-desk/room-grid',
  tags: ['CheckInCheckout'],
  summary: 'Front desk room grid',
  request: { params: OrgHotelParams },
  responses: createApiResponse(
    z.object({ rooms: z.array(RoomGridItemSchema) }),
    'Room grid retrieved'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/in-house',
  tags: ['CheckInCheckout'],
  summary: 'In-house reservations',
  request: { params: OrgHotelParams },
  responses: createApiResponse(
    z.object({ reservations: z.array(z.record(z.unknown())) }),
    'In-house guests retrieved'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/status',
  tags: ['CheckInCheckout'],
  summary: 'Reservation status snapshot',
  request: { params: OrgHotelReservationParams },
  responses: createApiResponse(z.record(z.unknown()), 'Reservation status retrieved'),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/extend',
  tags: ['CheckInCheckout'],
  summary: 'Extend stay',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: ExtendStaySchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: GenericReservationSchema }),
    'Stay extended successfully'
  ),
});

checkinCheckoutRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/shorten',
  tags: ['CheckInCheckout'],
  summary: 'Shorten stay',
  request: {
    params: OrgHotelReservationParams,
    body: { content: { 'application/json': { schema: ShortenStaySchema } } },
  },
  responses: createApiResponse(
    z.object({ reservation: GenericReservationSchema }),
    'Stay shortened successfully'
  ),
});
