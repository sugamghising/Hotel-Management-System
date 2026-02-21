// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type PropertyType = 'HOTEL' | 'RESORT' | 'MOTEL' | 'HOSTEL' | 'APARTMENT' | 'VILLA' | 'BNB';

export type HotelStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_CONSTRUCTION' | 'MAINTENANCE' | 'CLOSED';

export interface Hotel {
  id: string;
  organizationId: string;
  code: string;
  name: string;

  // Legal & Branding
  legalName: string | null;
  brand: string | null;

  // Classification
  starRating: number | null;
  propertyType: PropertyType;

  // Contact
  email: string;
  phone: string;
  fax: string | null;
  website: string | null;

  // Address
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateProvince: string | null;
  postalCode: string;
  countryCode: string;

  // Geolocation
  latitude: number | null;
  longitude: number | null;
  timezone: string;

  // Operational Settings
  checkInTime: Date; // Time stored as Date object
  checkOutTime: Date;
  currencyCode: string;
  defaultLanguage: string;

  // Capacity
  totalRooms: number;
  totalFloors: number | null;

  // Configuration (JSONB fields)
  operationalSettings: HotelOperationalSettings;
  amenities: string[];
  policies: HotelPolicies;

  // Status
  status: HotelStatus;
  openingDate: Date | null;
  closingDate: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
  lastModifiedByDevice: string | null;
}

export interface HotelOperationalSettings {
  earlyCheckInAllowed?: boolean;
  earlyCheckInFee?: number;
  lateCheckOutAllowed?: boolean;
  lateCheckOutFee?: number;
  expressCheckout?: boolean;
  keyCardSystem?: string;
  parkingAvailable?: boolean;
  parkingFee?: number;
  petPolicy?: 'ALLOWED' | 'NOT_ALLOWED' | 'RESTRICTED';
  petFee?: number;
  smokingPolicy?: 'ALLOWED' | 'NOT_ALLOWED' | 'DESIGNATED_AREAS';
  wifiPolicy?: 'FREE' | 'PAID' | 'TIERED';
  [key: string]: unknown;
}

export interface HotelPolicies {
  cancellationPolicyDefault?: string;
  depositPolicy?: string;
  childPolicy?: string;
  groupPolicy?: string;
  [key: string]: unknown;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateHotelInput {
  code: string;
  name: string;
  legalName?: string;
  brand?: string;
  propertyType?: PropertyType;
  starRating?: number;

  // Contact
  email: string;
  phone: string;
  fax?: string;
  website?: string;

  // Address
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  countryCode: string;

  // Geolocation
  latitude?: number;
  longitude?: number;
  timezone?: string;

  // Operational
  checkInTime?: string; // "HH:MM" format
  checkOutTime?: string;
  currencyCode?: string;
  defaultLanguage?: string;

  // Capacity
  totalFloors?: number;

  // Configuration
  amenities?: string[];
  operationalSettings?: Partial<HotelOperationalSettings>;
  policies?: Partial<HotelPolicies>;

  // Status
  status?: HotelStatus;
  openingDate?: Date;
}

export interface UpdateHotelInput {
  name?: string;
  legalName?: string;
  brand?: string;
  starRating?: number;
  propertyType?: PropertyType;

  // Contact
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;

  // Geolocation
  latitude?: number;
  longitude?: number;
  timezone?: string;

  // Operational
  checkInTime?: string;
  checkOutTime?: string;
  currencyCode?: string;
  defaultLanguage?: string;

  // Configuration
  amenities?: string[];
  operationalSettings?: Partial<HotelOperationalSettings>;
  policies?: Partial<HotelPolicies>;

  // Status
  status?: HotelStatus;
  openingDate?: Date;
  closingDate?: Date;
}

export interface HotelResponse {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  legalName: string | null;
  brand: string | null;
  propertyType: PropertyType;
  starRating: number | null;

  contact: {
    email: string;
    phone: string;
    fax: string | null;
    website: string | null;
  };

  address: {
    line1: string;
    line2: string | null;
    city: string;
    stateProvince: string | null;
    postalCode: string;
    countryCode: string;
    fullAddress: string;
  };

  location: {
    latitude: number | null;
    longitude: number | null;
    timezone: string;
  };

  operations: {
    checkInTime: string;
    checkOutTime: string;
    currencyCode: string;
    defaultLanguage: string;
  };

  capacity: {
    totalRooms: number;
    totalFloors: number | null;
  };

  configuration: {
    amenities: string[];
    operationalSettings: HotelOperationalSettings;
    policies: HotelPolicies;
  };

  status: HotelStatus;
  dates: {
    openingDate: Date | null;
    closingDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  stats?: HotelStats;
}

export interface HotelStats {
  roomTypesCount: number;
  roomsCount: number;
  activeRoomsCount: number;
  oooRoomsCount: number;
  todayArrivals: number;
  todayDepartures: number;
  inHouseGuests: number;
  occupancyRate: number;
}

export interface HotelDashboardData {
  hotel: HotelResponse;
  today: {
    date: string;
    arrivals: number;
    departures: number;
    inHouse: number;
    occupancyPercent: number;
  };
  roomStatus: {
    vacantClean: number;
    vacantDirty: number;
    occupiedClean: number;
    occupiedDirty: number;
    outOfOrder: number;
  };
  alerts: Array<{
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    message: string;
    entityType?: string;
    entityId?: string;
  }>;
}

export interface HotelCloneInput {
  targetOrganizationId?: string;
  newCode: string;
  newName: string;
  copyRoomTypes: boolean;
  copyRatePlans: boolean;
  copySettings: boolean;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface HotelQueryFilters {
  status?: HotelStatus;
  propertyType?: PropertyType;
  countryCode?: string;
  city?: string;
  search?: string;
}

export interface RoomStatusSummary {
  total: number;
  byStatus: Record<string, number>;
  byType: Array<{
    roomTypeId: string;
    roomTypeName: string;
    roomTypeCode: string;
    total: number;
    available: number;
    occupied: number;
    ooo: number;
  }>;
}

export interface AvailabilityCalendarQuery {
  startDate: Date;
  endDate: Date;
  roomTypeId?: string;
}
