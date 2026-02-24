import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { roomTypesController } from './roomTypes.controller';
import {
  AddImageSchema,
  CreateRoomTypeSchema,
  HotelIdParamSchema,
  InventoryQuerySchema,
  OrganizationIdParamSchema,
  RoomTypeIdParamSchema,
  RoomTypeInventoryBulkSchema,
  RoomTypeInventorySchema,
  RoomTypeQuerySchema,
  UpdateRoomTypeSchema,
} from './roomTypes.dto';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// ============================================================================
// ROOM TYPE CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('ROOM_TYPE.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: CreateRoomTypeSchema,
  }),
  roomTypesController.create
);

router.get(
  '/',
  requirePermission('ROOM_TYPE.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: RoomTypeQuerySchema,
  }),
  roomTypesController.list
);

router.get(
  '/:roomTypeId',
  requirePermission('ROOM_TYPE.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
  }),
  roomTypesController.getById
);

router.patch(
  '/:roomTypeId',
  requirePermission('ROOM_TYPE.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
    body: UpdateRoomTypeSchema,
  }),
  roomTypesController.update
);

router.delete(
  '/:roomTypeId',
  requirePermission('ROOM_TYPE.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
  }),
  roomTypesController.delete
);

// ============================================================================
// IMAGES
// ============================================================================

router.post(
  '/:roomTypeId/images',
  requirePermission('ROOM_TYPE.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
    body: AddImageSchema,
  }),
  roomTypesController.addImage
);

router.delete(
  '/:roomTypeId/images',
  requirePermission('ROOM_TYPE.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
  }),
  roomTypesController.removeImage
);

router.post(
  '/:roomTypeId/images/reorder',
  requirePermission('ROOM_TYPE.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
  }),
  roomTypesController.reorderImages
);

// ============================================================================
// INVENTORY
// ============================================================================

router.get(
  '/:roomTypeId/inventory',
  requirePermission('INVENTORY.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
    query: InventoryQuerySchema,
  }),
  roomTypesController.getInventory
);

router.put(
  '/:roomTypeId/inventory',
  requirePermission('INVENTORY.UPDATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 30 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
    body: RoomTypeInventorySchema,
  }),
  roomTypesController.updateInventory
);

router.post(
  '/:roomTypeId/inventory/bulk',
  requirePermission('INVENTORY.UPDATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 10 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
    body: RoomTypeInventoryBulkSchema,
  }),
  roomTypesController.bulkUpdateInventory
);

// ============================================================================
// INTERNAL: Availability check (used by booking engine)
// ============================================================================

router.post(
  '/:roomTypeId/check-availability',
  requirePermission('ROOM_TYPE.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RoomTypeIdParamSchema),
  }),
  roomTypesController.checkAvailability
);

export default router;
