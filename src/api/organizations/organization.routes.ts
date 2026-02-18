import { Router } from 'express';
import { PERMISSIONS } from '../../core/constants/permission';
import { requirePermission } from '../../core/middleware/requirePermission';
import { validate } from '../../core/middleware/validate';
import { OrganizationController } from './organization.controller';
import {
  OrganizationCreateSchema,
  OrganizationIdParamSchema,
  OrganizationQuerySchema,
  OrganizationUpdateSchema,
  SubscriptionUpdateSchema,
} from './organization.dto';

const router = Router();
const controller = new OrganizationController();

// Validation middlewares
const queryValidation = validate({ query: OrganizationQuerySchema });
const createValidation = validate({ body: OrganizationCreateSchema });
const updateValidation = validate({ body: OrganizationUpdateSchema });
const paramsValidation = validate({ params: OrganizationIdParamSchema });
const subscriptionValidation = validate({ body: SubscriptionUpdateSchema });

// Routes
router.get(
  '/',
  requirePermission(PERMISSIONS.ORGANIZATION.READ),
  queryValidation,
  controller.getAll
);
//Any one can create the organizations
router.post('/', createValidation, controller.create);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATION.READ),
  paramsValidation,
  controller.getById
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATION.UPDATE),
  paramsValidation,
  updateValidation,
  controller.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATION.DELETE),
  paramsValidation,
  controller.delete
);

router.post(
  '/:id/subscription',
  requirePermission(PERMISSIONS.ORGANIZATION.MANAGE_SUBSCRIPTION),
  paramsValidation,
  subscriptionValidation,
  controller.updateSubscription
);
router.get(
  '/:id/stats',
  requirePermission(PERMISSIONS.ORGANIZATION.READ),
  paramsValidation,
  controller.getStats
);
router.get(
  '/:id/limits',
  requirePermission(PERMISSIONS.ORGANIZATION.READ),
  paramsValidation,
  controller.checkLimits
);

export default router;
