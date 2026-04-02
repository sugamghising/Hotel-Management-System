import type { Prisma } from '../../generated/prisma';

export type ChannelSyncType = 'AVAILABILITY_PUSH' | 'RATE_PUSH' | 'RESERVATION_PULL' | 'FULL_SYNC';

export type ChannelSyncDirection = 'INBOUND' | 'OUTBOUND';

export type ChannelSyncStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export type ChannelTriggerSource = 'USER' | 'SYSTEM' | 'WEBHOOK' | 'NIGHT_AUDIT';

export interface RoomMapping {
  internalRoomTypeId: string;
  externalRoomTypeCode: string;
}

export interface RatePlanMapping {
  internalRatePlanId: string;
  externalRatePlanCode: string;
  markup?: number | undefined;
}

export interface CreateChannelConnectionInput {
  channelCode: string;
  channelName: string;
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  propertyId?: string | undefined;
}

export interface UpdateChannelConnectionInput {
  channelName?: string | undefined;
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  propertyId?: string | undefined;
}

export interface MapRoomsInput {
  mappings: RoomMapping[];
}

export interface MapRatesInput {
  mappings: RatePlanMapping[];
}

export interface SyncInput {
  dateFrom: Date;
  dateTo: Date;
}

export interface SyncLogQueryFilters {
  syncType?: string | undefined;
  status?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  page: number;
  limit: number;
}

export interface AvailabilityPayloadItem {
  date: Date;
  externalRoomCode: string;
  available: number;
  stopSell: boolean;
}

export interface AvailabilityPayload {
  dateFrom: Date;
  dateTo: Date;
  items: AvailabilityPayloadItem[];
}

export interface RatesPayloadItem {
  date: Date;
  externalRoomCode: string;
  externalRateCode: string;
  rate: Prisma.Decimal;
}

export interface RatesPayload {
  dateFrom: Date;
  dateTo: Date;
  items: RatesPayloadItem[];
}

export interface ChannelReservation {
  externalRef: string;
  channelCode: string;
  externalRoomTypeCode: string;
  externalRatePlanCode: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail?: string | undefined;
  guestPhone?: string | undefined;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  totalAmount: Prisma.Decimal;
  currencyCode: string;
  specialRequests?: string | undefined;
  bookedAt: Date;
}

export interface ChannelModification {
  externalRef: string;
  channelCode: string;
  checkInDate?: Date | undefined;
  checkOutDate?: Date | undefined;
  adults?: number | undefined;
  children?: number | undefined;
  totalAmount?: Prisma.Decimal | undefined;
}

export interface ChannelCancellation {
  externalRef: string;
  channelCode: string;
  cancellationReason?: string | undefined;
}

export interface ChannelConnectionResponse {
  id: string;
  hotelId: string;
  channelCode: string;
  channelName: string;
  isActive: boolean;
  propertyId: string | null;
  ratePlanMappings: RatePlanMapping[];
  roomMappings: RoomMapping[];
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  syncErrors: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelConnectionListResponse {
  connections: ChannelConnectionResponse[];
}

export interface ChannelSyncLogResponse {
  id: string;
  connectionId: string;
  hotelId: string;
  syncType: string;
  direction: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  recordsProcessed: number;
  recordsFailed: number;
  errorDetails: Prisma.JsonValue | null;
  triggeredBy: string;
}

export interface ChannelSyncLogListResponse {
  logs: ChannelSyncLogResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SyncExecutionResult {
  connectionId: string;
  channelCode: string;
  status: 'success' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  error?: string | undefined;
}

export interface SyncAllResult {
  totalConnections: number;
  successful: number;
  failed: number;
  results: SyncExecutionResult[];
}

export interface WebhookProcessingResult {
  handled: boolean;
  reservationId?: string | undefined;
  reason?: string | undefined;
}
