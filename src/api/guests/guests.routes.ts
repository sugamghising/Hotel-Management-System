import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { guestsController } from './guests.controller';
import {
  CreateGuestSchema,
  DuplicateDetectionSchema,
  GuestIdParamSchema,
  GuestQuerySchema,
  MergeGuestsSchema,
  OrganizationIdParamSchema,
  UpdateGuestSchema,
  UpdateVIPSchema,
} from './guests.dto';

const router = Router({ mergeParams: true });

// All guest routes require authentication
router.use(authMiddleware);

// ============================================================================
// GUEST CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('GUEST.CREATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 30 }),
  validate({
    params: OrganizationIdParamSchema,
    body: CreateGuestSchema,
  }),
  guestsController.create
);

router.get(
  '/',
  requirePermission('GUEST.READ'),
  validate({
    params: OrganizationIdParamSchema,
    query: GuestQuerySchema,
  }),
  guestsController.list
);

router.get(
  '/:guestId',
  requirePermission('GUEST.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  }),
  guestsController.getById
);

router.patch(
  '/:guestId',
  requirePermission('GUEST.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
    body: UpdateGuestSchema,
  }),
  guestsController.update
);

router.delete(
  '/:guestId',
  requirePermission('GUEST.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  }),
  guestsController.delete
);

// ============================================================================
// DUPLICATE DETECTION & MERGE
// ============================================================================

router.post(
  '/search/duplicates',
  requirePermission('GUEST.READ'),
  validate({
    params: OrganizationIdParamSchema,
    body: DuplicateDetectionSchema,
  }),
  guestsController.findDuplicates
);

router.post(
  '/merge',
  requirePermission('GUEST.MERGE'),
  validate({
    params: OrganizationIdParamSchema,
    body: MergeGuestsSchema,
  }),
  guestsController.merge
);

// ============================================================================
// VIP MANAGEMENT
// ============================================================================

router.post(
  '/:guestId/vip',
  requirePermission('GUEST.UPDATE_VIP'),
  validate({
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
    body: UpdateVIPSchema,
  }),
  guestsController.updateVIP
);

// ============================================================================
// STAY HISTORY
// ============================================================================

router.get(
  '/:guestId/history',
  requirePermission('GUEST.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(GuestIdParamSchema),
  }),
  guestsController.getStayHistory
);

// ============================================================================
// STATISTICS
// ============================================================================

router.get(
  '/stats/overview',
  requirePermission('GUEST.READ'),
  validate({
    params: OrganizationIdParamSchema,
  }),
  guestsController.getStats
);

export default router;
