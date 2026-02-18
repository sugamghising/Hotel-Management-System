import { Router } from 'express';
import { PERMISSIONS } from '../../core/constants/permission';
import { validate } from '../../core/index';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { UserController } from './user.controller';
import {
  AssignRoleSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserIdParamSchema,
  UserQuerySchema,
} from './user.schema';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authMiddleware);

// All routes require USER.READ permission
router.use(requirePermission('USER.READ'));

router.get('/', validate({ query: UserQuerySchema }), userController.getAll);

// Metadata
router.get('/departments', userController.getDepartments);
router.get('/job-titles', userController.getJobTitles);

// Individual user
router.get('/:id', validate({ params: UserIdParamSchema }), userController.getById);
router.get('/:id/profile', validate({ params: UserIdParamSchema }), userController.getProfile);

// Create (requires USER.CREATE)
router.post(
  '/',
  requirePermission(PERMISSIONS.USER.CREATE),
  validate({ body: CreateUserSchema }),
  userController.create
);

// Update (requires USER.UPDATE)
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER.UPDATE, PERMISSIONS.USER.MANAGE),
  validate({ params: UserIdParamSchema, body: UpdateUserSchema }),
  userController.update
);

// Delete (requires USER.DELETE)
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER.DELETE),
  validate({ params: UserIdParamSchema }),
  userController.delete
);

// Role management (requires ROLE.ASSIGN)
router.post(
  '/:id/roles',
  requirePermission(PERMISSIONS.ROLE.ASSIGN),
  validate({ params: UserIdParamSchema, body: AssignRoleSchema }),
  userController.assignRole
);

router.delete(
  '/:id/roles/:roleAssignmentId',
  requirePermission(PERMISSIONS.ROLE.ASSIGN),
  userController.removeRole
);

export { router as userRoutes };
