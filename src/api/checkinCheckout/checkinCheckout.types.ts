import type { ReservationResponse } from '../reservations';

export interface FrontDeskDashboardResponse {
  businessDate: string;
  occupancy: {
    totalRooms: number;
    occupied: number;
    available: number;
    outOfOrder: number;
    occupancyRate: number;
  };
  arrivals: {
    expected: number;
    checkedIn: number;
    pending: number;
  };
  departures: {
    expected: number;
    checkedOut: number;
    pending: number;
  };
  inHouseCount: number;
}

export interface RoomGridItem {
  roomId: string;
  roomNumber: string;
  floor: number | null;
  status: string;
  roomTypeCode: string | null;
  housekeepingPriority: number | null;
}

export interface CheckInRequestInput {
  roomId?: string;
  earlyCheckIn?: boolean;
  idDocumentId?: string;
  cardToken?: string;
  cardLastFour?: string;
  cardBrand?: string;
  keysIssued?: number;
  keyCardRef?: string;
  checkInNotes?: string;
}

export interface EarlyCheckInInput extends CheckInRequestInput {
  earlyFeeAmount?: number;
  earlyFeeReason?: string;
}

export interface WalkInCheckInInput {
  guestId: string;
  roomTypeId: string;
  roomId: string;
  ratePlanId: string;
  checkOutDate: Date;
  adultCount?: number;
  childCount?: number;
  infantCount?: number;
  paymentMethod: string;
  initialPayment: number;
  cardToken?: string;
  cardLastFour?: string;
  cardBrand?: string;
  guestNotes?: string;
  specialRequests?: string;
}

export interface CheckoutInput {
  capturePreAuth?: boolean;
  paymentMethod?: string;
  cardToken?: string;
  invoiceEmail?: string;
  keysReturned?: number;
  satisfactionScore?: number;
  checkOutNotes?: string;
}

export interface LateCheckoutInput {
  extraHours: number;
  applyFee?: boolean;
  feeAmount?: number;
  reason?: string;
}

export interface ExtendStayInput {
  newCheckOutDate: Date;
  reason?: string;
}

export interface ShortenStayInput {
  newCheckOutDate: Date;
  reason?: string;
}

export interface ReservationStatusResponse {
  reservation: ReservationResponse;
  folioValidation: {
    canCheckout: boolean;
    balance: number;
    issues: string[];
  };
}
