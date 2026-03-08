// Re-export schemas
export {
  CreateGuestSchema,
  UpdateGuestSchema,
  GuestQuerySchema,
  DuplicateDetectionSchema,
  MergeGuestsSchema,
  UpdateVIPSchema,
  GuestIdParamSchema,
  OrganizationIdParamSchema,
  GuestTypeSchema,
  VIPStatusSchema,
  IDTypeSchema,
  CountryCodeSchema,
  LanguageCodeSchema,
  // Types
  type CreateGuestInput,
  type UpdateGuestInput,
  type GuestQueryInput,
  type DuplicateDetectionInput,
  type MergeGuestsInput,
  type UpdateVIPInput,
} from './guests.schema';

// API-specific DTOs
export interface GuestSearchResult {
  guests: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    vipStatus: string;
    lastStay: {
      date: Date | null;
      hotel: string | null;
    };
    totalStays: number;
    matchScore?: number; // For duplicate search
  }>;
  total: number;
}

export interface GuestStats {
  totalGuests: number;
  byVIPStatus: Record<string, number>;
  byGuestType: Record<string, number>;
  byNationality: Array<{ country: string; count: number }>;
  topCompanies: Array<{ name: string; guestCount: number; totalRevenue: number }>;
  recentArrivals: number;
  returningGuests: number; // 2+ stays
}

export interface InHouseGuest {
  reservationId: string;
  confirmationNumber: string;
  guestId: string;
  guestName: string;
  vipStatus: string;
  roomNumber: string;
  roomType: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  balance: number;
  folioTotal: number;
  paymentTotal: number;
  alerts: string[];
}

export interface GuestCommunicationHistory {
  communications: Array<{
    id: string;
    type: string;
    channel: string;
    subject: string;
    sentAt: Date;
    status: string;
    openedAt: Date | null;
  }>;
}
