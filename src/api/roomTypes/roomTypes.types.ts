// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type BedType =
  | 'SINGLE'
  | 'DOUBLE'
  | 'QUEEN'
  | 'KING'
  | 'TWIN'
  | 'BUNK'
  | 'SOFA_BED'
  | 'CRIB';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface RoomType {
  id: string;
  organizationId: string;
  hotelId: string;

  // Identification
  code: string;
  name: string;
  description: string | null;

  // Capacity
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;

  // Physical
  sizeSqm: number | null;
  sizeSqft: number | null;
  bedTypes: BedType[];

  // Features
  amenities: string[]; // WIFI, TV, MINIBAR, SAFE, etc.
  viewType: string | null; // CITY, GARDEN, OCEAN, etc.

  // Housekeeping
  defaultCleaningTime: number; // minutes

  // Media
  images: RoomTypeImage[];

  // Settings
  isActive: boolean;
  isBookable: boolean;
  displayOrder: number;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RoomTypeImage {
  url: string;
  caption: string | null;
  order: number;
  isPrimary: boolean;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateRoomTypeInput {
  code: string;
  name: string;
  description?: string;

  // Capacity
  baseOccupancy?: number;
  maxOccupancy: number;
  maxAdults?: number;
  maxChildren?: number;

  // Physical
  sizeSqm?: number;
  sizeSqft?: number;
  bedTypes: BedType[];

  // Features
  amenities?: string[];
  viewType?: string;

  // Housekeeping
  defaultCleaningTime?: number;

  // Media
  images?: Array<{
    url: string;
    caption?: string;
    order?: number;
    isPrimary?: boolean;
  }>;

  // Settings
  isActive?: boolean;
  isBookable?: boolean;
  displayOrder?: number;
}

export interface UpdateRoomTypeInput {
  name?: string;
  description?: string | null;

  // Capacity
  baseOccupancy?: number;
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;

  // Physical
  sizeSqm?: number | null;
  sizeSqft?: number | null;
  bedTypes?: BedType[];

  // Features
  amenities?: string[];
  viewType?: string | null;

  // Housekeeping
  defaultCleaningTime?: number;

  // Settings
  isActive?: boolean;
  isBookable?: boolean;
  displayOrder?: number;
}

export interface RoomTypeResponse {
  id: string;
  organizationId: string;
  hotelId: string;

  code: string;
  name: string;
  description: string | null;

  capacity: {
    baseOccupancy: number;
    maxOccupancy: number;
    maxAdults: number;
    maxChildren: number;
  };

  physical: {
    sizeSqm: number | null;
    sizeSqft: number | null;
    bedTypes: BedType[];
  };

  features: {
    amenities: string[];
    viewType: string | null;
  };

  housekeeping: {
    defaultCleaningTime: number;
  };

  media: {
    images: RoomTypeImage[];
    primaryImage: RoomTypeImage | null;
  };

  settings: {
    isActive: boolean;
    isBookable: boolean;
    displayOrder: number;
  };

  stats?: {
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    oooRooms: number;
    averageRate: number | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface RoomTypeInventoryInput {
  date: Date;
  totalRooms?: number;
  outOfOrder?: number;
  blocked?: number;
  overbookingLimit?: number;
  stopSell?: boolean;
  minStay?: number | null;
  maxStay?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  rateOverride?: number | null;
  reason?: string;
}

export interface RoomTypeInventoryBulkUpdateInput {
  startDate: Date;
  endDate: Date;
  updates: Partial<Omit<RoomTypeInventoryInput, 'date'>>;
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
}

export interface RoomTypeInventoryResponse {
  date: string;
  roomTypeId: string;

  availability: {
    totalRooms: number;
    outOfOrder: number;
    blocked: number;
    sold: number;
    available: number;
  };

  controls: {
    overbookingLimit: number;
    stopSell: boolean;
    minStay: number | null;
    maxStay: number | null;
    closedToArrival: boolean;
    closedToDeparture: boolean;
  };

  pricing: {
    rateOverride: number | null;
    reason: string | null;
  };

  updatedAt: Date;
}

export interface RoomTypeQueryFilters {
  isActive?: boolean;
  isBookable?: boolean;
  viewType?: string;
  search?: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export interface CapacityValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BedConfiguration {
  type: BedType;
  count: number;
}
