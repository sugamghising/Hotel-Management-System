import { Router } from 'express';
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
router.get('/', queryValidation, controller.getAll);
router.post('/', createValidation, controller.create);

router.get('/:id', paramsValidation, controller.getById);
router.patch('/:id', paramsValidation, updateValidation, controller.update);
router.delete('/:id', paramsValidation, controller.delete);

router.post(
  '/:id/subscription',
  paramsValidation,
  subscriptionValidation,
  controller.updateSubscription
);
router.get('/:id/stats', paramsValidation, controller.getStats);
router.get('/:id/limits', paramsValidation, controller.checkLimits);

export default router;
