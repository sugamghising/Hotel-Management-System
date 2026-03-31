// Module exports
export {
  communicationsRoutes,
  reservationCommunicationsRouter,
  communicationsWebhookRoutes,
} from './communications.routes';

export { communicationsController } from './communications.controller';
export { communicationsService, CommunicationsService } from './communications.service';
export { communicationsRepository, CommunicationsRepository } from './communications.repository';

// Template engine
export { templateEngine, render, preview, buildContextFromData } from './template.engine';

// Providers
export {
  defaultProviderRegistry,
  getProviderForChannel,
  emailProvider,
  smsProvider,
  whatsappProvider,
  pushProvider,
  type ICommunicationProvider,
  type ProviderRegistry,
  type ProviderConfig,
} from './providers';

// Types
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
  ProviderChannel,
  SendCommunicationInput,
  BulkSendInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CommunicationQueryFilters,
  TemplateQueryFilters,
  AnalyticsQueryFilters,
  SendResult,
  BulkSendResult,
  AnalyticsResponse,
  WebhookPayload,
  EmailWebhookPayload,
  SmsWebhookPayload,
} from './communications.types';

// Re-export enums from Prisma
export {
  CommunicationType,
  CommunicationChannel,
  CommunicationStatus,
} from './communications.types';
