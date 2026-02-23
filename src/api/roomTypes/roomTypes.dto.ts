// Re-export schemas
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
  type CreateRoomTypeInput,
  type UpdateRoomTypeInput,
  type RoomTypeInventoryInput,
  type RoomTypeInventoryBulkInput,
  type AddImageInput,
  type RoomTypeQueryInput,
  type InventoryQueryInput,
} from './roomTypes.schema';

import type { RoomTypeInventoryResponse, RoomTypeResponse } from './roomTypes.types';

// API-specific DTOs
export interface RoomTypeListResponse {
  roomTypes: Array<{
    id: string;
    code: string;
    name: string;
    capacity: {
      baseOccupancy: number;
      maxOccupancy: number;
    };
    features: {
      amenities: string[];
      viewType: string | null;
    };
    settings: {
      isActive: boolean;
      isBookable: boolean;
      displayOrder: number;
    };
    stats: {
      totalRooms: number;
      availableToday: number;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RoomTypeDetailResponse {
  roomType: RoomTypeResponse;
  inventory?: RoomTypeInventoryResponse[];
  rooms?: unknown[]; // Optional included rooms (to be typed when Room entity is implemented)
}

export interface InventoryCalendarResponse {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  dates: Array<{
    date: string;
    totalRooms: number;
    sold: number;
    available: number;
    outOfOrder: number;
    blocked: number;
    stopSell: boolean;
    minStay: number | null;
    maxStay: number | null;
    closedToArrival: boolean;
    closedToDeparture: boolean;
    rateOverride: number | null;
  }>;
}
