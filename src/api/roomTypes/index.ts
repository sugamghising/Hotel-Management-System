// Controller & Service
export { RoomTypesController, roomTypesController } from './roomTypes.controller';
export { RoomTypesService, roomTypesService } from './roomTypes.service';
export { RoomTypesRepository, roomTypesRepository } from './roomTypes.repository';
export { default as roomTypesRoutes } from './roomTypes.routes';
export { roomTypesRegistry } from './roomTypes.registry';

// Types
export type {
  RoomType,
  RoomTypeImage,
  BedType,
  RoomTypeQueryFilters,
  RoomTypeResponse,
} from './roomTypes.types';

// Schemas & DTOs
export {
  CreateRoomTypeSchema,
  UpdateRoomTypeSchema,
  RoomTypeInventorySchema,
  RoomTypeInventoryBulkSchema,
  AddImageSchema,
  RoomTypeQuerySchema,
  InventoryQuerySchema,
  RoomTypeIdParamSchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  RoomTypeCodeSchema,
  BedTypeSchema,
  ViewTypeSchema,
  AmenitySchema,
  // Types
  type CreateRoomTypeInput as CreateRoomTypeInputType,
  type UpdateRoomTypeInput as UpdateRoomTypeInputType,
  type RoomTypeInventoryInput as RoomTypeInventoryInputType,
  type RoomTypeInventoryBulkInput as RoomTypeInventoryBulkInputType,
  type AddImageInput,
  type RoomTypeQueryInput,
  type InventoryQueryInput,
} from './roomTypes.schema';

export type {
  RoomTypeListResponse as RoomTypeListResponseDTO,
  RoomTypeDetailResponse,
  InventoryCalendarResponse as InventoryCalendarResponseDTO,
} from './roomTypes.dto';
