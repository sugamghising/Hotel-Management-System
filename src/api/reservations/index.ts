// Controller & Service
export { ReservationsController, reservationsController } from './reservations.controller';
export { ReservationsService, reservationsService } from './reservations.service';
export { ReservationsRepository, reservationsRepository } from './reservations.repository';
export { default as reservationsRoutes } from './reservations.routes';

// Types
export type {
  Reservation,
  ReservationRoom,
  ReservationStatus,
  CheckInStatus,
  BookingSource,
  GuaranteeType,
  CancellationPolicy,
  GuestType,
  VIPStatus,
  RoomReservationStatus,
  RateBreakdownItem,
  CreateReservationInput,
  UpdateReservationInput,
  ReservationResponse,
  CheckInInput,
  CheckOutInput,
  RoomAssignmentInput,
  ReservationSearchFilters,
  ReservationListResponse,
  InHouseGuestResponse,
  WalkInInput,
  NoShowInput,
  SplitReservationInput,
  MergeReservationsInput,
} from './reservations.types';

// Schemas & DTOs
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
  type CreateReservationInput as CreateReservationInputType,
  type UpdateReservationInput as UpdateReservationInputType,
  type CheckInInput as CheckInInputType,
  type CheckOutInput as CheckOutInputType,
  type RoomAssignmentInput as RoomAssignmentInputType,
  type CancellationInput,
  type NoShowInput as NoShowInputType,
  type WalkInInput as WalkInInputType,
  type SplitReservationInput as SplitReservationInputType,
  type MergeReservationsInput as MergeReservationsInputType,
  type ReservationSearchInput as ReservationSearchInputType,
} from './reservations.schema';

export type {
  ReservationSummaryResponse,
  AvailabilityCheckResponse,
} from './reservations.dto';
