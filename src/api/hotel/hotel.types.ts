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
