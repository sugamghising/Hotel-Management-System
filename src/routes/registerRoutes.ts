import { healthRoutes, userRoutes } from '@api/index';
import { config } from '@config/index';
import { Router } from 'express';
import { authRoutes } from '../api/auth';
import { organizationRoutes } from '../api/organizations';

const router = Router();

/**
 * Central Route Registry
 * All module routes are registered here with versioning
 */

// Health check (not versioned, always accessible)
router.use('/health', healthRoutes);

// API v1 routes
const v1Router = Router();
v1Router.use('api/v1/users', userRoutes);
v1Router.use('api/v1/organizations', organizationRoutes);
v1Router.use('api/v1/auth', authRoutes);

// Mount versioned routes
router.use(config.api.fullPrefix, v1Router);

export { router as routes };
