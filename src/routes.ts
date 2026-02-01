import { Router } from 'express';
import { healthRoutes, userRoutes } from './api/index';
import { config } from './config/index';

const router = Router();

/**
 * Central Route Registry
 * All module routes are registered here with versioning
 */

// Health check (not versioned, always accessible)
router.use('/health', healthRoutes);

// API v1 routes
const v1Router = Router();
v1Router.use('/users', userRoutes);

// Mount versioned routes
router.use(config.api.fullPrefix, v1Router);

export { router as routes };
