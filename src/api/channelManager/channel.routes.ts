import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { channelController } from './channel.controller';
import {
  ChannelCodeParamSchema,
  ChannelWebhookSchema,
  ConnectionIdParamSchema,
  CreateConnectionSchema,
  HotelIdParamSchema,
  MapRatesSchema,
  MapRoomsSchema,
  OrganizationIdParamSchema,
  SyncAllSchema,
  SyncLogQuerySchema,
  SyncSchema,
  UpdateConnectionSchema,
} from './channel.schema';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelConnectionParams = OrgHotelParams.merge(ConnectionIdParamSchema);

router.post(
  '/connections',
  requirePermission('CHANNEL.MANAGE'),
  validate({ params: OrgHotelParams, body: CreateConnectionSchema }),
  channelController.createConnection
);

router.get(
  '/connections',
  requirePermission('CHANNEL.READ'),
  validate({ params: OrgHotelParams }),
  channelController.listConnections
);

router.get(
  '/connections/:connectionId',
  requirePermission('CHANNEL.READ'),
  validate({ params: OrgHotelConnectionParams }),
  channelController.getConnection
);

router.patch(
  '/connections/:connectionId',
  requirePermission('CHANNEL.MANAGE'),
  validate({ params: OrgHotelConnectionParams, body: UpdateConnectionSchema }),
  channelController.updateConnection
);

router.delete(
  '/connections/:connectionId',
  requirePermission('CHANNEL.MANAGE'),
  validate({ params: OrgHotelConnectionParams }),
  channelController.deleteConnection
);

router.post(
  '/connections/:connectionId/activate',
  requirePermission('CHANNEL.ACTIVATE'),
  validate({ params: OrgHotelConnectionParams }),
  channelController.activateConnection
);

router.post(
  '/connections/:connectionId/deactivate',
  requirePermission('CHANNEL.DEACTIVATE'),
  validate({ params: OrgHotelConnectionParams }),
  channelController.deactivateConnection
);

router.put(
  '/connections/:connectionId/mappings/rooms',
  requirePermission('CHANNEL.MAP'),
  validate({ params: OrgHotelConnectionParams, body: MapRoomsSchema }),
  channelController.mapRooms
);

router.put(
  '/connections/:connectionId/mappings/rates',
  requirePermission('CHANNEL.MAP'),
  validate({ params: OrgHotelConnectionParams, body: MapRatesSchema }),
  channelController.mapRates
);

router.get(
  '/connections/:connectionId/mappings',
  requirePermission('CHANNEL.READ'),
  validate({ params: OrgHotelConnectionParams }),
  channelController.getMappings
);

router.post(
  '/connections/:connectionId/sync',
  requirePermission('CHANNEL.SYNC'),
  validate({ params: OrgHotelConnectionParams, body: SyncSchema }),
  channelController.syncConnection
);

router.post(
  '/sync/all',
  requirePermission('CHANNEL.SYNC'),
  validate({ params: OrgHotelParams, body: SyncAllSchema }),
  channelController.syncAll
);

router.get(
  '/connections/:connectionId/sync-logs',
  requirePermission('CHANNEL.READ_LOGS'),
  validate({ params: OrgHotelConnectionParams, query: SyncLogQuerySchema }),
  channelController.getSyncLogs
);

const webhookRouter = Router();

webhookRouter.post(
  '/:channelCode/reservation',
  validate({ params: ChannelCodeParamSchema, body: ChannelWebhookSchema }),
  channelController.handleReservationWebhook
);

webhookRouter.post(
  '/:channelCode/modification',
  validate({ params: ChannelCodeParamSchema, body: ChannelWebhookSchema }),
  channelController.handleModificationWebhook
);

webhookRouter.post(
  '/:channelCode/cancellation',
  validate({ params: ChannelCodeParamSchema, body: ChannelWebhookSchema }),
  channelController.handleCancellationWebhook
);

export { router as channelRoutes, webhookRouter as channelWebhookRoutes };

export default router;
