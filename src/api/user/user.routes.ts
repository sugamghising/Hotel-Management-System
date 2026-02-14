import { Router } from 'express';
import { validate } from '../../core/index';
import { authMiddleware } from '../../core/middleware/auth';
import { userController } from './user.controller';
import { UserQuerySchema } from './user.schema';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a paginated list of all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, email, or employee ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_VERIFICATION, ACTIVE, INACTIVE, SUSPENDED]
 *         description: Filter by user status
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: jobTitle
 *         schema:
 *           type: string
 *         description: Filter by job title
 *       - in: query
 *         name: managerId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by manager ID
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 */
router.get('/', validate({ query: UserQuerySchema }), userController.getAll);

export { router as userRoutes };
