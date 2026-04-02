export { channelController, ChannelController } from './channel.controller';
export { channelService, ChannelService } from './channel.service';
export { channelRepository, ChannelRepository } from './channel.repository';
export { channelRoutes, channelWebhookRoutes } from './channel.routes';

export type {
  ChannelConnectionResponse,
  ChannelSyncLogResponse,
  ChannelSyncLogListResponse,
  RoomMapping,
  RatePlanMapping,
  SyncInput,
  SyncAllResult,
  SyncExecutionResult,
  WebhookProcessingResult,
  CreateChannelConnectionInput,
  UpdateChannelConnectionInput,
  MapRoomsInput,
  MapRatesInput,
  SyncLogQueryFilters,
} from './channel.types';

export {
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
  type CreateConnectionInput,
  type MapRatesInput as MapRatesSchemaInput,
  type MapRoomsInput as MapRoomsSchemaInput,
  type SyncAllInput,
  type SyncInput as SyncSchemaInput,
  type SyncLogQueryInput,
  type UpdateConnectionInput,
} from './channel.schema';

export * from './adapters';
