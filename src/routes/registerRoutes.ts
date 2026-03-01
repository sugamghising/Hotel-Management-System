import { healthRoutes, userRoutes } from '@api/index';
import { config } from '@config/index';
import { Router } from 'express';
import { authRoutes } from '../api/auth';
import { hotelsRoutes } from '../api/hotel';
import { organizationRoutes } from '../api/organizations';
import { ratePlansRoutes } from '../api/ratePlans';
import { roomsRoutes } from '../api/rooms';

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
v1Router.use('/organizations', organizationRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/hotels', hotelsRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/rooms', roomsRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/rate-plans', ratePlansRoutes);

// Mount versioned routes
router.use(config.api.fullPrefix, v1Router);

export { router as routes };
