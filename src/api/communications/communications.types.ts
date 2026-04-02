import type { Prisma } from '../../generated/prisma';

// ============================================================================
// ENUMS (re-export from Prisma for convenience)
// ============================================================================

export {
  CommunicationType,
  CommunicationChannel,
  CommunicationStatus,
} from '../../generated/prisma';

// ============================================================================
// COMMUNICATION TYPES
// ============================================================================

export type Communication = Prisma.CommunicationGetPayload<{
  include: {
    guest: true;
    reservation: true;
    template: true;
  };
}>;

export type CommunicationWithRelations = Prisma.CommunicationGetPayload<{
  include: {
    guest: true;
    reservation: {
      include: {
        hotel: true;
        rooms: {
          include: {
            room: true;
            roomType: true;
          };
        };
      };
    };
    template: true;
  };
}>;

export interface CommunicationResponse {
  id: string;
  organizationId: string;
  hotelId: string | null;
  guestId: string | null;
  reservationId: string | null;
  type: string;
  channel: string;
  direction: string;
  subject: string | null;
  content: string;
  templateId: string | null;
  status: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  scheduledFor: Date | null;
  fromAddress: string | null;
  toAddress: string | null;
  externalId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CommunicationListResponse {
  communications: CommunicationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export type CommunicationTemplate = Prisma.CommunicationTemplateGetPayload<{
  include: {
    organization: false;
    hotel: false;
  };
}>;

export interface TemplateResponse {
  id: string;
  organizationId: string;
  hotelId: string | null;
  code: string;
  name: string;
  type: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  language: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateListResponse {
  templates: TemplateResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// TEMPLATE ENGINE TYPES
// ============================================================================

export interface GuestContext {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  languageCode: string;
}

export interface ReservationContext {
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmount: string;
  currencyCode: string;
  specialRequests: string | null;
}

export interface RoomContext {
  number: string;
  type: string;
}

export interface HotelContext {
  name: string;
  phone: string;
  email: string;
  address: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface TemplateContext {
  guest: GuestContext;
  reservation?: ReservationContext;
  room?: RoomContext;
  hotel?: HotelContext;
}

export interface PreviewResult {
  subject: string | null;
  body: string;
}

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export interface ProviderPayload {
  to: string;
  subject?: string;
  content: string;
  from?: string;
  metadata?: Record<string, unknown>;
}

export type ProviderChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

// ============================================================================
// SERVICE INPUT TYPES
// ============================================================================

export interface SendCommunicationInput {
  channel: ProviderChannel;
  type: string;
  guestId?: string | undefined;
  reservationId?: string | undefined;
  templateId?: string | undefined;
  subject?: string | undefined;
  content?: string | undefined;
}

export interface BulkSendInput {
  guestIds: string[];
  channel: ProviderChannel;
  type: 'MARKETING' | 'ALERT';
  templateId: string;
}

export interface CreateTemplateInput {
  code: string;
  name: string;
  type: string;
  channel: ProviderChannel;
  language?: string;
  subject?: string;
  bodyTemplate: string;
  hotelId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  bodyTemplate?: string;
  language?: string;
  isActive?: boolean;
}

export interface CommunicationQueryFilters {
  guestId?: string | undefined;
  reservationId?: string | undefined;
  type?: string | undefined;
  channel?: string | undefined;
  status?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface TemplateQueryFilters {
  type?: string | undefined;
  channel?: string | undefined;
  language?: string | undefined;
  isActive?: boolean | undefined;
  hotelId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AnalyticsQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  channel?: string | undefined;
  type?: string | undefined;
  hotelId?: string | undefined;
}

// ============================================================================
// SERVICE RESULT TYPES
// ============================================================================

export interface SendResult {
  communication: CommunicationResponse;
  externalId: string | null;
}

export interface BulkSendResult {
  sent: number;
  failed: number;
  skippedOptOut: number;
  results: Array<{
    guestId: string;
    status: 'sent' | 'failed' | 'skipped_opt_out';
    communicationId?: string;
    error?: string;
  }>;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsSummary {
  totalSent: number;
  delivered: number;
  opened: number;
  failed: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  failureRate: number;
}

export interface ChannelAnalytics {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  deliveryRate: number;
  openRate: number;
}

export interface TypeAnalytics {
  type: string;
  sent: number;
  delivered: number;
  openRate: number;
}

export interface DailyAnalytics {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

export interface AnalyticsResponse {
  period: {
    from: Date;
    to: Date;
  };
  summary: AnalyticsSummary;
  byChannel: ChannelAnalytics[];
  byType: TypeAnalytics[];
  byDay: DailyAnalytics[];
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export type WebhookProviderStatus =
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'bounced'
  | 'clicked'
  | 'unsubscribed';

export interface WebhookPayload {
  externalId: string;
  status: WebhookProviderStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EmailWebhookPayload extends WebhookPayload {
  provider: 'sendgrid' | 'ses' | 'mailgun' | 'postmark';
  email?: string;
  reason?: string;
}

export interface SmsWebhookPayload extends WebhookPayload {
  provider: 'twilio' | 'nexmo' | 'messagebird';
  phoneNumber?: string;
  errorCode?: string;
}
