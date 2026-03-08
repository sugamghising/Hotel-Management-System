// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type GuestType =
  | 'TRANSIENT'
  | 'CORPORATE'
  | 'GROUP'
  | 'CONTRACTUAL'
  | 'COMP'
  | 'STAFF'
  | 'FAMILY_FRIENDS';

export type VIPStatus = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'BLACK';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface Guest {
  id: string;
  organizationId: string;
  hotelId: string | null;

  // Profile
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  dateOfBirth: Date | null;
  nationality: string | null; // ISO country code
  languageCode: string;

  // Identification (encrypted at application layer)
  idType: string | null; // PASSPORT, DRIVERS_LICENSE, ID_CARD, etc.
  idNumber: string | null;
  idExpiryDate: Date | null;

  // Address
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string | null;

  // Classification
  guestType: GuestType;
  vipStatus: VIPStatus;
  vipReason: string | null;

  // Corporate
  companyName: string | null;
  companyTaxId: string | null;

  // Preferences
  roomPreferences: Record<string, unknown> | null;
  dietaryRequirements: string | null;
  specialNeeds: string | null;

  // History (aggregated)
  totalStays: number;
  totalNights: number;
  totalRevenue: number;
  lastStayDate: Date | null;
  averageRate: number;

  // Marketing
  marketingConsent: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;

  // Notes
  internalNotes: string | null;
  alertNotes: string | null; // Shows popup at check-in

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateGuestInput {
  // Profile
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  dateOfBirth?: Date;
  nationality?: string;
  languageCode?: string;

  // Identification
  idType?: string;
  idNumber?: string;
  idExpiryDate?: Date;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;

  // Classification
  guestType?: GuestType;
  vipStatus?: VIPStatus;
  vipReason?: string;

  // Corporate
  companyName?: string;
  companyTaxId?: string;

  // Preferences
  roomPreferences?: Record<string, unknown>;
  dietaryRequirements?: string;
  specialNeeds?: string;

  // Marketing
  marketingConsent?: boolean;
  emailOptIn?: boolean;
  smsOptIn?: boolean;

  // Notes
  internalNotes?: string;
  alertNotes?: string;
}

export interface UpdateGuestInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  dateOfBirth?: Date | null;
  nationality?: string | null;
  languageCode?: string;

  idType?: string | null;
  idNumber?: string | null;
  idExpiryDate?: Date | null;

  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;

  guestType?: GuestType;
  vipStatus?: VIPStatus;
  vipReason?: string | null;

  companyName?: string | null;
  companyTaxId?: string | null;

  roomPreferences?: Record<string, unknown> | null;
  dietaryRequirements?: string | null;
  specialNeeds?: string | null;

  marketingConsent?: boolean;
  emailOptIn?: boolean;
  smsOptIn?: boolean;

  internalNotes?: string | null;
  alertNotes?: string | null;
}

export interface GuestResponse {
  id: string;
  organizationId: string;
  hotelId: string | null;

  // Profile
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  dateOfBirth: Date | null;
  nationality: string | null;
  languageCode: string;

  // Identification
  identification: {
    idType: string | null;
    idNumber: string | null; // Masked: last 4 digits only
    idExpiryDate: Date | null;
    verified: boolean;
  };

  // Address
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    countryCode: string | null;
    fullAddress: string | null;
  };

  // Classification
  guestType: GuestType;
  vipStatus: VIPStatus;
  vipReason: string | null;

  // Corporate
  company: {
    name: string | null;
    taxId: string | null;
  };

  // Preferences
  preferences: {
    room: Record<string, unknown> | null;
    dietary: string | null;
    specialNeeds: string | null;
  };

  // History
  history: {
    totalStays: number;
    totalNights: number;
    totalRevenue: number;
    lastStayDate: Date | null;
    averageRate: number;
  };

  // Marketing
  marketing: {
    consent: boolean;
    emailOptIn: boolean;
    smsOptIn: boolean;
  };

  // Notes
  notes: {
    internal: string | null;
    alert: string | null;
  };

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestListResponse {
  guests: Array<{
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    vipStatus: VIPStatus;
    guestType: GuestType;
    companyName: string | null;
    totalStays: number;
    lastStayDate: Date | null;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GuestStayHistory {
  reservationId: string;
  confirmationNumber: string;
  hotelId: string;
  hotelName: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  roomType: string;
  roomNumber: string | null;
  ratePlan: string;
  totalAmount: number;
  status: string;
  notes: string | null;
}

export interface GuestDuplicate {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  matchScore: number; // 0-100
  matchReasons: string[];
}

export interface MergeGuestsInput {
  targetGuestId: string; // Keep this one
  sourceGuestIds: string[]; // Merge these into target, then delete
  mergeStrategy: {
    keepSourceIfNewer?: boolean; // For conflicting data
    preferSourceFields?: string[]; // Always use source for these
  };
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface GuestQueryFilters {
  search?: string;
  vipStatus?: VIPStatus;
  guestType?: GuestType;
  companyName?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  lastStayAfter?: Date;
  lastStayBefore?: Date;
  minStays?: number;
  minRevenue?: number;
  marketingConsent?: boolean;
}

export interface DuplicateDetectionInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  dateOfBirth?: Date;
  threshold?: number; // Match score threshold (default 70)
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export interface IDDocument {
  type: string;
  number: string;
  expiryDate?: Date;
  issuingCountry?: string;
  scanUrl?: string;
}
