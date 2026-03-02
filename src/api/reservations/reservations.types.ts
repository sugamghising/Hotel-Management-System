// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'WAITLIST';

export type CheckInStatus =
  | 'NOT_CHECKED_IN'
  | 'EARLY_CHECK_IN'
  | 'CHECKED_IN'
  | 'LATE_CHECK_OUT'
  | 'CHECKED_OUT';

export type BookingSource =
  | 'DIRECT_WEB'
  | 'DIRECT_PHONE'
  | 'DIRECT_WALKIN'
  | 'BOOKING_COM'
  | 'EXPEDIA'
  | 'AIRBNB'
  | 'AGODA'
  | 'TRIPADVISOR'
  | 'CORPORATE'
  | 'TRAVEL_AGENT'
  | 'METASEARCH';

export type GuaranteeType = 'CREDIT_CARD' | 'DEPOSIT' | 'COMPANY_BILL' | 'TRAVEL_AGENT' | 'NONE';

export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT' | 'NON_REFUNDABLE';
export type GuestType =
  | 'TRANSIENT'
  | 'CORPORATE'
  | 'GROUP'
  | 'CONTRACTUAL'
  | 'COMP'
  | 'STAFF'
  | 'FAMILY_FRIENDS';
export type VIPStatus = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'BLACK';
export type RoomReservationStatus =
  | 'RESERVED'
  | 'ASSIGNED'
  | 'OCCUPIED'
  | 'CHECKED_OUT'
  | 'NO_SHOW';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface Reservation {
  id: string;
  organizationId: string;
  hotelId: string;
  guestId: string;

  // Booking reference
  confirmationNumber: string;
  externalRef: string | null; // OTA reference

  // Source
  source: BookingSource;
  channelCode: string | null;
  agentId: string | null;
  corporateCode: string | null;

  // Dates
  checkInDate: Date;
  checkOutDate: Date;
  arrivalTime: Date | null;
  departureTime: Date | null;
  nights: number;

  // Status
  status: ReservationStatus;
  checkInStatus: CheckInStatus;

  // Guest count
  adultCount: number;
  childCount: number;
  infantCount: number;

  // Financial
  currencyCode: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paidAmount: number;
  balance: number;

  // Rate details
  ratePlanId: string;
  rateBreakdown: RateBreakdownItem[];
  averageRate: number;

  // Policies
  cancellationPolicy: CancellationPolicy;
  guaranteeType: GuaranteeType;
  guaranteeAmount: number | null;

  // Payment
  cardToken: string | null;
  cardLastFour: string | null;
  cardExpiryMonth: string | null;
  cardExpiryYear: string | null;
  cardBrand: string | null;

  // Notes
  guestNotes: string | null;
  specialRequests: string | null;
  internalNotes: string | null;

  // Cancellation
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  cancellationFee: number | null;
  noShow: boolean;

  // Metadata
  bookedAt: Date;
  bookedBy: string;
  modifiedAt: Date;
  modifiedBy: string | null;

  // Audit
  createdAt: Date;
  deletedAt: Date | null;
}

export interface RateBreakdownItem {
  date: string;
  rate: number;
  tax: number;
  total: number;
}

export interface ReservationRoom {
  id: string;
  reservationId: string;
  roomId: string | null;
  roomTypeId: string;

  // Assignment
  assignedAt: Date | null;
  assignedBy: string | null;

  // Stay tracking
  checkInAt: Date | null;
  checkOutAt: Date | null;

  // Rate for this room
  roomRate: number;
  adultCount: number;
  childCount: number;

