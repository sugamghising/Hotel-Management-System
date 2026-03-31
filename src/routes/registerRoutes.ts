import { healthRoutes, userRoutes } from '@api/index';
import { config } from '@config/index';
import { Router } from 'express';
import { authRoutes } from '../api/auth';
import { checkinCheckoutRoutes } from '../api/checkinCheckout';
import { folioRoutes } from '../api/folio';
import { guestsInHouseRouter, guestsRoutes } from '../api/guests';
import { hotelsRoutes } from '../api/hotel';
import { housekeepingRoutes } from '../api/housekeeping';
import { inventoryRoutes } from '../api/inventory';
import { maintenanceRoutes } from '../api/maintenance';
import { nightAuditRoutes } from '../api/nightAudit';
import { organizationRoutes } from '../api/organizations';
import { posRoutes } from '../api/pos';
import { ratePlansRoutes } from '../api/ratePlans';
import { reportsRoutes } from '../api/reports';
import { reservationsRoutes } from '../api/reservations';
import { roomTypesRoutes } from '../api/roomTypes';
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
v1Router.use('/organizations/:organizationId/hotels/:hotelId/room-types', roomTypesRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/reservations', reservationsRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId', folioRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId', checkinCheckoutRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId', nightAuditRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/pos', posRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/inventory', inventoryRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/housekeeping', housekeepingRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/maintenance', maintenanceRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId', reportsRoutes);
v1Router.use('/organizations/:organizationId/guests', guestsRoutes);
v1Router.use('/organizations/:organizationId/hotels/:hotelId/guests', guestsInHouseRouter);

// Mount versioned routes
router.use(config.api.fullPrefix, v1Router);

export { router as routes };
