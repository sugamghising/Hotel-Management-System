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
  type CreateRoomInput,
  type UpdateRoomInput,
  type UpdateRoomStatusInput,
  type SetOutOfOrderInput,
  type BulkStatusUpdateInput,
  type RoomQueryInput,
} from './rooms.schema';

// API-specific DTOs
export interface RoomListResponse {
  rooms: Array<{
    id: string;
    roomNumber: string;
    floor: number | null;
    status: string;
    roomType: {
      id: string;
      code: string;
      name: string;
    };
    isOutOfOrder: boolean;
    cleaningPriority: number;
    currentGuest?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RoomAssignmentCheck {
  available: boolean;
  conflicts?: Array<{
    reservationId: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
  }>;
}
