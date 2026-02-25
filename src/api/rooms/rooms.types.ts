import type { Prisma } from '../../generated/prisma';

// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type RoomStatus =
  | 'VACANT_CLEAN'
  | 'VACANT_DIRTY'
  | 'VACANT_CLEANING'
  | 'OCCUPIED_CLEAN'
  | 'OCCUPIED_DIRTY'
  | 'OCCUPIED_CLEANING'
  | 'OUT_OF_ORDER'
  | 'RESERVED'
  | 'BLOCKED';

export type MaintenanceStatus = 'NONE' | 'SCHEDULED' | 'IN_PROGRESS' | 'URGENT';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface Room {
  id: string;
  organizationId: string;
  hotelId: string;
  roomTypeId: string;

  // Identification
  roomNumber: string;
  floor: number | null;
  building: string | null;
  wing: string | null;

  // Status
  status: RoomStatus;
  isOutOfOrder: boolean;
  oooReason: string | null;
  oooFrom: Date | null;
  oooUntil: Date | null;

  // Features
  isSmoking: boolean;
  isAccessible: boolean;
  viewType: string | null;

  // Housekeeping
  lastCleanedAt: Date | null;
  cleaningPriority: number; // 0=normal, 1=high, 2=urgent

  // Maintenance
  maintenanceStatus: MaintenanceStatus;

  // Financial
  rackRate: number | null; // Override room type rate

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateRoomInput {
  roomNumber: string;
  roomTypeId: string;

  // Location
  floor?: number;
  building?: string;
  wing?: string;

  // Features
  isSmoking?: boolean;
  isAccessible?: boolean;
  viewType?: string;

  // Financial
  rackRate?: number;

  // Initial status
  status?: RoomStatus;
}

export interface UpdateRoomInput {
  roomNumber?: string;
  roomTypeId?: string;

  // Location
  floor?: number | null;
  building?: string | null;
  wing?: string | null;

  // Features
  isSmoking?: boolean;
  isAccessible?: boolean;
  viewType?: string | null;

  // Financial
  rackRate?: number | null;
}

export interface UpdateRoomStatusInput {
  status: RoomStatus;
  reason?: string;
  priority?: number;
}

export interface SetOutOfOrderInput {
  reason: string;
  from: Date;
  until: Date;
  maintenanceRequired?: boolean;
}

export interface RoomResponse {
  id: string;
  organizationId: string;
  hotelId: string;

  identification: {
    roomNumber: string;
    floor: number | null;
    building: string | null;
    wing: string | null;
    fullLocation: string;
  };

  type: {
    id: string;
    code: string;
    name: string;
    baseOccupancy: number;
    maxOccupancy: number;
  };

  status: {
    current: RoomStatus;
    isOutOfOrder: boolean;
    oooDetails: {
      reason: string | null;
      from: Date | null;
      until: Date | null;
    } | null;
    lastCleanedAt: Date | null;
    cleaningPriority: number;
    maintenanceStatus: MaintenanceStatus;
  };

  features: {
    isSmoking: boolean;
    isAccessible: boolean;
    viewType: string | null;
  };

  financial: {
    rackRate: number | null;
  };

  currentReservation?: {
    id: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
  } | null;

  nextReservation?: {
    id: string;
    guestName: string;
    checkIn: Date;
    nights: number;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface RoomGridRow {
  floor: number | null;
  id: string;
  roomNumber: string;
  status: RoomStatus;
  isOutOfOrder: boolean;
  cleaningPriority: number;
  roomTypeCode: string;
  roomTypeName: string;
  currentReservationId: string | null;
  currentGuest: string | null;
  nextArrival: Date | null;
}

export interface RoomGridResponse {
  floors: Array<{
    floor: number | null;
    rooms: Array<{
      id: string;
      roomNumber: string;
      status: RoomStatus;
      roomTypeCode: string;
      roomTypeName: string;
      isOutOfOrder: boolean;
      cleaningPriority: number;
      currentGuest?: string;
      nextArrival?: string;
    }>;
  }>;
  stats: {
    total: number;
    vacantClean: number;
    vacantDirty: number;
    occupied: number;
    outOfOrder: number;
  };
}

export interface RoomHistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  previousStatus?: RoomStatus;
  newStatus?: RoomStatus;
  userId: string;
  userName: string;
  notes?: string;
}

export interface RoomQueryFilters {
  status?: RoomStatus;
  roomTypeId?: string;
  floor?: number;
  building?: string;
  isOutOfOrder?: boolean;
  viewType?: string;
  search?: string;
}

export interface RoomMaintenanceHistoryEntry {
  id: string;
  requestId: string;
  category: string;
  priority: string;
  title: string;
  status: string;
  reportedAt: Date;
  completedAt: Date | null;
}

export interface BulkStatusUpdateInput {
  roomIds: string[];
  status: RoomStatus;
  reason?: string;
}

export interface RoomConflict {
  reservationId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
}

export interface RoomReservationDetail {
  id: string;
  reservationId: string;
  roomId: string | null;
  roomTypeId: string;
  assignedAt: Date | null;
  assignedBy: string | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  roomRate: Prisma.Decimal | number;
  adultCount: number;
  childCount: number;
  status: string;
  reservation: {
    id: string;
    guest: {
      firstName: string;
      lastName: string;
    };
    [key: string]: unknown;
  };
}

export interface RoomStatusHistoryEntry {
  id: string;
  organizationId: string;
  hotelId: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  changes: unknown;
  metadata: unknown;
  riskLevel: string;
  isSensitive: boolean;
  user: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface RoomMaintenanceRecord {
  id: string;
  category: string;
  priority: string;
  title: string;
  status: string;
  reportedAt: Date;
  completedAt: Date | null;
}
