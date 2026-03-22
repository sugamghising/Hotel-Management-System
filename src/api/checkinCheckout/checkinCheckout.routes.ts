import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { checkinCheckoutController } from './checkinCheckout.controller';
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

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelReservationParams = OrgHotelParams.merge(ReservationIdParamSchema);

router.get(
  '/checkin/arrivals',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelParams }),
  checkinCheckoutController.getArrivals
);

router.get(
  '/checkin/pre-checkin/:reservationId',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelReservationParams }),
  checkinCheckoutController.getPreCheckIn
);

router.post(
  '/reservations/:reservationId/checkin',
  requirePermission('RESERVATION.CHECK_IN'),
  validate({ params: OrgHotelReservationParams, body: CheckInRequestSchema }),
  checkinCheckoutController.checkIn
);

router.post(
  '/reservations/:reservationId/checkin/early',
  requirePermission('RESERVATION.CHECK_IN'),
  validate({ params: OrgHotelReservationParams, body: EarlyCheckInSchema }),
  checkinCheckoutController.earlyCheckIn
);

router.post(
  '/checkin/walkin',
  requirePermission('RESERVATION.CREATE'),
  validate({ params: OrgHotelParams, body: WalkInCheckInSchema }),
  checkinCheckoutController.walkInCheckIn
);

router.post(
  '/reservations/:reservationId/checkin/walkin',
  requirePermission('RESERVATION.CREATE'),
  validate({ params: OrgHotelReservationParams, body: WalkInCheckInSchema }),
  checkinCheckoutController.walkInCheckIn
);

router.post(
  '/reservations/:reservationId/rooms/assign',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({ params: OrgHotelReservationParams, body: AssignRoomSchema }),
  checkinCheckoutController.assignRoom
);

router.post(
  '/reservations/:reservationId/rooms/auto-assign',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({ params: OrgHotelReservationParams }),
  checkinCheckoutController.autoAssignRoom
);

router.post(
  '/reservations/:reservationId/rooms/upgrade',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({ params: OrgHotelReservationParams, body: UpgradeRoomSchema }),
  checkinCheckoutController.upgradeRoom
);

router.post(
  '/reservations/:reservationId/rooms/change',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({ params: OrgHotelReservationParams, body: ChangeRoomSchema }),
  checkinCheckoutController.changeRoom
);

router.get(
  '/checkout/departures',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelParams }),
  checkinCheckoutController.getDepartures
);

router.get(
  '/reservations/:reservationId/checkout/preview',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelReservationParams }),
  checkinCheckoutController.checkoutPreview
);

router.post(
  '/reservations/:reservationId/checkout',
  requirePermission('RESERVATION.CHECK_OUT'),
  validate({ params: OrgHotelReservationParams, body: CheckoutSchema }),
  checkinCheckoutController.checkout
);

router.post(
  '/reservations/:reservationId/checkout/express',
  requirePermission('RESERVATION.CHECK_OUT'),
  validate({ params: OrgHotelReservationParams, body: ExpressCheckoutSchema }),
  checkinCheckoutController.expressCheckout
);

router.post(
  '/reservations/:reservationId/checkout/late',
  requirePermission('RESERVATION.CHECK_OUT'),
  validate({ params: OrgHotelReservationParams, body: LateCheckoutSchema }),
  checkinCheckoutController.lateCheckout
);

router.post(
  '/reservations/:reservationId/no-show',
  requirePermission('RESERVATION.NO_SHOW'),
  validate({ params: OrgHotelReservationParams, body: NoShowSchema }),
  checkinCheckoutController.markNoShow
);

router.post(
  '/reservations/:reservationId/reinstate',
  requirePermission('RESERVATION.UPDATE'),
  validate({ params: OrgHotelReservationParams, body: ReinstateSchema }),
  checkinCheckoutController.reinstate
);

router.get(
  '/front-desk/dashboard',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelParams }),
  checkinCheckoutController.frontDeskDashboard
);

router.get(
  '/front-desk/room-grid',
  requirePermission('ROOM.READ'),
  validate({ params: OrgHotelParams }),
  checkinCheckoutController.roomGrid
);

router.get(
  '/reservations/in-house',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelParams }),
  checkinCheckoutController.inHouse
);

router.get(
  '/reservations/:reservationId/status',
  requirePermission('RESERVATION.READ'),
  validate({ params: OrgHotelReservationParams }),
  checkinCheckoutController.reservationStatus
);

router.post(
  '/reservations/:reservationId/extend',
  requirePermission('RESERVATION.UPDATE'),
  validate({ params: OrgHotelReservationParams, body: ExtendStaySchema }),
  checkinCheckoutController.extendStay
);

router.post(
  '/reservations/:reservationId/shorten',
  requirePermission('RESERVATION.UPDATE'),
  validate({ params: OrgHotelReservationParams, body: ShortenStaySchema }),
  checkinCheckoutController.shortenStay
);

export default router;
