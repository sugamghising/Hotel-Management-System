import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { validate } from '../../core/middleware/validate';
import { roomsController } from './rooms.controller';
import {
  BulkStatusUpdateSchema,
  CreateRoomSchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  RemoveOutOfOrderSchema,
  RoomIdParamSchema,
  RoomQuerySchema,
  SetOutOfOrderSchema,
  UpdateRoomSchema,
  UpdateRoomStatusSchema,
} from './rooms.dto';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// ============================================================================
// ROOM CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('ROOM.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: CreateRoomSchema,
  }),
  roomsController.create
);

router.get(
  '/',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: RoomQuerySchema,
  }),
  roomsController.list
);

// Grid view for housekeeping/front desk
router.get(
  '/grid',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
  }),
  roomsController.getGrid
);

// ============================================================================
// AVAILABILITY (fixed paths before /:roomId to avoid route shadowing)
// ============================================================================

router.get(
  '/available',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: z.object({
      checkIn: z.string().date(),
      checkOut: z.string().date(),
      excludeReservationId: z.string().uuid().optional(),
      roomTypeId: z.string().uuid().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  }),
  roomsController.findAvailable
);

// ============================================================================
// HOUSEKEEPING (fixed path before /:roomId to avoid route shadowing)
// ============================================================================

router.get(
  '/cleaning-tasks',
  requirePermission('HOUSEKEEPING.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: z.object({
      status: z.enum(['dirty', 'cleaning', 'priority']).optional(),
    }),
  }),
  roomsController.getCleaningTasks
);

// ============================================================================
// BULK STATUS UPDATE (before /:roomId to avoid ambiguity)
// ============================================================================

router.post(
  '/bulk-status',
  requirePermission('ROOM.BULK_UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: BulkStatusUpdateSchema,
  }),
  roomsController.bulkUpdateStatus
);

router.get(
  '/:roomId',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    query: z.object({
      reservations: z.coerce.boolean().optional(),
    }),
  }),
  roomsController.getById
);

router.patch(
  '/:roomId',
  requirePermission('ROOM.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    body: UpdateRoomSchema,
  }),
  roomsController.update
);

router.delete(
  '/:roomId',
  requirePermission('ROOM.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
  }),
  roomsController.delete
);

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

router.post(
  '/:roomId/status',
  requirePermission('ROOM.STATUS_UPDATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 30 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    body: UpdateRoomStatusSchema,
  }),
  roomsController.updateStatus
);

router.post(
  '/:roomId/ooo',
  requirePermission('ROOM.OOO_MANAGE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    body: SetOutOfOrderSchema,
  }),
  roomsController.setOutOfOrder
);

router.delete(
  '/:roomId/ooo',
  requirePermission('ROOM.OOO_MANAGE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    body: RemoveOutOfOrderSchema,
  }),
  roomsController.removeOutOfOrder
);

// ============================================================================
// AVAILABILITY (per-room)
// ============================================================================

router.get(
  '/:roomId/availability',
  requirePermission('ROOM.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
    query: z.object({
      checkIn: z.string().date(),
      checkOut: z.string().date(),
      excludeReservationId: z.string().uuid().optional(),
    }),
  }),
  roomsController.checkAvailability
);

// ============================================================================
// HISTORY & REPORTING
// ============================================================================

router.get(
  '/:roomId/history',
  requirePermission('ROOM.HISTORY_READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
  }),
  roomsController.getHistory
);

router.get(
  '/:roomId/maintenance-history',
  requirePermission('MAINTENANCE.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomIdParamSchema),
  }),
  roomsController.getMaintenanceHistory
);

export default router;

