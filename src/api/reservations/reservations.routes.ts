// src/features/reservations/reservations.routes.ts

import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { reservationsController } from './reservations.controller';
import {
  CancellationSchema,
  CheckInSchema,
  CheckOutSchema,
  CreateReservationSchema,
  HotelIdParamSchema,
  NoShowSchema,
  OrganizationIdParamSchema,
  ReservationIdParamSchema,
  ReservationSearchSchema,
  RoomAssignmentSchema,
  SplitReservationSchema,
  UpdateReservationSchema,
  WalkInSchema,
} from './reservations.dto';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// ============================================================================
// RESERVATION CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('RESERVATION.CREATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 20 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: CreateReservationSchema,
  }),
  reservationsController.create
);

router.post(
  '/walk-in',
  requirePermission('RESERVATION.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: WalkInSchema,
  }),
  reservationsController.walkIn
);

router.get(
  '/',
  requirePermission('RESERVATION.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: ReservationSearchSchema,
  }),
  reservationsController.list
);

router.get(
  '/today/arrivals',
  requirePermission('RESERVATION.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  reservationsController.getTodayArrivals
);

router.get(
  '/today/departures',
  requirePermission('RESERVATION.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  reservationsController.getTodayDepartures
);

router.get(
  '/in-house',
  requirePermission('RESERVATION.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  reservationsController.getInHouse
);

router.get(
  '/:reservationId',
  requirePermission('RESERVATION.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
  }),
  reservationsController.getById
);

router.patch(
  '/:reservationId',
  requirePermission('RESERVATION.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: UpdateReservationSchema,
  }),
  reservationsController.update
);

// ============================================================================
// CHECK-IN/OUT WORKFLOWS
// ============================================================================

router.post(
  '/:reservationId/check-in',
  requirePermission('RESERVATION.CHECK_IN'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: CheckInSchema,
  }),
  reservationsController.checkIn
);

router.post(
  '/:reservationId/check-out',
  requirePermission('RESERVATION.CHECK_OUT'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: CheckOutSchema,
  }),
  reservationsController.checkOut
);

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

router.post(
  '/:reservationId/assign-room',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: RoomAssignmentSchema,
  }),
  reservationsController.assignRoom
);

router.post(
  '/:reservationId/unassign-room',
  requirePermission('RESERVATION.ASSIGN_ROOM'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
  }),
  reservationsController.unassignRoom
);

// ============================================================================
// CANCELLATION & NO-SHOW
// ============================================================================

router.post(
  '/:reservationId/cancel',
  requirePermission('RESERVATION.CANCEL'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: CancellationSchema,
  }),
  reservationsController.cancel
);

router.post(
  '/:reservationId/no-show',
  requirePermission('RESERVATION.NO_SHOW'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: NoShowSchema,
  }),
  reservationsController.noShow
);

// ============================================================================
// ADVANCED OPERATIONS
// ============================================================================

router.post(
  '/:reservationId/split',
  requirePermission('RESERVATION.SPLIT'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema),
    body: SplitReservationSchema,
  }),
  reservationsController.split
);

export default router;