  // Status
  status: RoomReservationStatus;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface CreateReservationInput {
  guestId: string;

  // Dates
  checkInDate: Date;
  checkOutDate: Date;
  arrivalTime?: string;
  departureTime?: string;

  // Guests
  adultCount?: number;
  childCount?: number;
  infantCount?: number;

  // Room request
  roomTypeId: string;
  roomId?: string; // Specific room request
  ratePlanId: string;

  // Source
  source?: BookingSource;
  channelCode?: string;
  corporateCode?: string;

  // Payment
  guaranteeType?: GuaranteeType;
  guaranteeAmount?: number;
  cardToken?: string;
  cardLastFour?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardBrand?: string;

  // Notes
  guestNotes?: string;
  specialRequests?: string;
  internalNotes?: string;

  // Walk-in flag
  isWalkIn?: boolean;
}

export interface UpdateReservationInput {
  checkInDate?: Date;
  checkOutDate?: Date;
  arrivalTime?: string | null;
  departureTime?: string | null;

  adultCount?: number;
  childCount?: number;
  infantCount?: number;

  guestNotes?: string | null;
  specialRequests?: string | null;
  internalNotes?: string | null;
}

export interface ReservationResponse {
  id: string;
  confirmationNumber: string;
  externalRef: string | null;

  status: {
    reservation: ReservationStatus;
    checkIn: CheckInStatus;
  };

  dates: {
    checkIn: Date;
    checkOut: Date;
    arrivalTime: Date | null;
    departureTime: Date | null;
    nights: number;
  };

  guests: {
    primaryGuestId: string;
    primaryGuestName: string;
    adultCount: number;
    childCount: number;
    infantCount: number;
    totalGuests: number;
  };

  rooms: Array<{
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    roomTypeCode: string;
    roomId: string | null;
    roomNumber: string | null;
    status: RoomReservationStatus;
    roomRate: number;
    assignedAt: Date | null;
    checkInAt: Date | null;
    checkOutAt: Date | null;
  }>;

  financial: {
    currencyCode: string;
    nightlyRates: RateBreakdownItem[];
    averageRate: number;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    paidAmount: number;
    balance: number;
  };

  source: {
    bookingSource: BookingSource;
    channelCode: string | null;
    bookedAt: Date;
    bookedBy: string;
  };

  policies: {
    cancellationPolicy: CancellationPolicy;
    guaranteeType: GuaranteeType;
    guaranteeAmount: number | null;
  };

  notes: {
    guestNotes: string | null;
    specialRequests: string | null;
    internalNotes: string | null;
  };

  cancellation?: {
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
    fee: number;
  } | null;

  createdAt: Date;
  modifiedAt: Date;
}

export interface CheckInInput {
  roomId?: string; // If specific room assignment needed
  earlyCheckIn?: boolean;
  idVerification?: {
    idType: string;
    idNumber: string;
    idExpiryDate?: Date;
  };
  paymentAuth?: {
    amount: number;
    method: string;
  };
}

export interface CheckOutInput {
  lateCheckOut?: boolean;
  payment?: {
    amount: number;
    method: string;
  };
}

export interface RoomAssignmentInput {
  roomId: string;
  force?: boolean; // Override conflicts
}

export interface ReservationSearchFilters {
  status?: ReservationStatus;
  checkInFrom?: Date;
  checkInTo?: Date;
  checkOutFrom?: Date;
  checkOutTo?: Date;
  guestName?: string;
  confirmationNumber?: string;
  roomNumber?: string;
  bookingSource?: BookingSource;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface WalkInInput extends CreateReservationInput {
  roomId: string; // Required for walk-in
  paymentMethod: string;
  initialPayment: number;
}

export interface NoShowInput {
  chargeNoShowFee?: boolean;
  waiveReason?: string;
}

export interface SplitReservationInput {
  splitDate: Date;
  newRoomTypeId?: string;
}

export interface MergeReservationsInput {
  sourceReservationId: string;
  targetReservationId: string;
}

export interface ReservationListResponse {
  reservations: Array<{
    id: string;
    confirmationNumber: string;
    guestName: string;
    status: ReservationStatus;
    checkInStatus: CheckInStatus;
    checkInDate: Date;
    checkOutDate: Date;
    nights: number;
    roomType: string;
    roomNumber: string | null;
    totalAmount: number;
    balance: number;
    source: BookingSource;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InHouseGuestResponse {
  reservationId: string;
  guestId: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  balance: number;
  vipStatus: VIPStatus;
}
