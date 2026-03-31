// Re-export all schemas
export {
  // Enum schemas
  CommunicationTypeSchema,
  CommunicationChannelSchema,
  CommunicationStatusSchema,
  BulkTypeSchema,
  // Param schemas
  OrganizationIdParamSchema,
  HotelIdParamSchema,
  CommunicationIdParamSchema,
  TemplateIdParamSchema,
  ReservationIdParamSchema,
  ReservationCommunicationParamsSchema,
  // Input schemas
  SendCommunicationSchema,
  BulkSendSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  PreviewTemplateSchema,
  ReservationSendSchema,
  // Query schemas
  CommunicationQuerySchema,
  TemplateQuerySchema,
  AnalyticsQuerySchema,
  // Webhook schemas
  EmailWebhookSchema,
  SmsWebhookSchema,
} from './communications.schema';

// Re-export schema types
export type {
  SendCommunicationInput,
  BulkSendInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  PreviewTemplateInput,
  CommunicationQueryInput,
  TemplateQueryInput,
  AnalyticsQueryInput,
  ReservationSendInput,
} from './communications.schema';

// Re-export domain types
export type {
  Communication,
  CommunicationWithRelations,
  CommunicationResponse,
  CommunicationListResponse,
  CommunicationTemplate,
  TemplateResponse,
  TemplateListResponse,
  TemplateContext,
  PreviewResult,
  ProviderPayload,
  SendResult,
  BulkSendResult,
  AnalyticsResponse,
  AnalyticsSummary,
  ChannelAnalytics,
  TypeAnalytics,
  DailyAnalytics,
  WebhookPayload,
  EmailWebhookPayload,
  SmsWebhookPayload,
} from './communications.types';
