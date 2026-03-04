// Re-export schemas
export {
  CreateReservationSchema,
  UpdateReservationSchema,
  CheckInSchema,
  CheckOutSchema,
  RoomAssignmentSchema,
  CancellationSchema,
  NoShowSchema,
  WalkInSchema,
  SplitReservationSchema,
  MergeReservationsSchema,
  ReservationSearchSchema,
  ReservationIdParamSchema,
  HotelIdParamSchema,
  OrganizationIdParamSchema,
  ConfirmationNumberSchema,
  BookingSourceSchema,
  GuaranteeTypeSchema,
  CancellationPolicySchema,
  // Types
  type CreateReservationInput,
  type UpdateReservationInput,
  type CheckInInput,
  type CheckOutInput,
  type RoomAssignmentInput,
  type CancellationInput,
  type NoShowInput,
  type WalkInInput,
  type SplitReservationInput,
  type MergeReservationsInput,
  type ReservationSearchInput,
} from './reservations.schema';

// API-specific DTOs
export interface ReservationSummaryResponse {
  todayArrivals: number;
  todayDepartures: number;
  inHouse: number;
  pendingCheckIns: number;
  pendingCheckOuts: number;
  noShows: number;
}

export interface AvailabilityCheckResponse {
  available: boolean;
  roomTypeId: string;
  roomTypeName: string;
  requestedNights: number;
  availableRatePlans: Array<{
    ratePlanId: string;
    ratePlanName: string;
    totalCost: number;
    currency: string;
  }>;
  alternativeDates?: Array<{
    checkIn: string;
    checkOut: string;
    available: boolean;
    lowestRate: number;
  }>;
}
