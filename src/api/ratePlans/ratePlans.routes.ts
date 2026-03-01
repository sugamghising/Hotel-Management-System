import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requirePermission } from '../../core/middleware/requirePermission';
import { ratePlansController } from './ratePlans.controller';
import {
  CalendarQuerySchema,
  CloneRatePlanSchema,
  CreateRatePlanSchema,
  DeleteOverrideBodySchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  RateCalculationSchema,
  RateOverrideBulkSchema,
  RateOverrideSchema,
  RatePlanIdParamSchema,
  RatePlanQuerySchema,
  UpdateRatePlanSchema,
} from './ratePlans.dto';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// ============================================================================
// RATE PLAN CRUD
// ============================================================================

router.post(
  '/',
  requirePermission('RATE_PLAN.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: CreateRatePlanSchema,
  }),
  ratePlansController.create
);

router.get(
  '/',
  requirePermission('RATE_PLAN.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    query: RatePlanQuerySchema,
  }),
  ratePlansController.list
);

router.get(
  '/:ratePlanId',
  requirePermission('RATE_PLAN.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
  }),
  ratePlansController.getById
);

router.patch(
  '/:ratePlanId',
  requirePermission('RATE_PLAN.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    body: UpdateRatePlanSchema,
  }),
  ratePlansController.update
);

router.delete(
  '/:ratePlanId',
  requirePermission('RATE_PLAN.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
  }),
  ratePlansController.delete
);

router.post(
  '/:ratePlanId/clone',
  requirePermission('RATE_PLAN.CREATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    body: CloneRatePlanSchema,
  }),
  ratePlansController.clone
);

// ============================================================================
// RATE CALENDAR & OVERRIDES
// ============================================================================

router.get(
  '/:ratePlanId/calendar',
  requirePermission('RATE_PLAN.READ'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    query: CalendarQuerySchema,
  }),
  ratePlansController.getCalendar
);

router.put(
  '/:ratePlanId/overrides',
  requirePermission('RATE_PLAN.UPDATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 30 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    body: RateOverrideSchema,
  }),
  ratePlansController.updateOverride
);

router.post(
  '/:ratePlanId/overrides/bulk',
  requirePermission('RATE_PLAN.UPDATE'),
  createRateLimiter({ windowMs: 60 * 1000, max: 10 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    body: RateOverrideBulkSchema,
  }),
  ratePlansController.bulkUpdateOverrides
);

router.delete(
  '/:ratePlanId/overrides',
  requirePermission('RATE_PLAN.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(RatePlanIdParamSchema),
    body: DeleteOverrideBodySchema,
  }),
  ratePlansController.deleteOverride
);

// ============================================================================
// RATE CALCULATION (Booking Engine)
// ============================================================================

router.post(
  '/calculate',
  requirePermission('RATE_PLAN.READ'),
  createRateLimiter({ windowMs: 60 * 1000, max: 100 }),
  validate({
    params: OrganizationIdParamSchema.merge(HotelIdParamSchema),
    body: RateCalculationSchema,
  }),
  ratePlansController.calculate
);

export default router;
