// src/features/hotels/hotels.routes.ts

import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { hotelController } from './hotel.controller';
import {
  AvailabilityCalendarQuerySchema,
  CloneHotelSchema,
  CreateHotelSchema,
  HotelIdParamSchema,
  HotelQuerySchema,
  OrganizationIdParamSchema,
  UpdateHotelSchema,
  UpdateHotelSettingsSchema,
} from './hotel.dto';

const router = Router({ mergeParams: true });

// All hotel routes require authentication
router.use(authMiddleware);

// ============================================================================
// HOTEL CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('HOTEL.CREATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 10 }),
  validate({
    params: OrganizationIdParamSchema,
    body: CreateHotelSchema,
  }),
  hotelController.create
);

router.get(
  '/',
  requirePermission('HOTEL.READ'),
  validate({
    params: OrganizationIdParamSchema,
    query: HotelQuerySchema,
  }),
  hotelController.list
);

router.get(
  '/:hotelId',
  requirePermission('HOTEL.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  hotelController.getById
);

router.patch(
  '/:hotelId',
  requirePermission('HOTEL.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: UpdateHotelSchema,
  }),
  hotelController.update
);

router.delete(
  '/:hotelId',
  requirePermission('HOTEL.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  hotelController.delete
);

// ============================================================================
// DASHBOARD & OPERATIONS
// ============================================================================

router.get(
  '/:hotelId/dashboard',
  requirePermission('HOTEL.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  hotelController.getDashboard
);

router.get(
  '/:hotelId/rooms/status-summary',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  hotelController.getRoomStatusSummary
);

router.get(
  '/:hotelId/rooms/availability',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: AvailabilityCalendarQuerySchema,
  }),
  hotelController.getAvailability
);

// ============================================================================
// SETTINGS
// ============================================================================

router.get(
  '/:hotelId/settings',
  requirePermission('HOTEL.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  hotelController.getSettings
);

router.patch(
  '/:hotelId/settings',
  requirePermission('HOTEL.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: UpdateHotelSettingsSchema,
  }),
  hotelController.updateSettings
);

// ============================================================================
// CLONE
// ============================================================================

router.post(
  '/:hotelId/clone',
  requirePermission('HOTEL.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: CloneHotelSchema,
  }),
  hotelController.clone
);

export default router;
