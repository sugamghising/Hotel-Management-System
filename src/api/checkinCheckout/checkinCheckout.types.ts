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

export interface ReservationStatusResponse {
  reservation: ReservationResponse;
  folioValidation: {
    canCheckout: boolean;
    balance: number;
    issues: string[];
  };
}
