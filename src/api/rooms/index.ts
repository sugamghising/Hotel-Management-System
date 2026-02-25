// Controller & Service
export { RoomsController, roomsController } from './rooms.controller';
export { RoomsService, roomsService } from './rooms.service';
export { RoomsRepository, roomsRepository } from './rooms.repository';
export { default as roomsRoutes } from './rooms.routes';

// Types
export type {
  Room,
  RoomStatus,
  MaintenanceStatus,
  CreateRoomInput,
  UpdateRoomInput,
  RoomResponse,
  RoomGridResponse,
  RoomQueryFilters,
  RoomListResponse,
  SetOutOfOrderInput,
  UpdateRoomStatusInput,
  BulkStatusUpdateInput,
  RoomHistoryEntry,
} from './rooms.types';

// Schemas & DTOs
export {
  CreateRoomSchema,
  UpdateRoomSchema,
  UpdateRoomStatusSchema,
  SetOutOfOrderSchema,
  RemoveOutOfOrderSchema,
  BulkStatusUpdateSchema,
  RoomQuerySchema,
  RoomIdParamSchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  RoomNumberSchema,
  RoomStatusSchema,
  MaintenanceStatusSchema,
  ViewTypeSchema,
  // Types
  type CreateRoomInput as CreateRoomInputType,
  type UpdateRoomInput as UpdateRoomInputType,
  type UpdateRoomStatusInput as UpdateRoomStatusInputType,
  type SetOutOfOrderInput as SetOutOfOrderInputType,
  type BulkStatusUpdateInput as BulkStatusUpdateInputType,
  type RoomQueryInput,
} from './rooms.schema';

export type {
  RoomListResponse as RoomListResponseDTO,
  RoomAssignmentCheck,
} from './rooms.dto';

// OpenAPI registry
export { roomsRegistry } from './rooms.registry';
