import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { communicationsController } from './communications.controller';
import {
  AnalyticsQuerySchema,
  BulkSendSchema,
  CommunicationIdParamSchema,
  CommunicationQuerySchema,
  CreateTemplateSchema,
  EmailWebhookSchema,
  OrganizationIdParamSchema,
  PreviewTemplateSchema,
  ReservationCommunicationParamsSchema,
  ReservationSendSchema,
  SendCommunicationSchema,
  SmsWebhookSchema,
  TemplateIdParamSchema,
  TemplateQuerySchema,
  UpdateTemplateSchema,
} from './communications.schema';

// ============================================================================
// MAIN COMMUNICATIONS ROUTER (authenticated)
// ============================================================================

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware);

// ----------------------------------------------------------------------------
// Send Communications
// ----------------------------------------------------------------------------

router.post(
  '/send',
  requirePermission('COMMUNICATION.SEND'),
  validate({
    params: OrganizationIdParamSchema,
    body: SendCommunicationSchema,
  }),
  communicationsController.send
);

router.post(
  '/send/bulk',
  requirePermission('COMMUNICATION.SEND_BULK'),
  validate({
    params: OrganizationIdParamSchema,
    body: BulkSendSchema,
  }),
  communicationsController.sendBulk
);

// ----------------------------------------------------------------------------
// Query Communications
// ----------------------------------------------------------------------------

router.get(
  '/',
  requirePermission('COMMUNICATION.VIEW'),
  validate({
    params: OrganizationIdParamSchema,
    query: CommunicationQuerySchema,
  }),
  communicationsController.list
);

router.get(
  '/analytics',
  requirePermission('COMMUNICATION.VIEW_ANALYTICS'),
  validate({
    params: OrganizationIdParamSchema,
    query: AnalyticsQuerySchema,
  }),
  communicationsController.getAnalytics
);

// ----------------------------------------------------------------------------
// Template Management
// ----------------------------------------------------------------------------

router.post(
  '/templates',
  requirePermission('TEMPLATE.CREATE'),
  validate({
    params: OrganizationIdParamSchema,
    body: CreateTemplateSchema,
  }),
  communicationsController.createTemplate
);

router.get(
  '/templates',
  requirePermission('TEMPLATE.VIEW'),
  validate({
    params: OrganizationIdParamSchema,
    query: TemplateQuerySchema,
  }),
  communicationsController.listTemplates
);

router.get(
  '/templates/:templateId',
  requirePermission('TEMPLATE.VIEW'),
  validate({
    params: OrganizationIdParamSchema.merge(TemplateIdParamSchema),
  }),
  communicationsController.getTemplate
);

router.patch(
  '/templates/:templateId',
  requirePermission('TEMPLATE.UPDATE'),
  validate({
    params: OrganizationIdParamSchema.merge(TemplateIdParamSchema),
    body: UpdateTemplateSchema,
  }),
  communicationsController.updateTemplate
);

router.delete(
  '/templates/:templateId',
  requirePermission('TEMPLATE.DELETE'),
  validate({
    params: OrganizationIdParamSchema.merge(TemplateIdParamSchema),
  }),
  communicationsController.deleteTemplate
);

router.post(
  '/templates/:templateId/preview',
  requirePermission('TEMPLATE.VIEW'),
  validate({
    params: OrganizationIdParamSchema.merge(TemplateIdParamSchema),
    body: PreviewTemplateSchema,
  }),
  communicationsController.previewTemplate
);

router.get(
  '/:communicationId',
  requirePermission('COMMUNICATION.VIEW'),
  validate({
    params: OrganizationIdParamSchema.merge(CommunicationIdParamSchema),
  }),
  communicationsController.getById
);

// ============================================================================
// RESERVATION COMMUNICATIONS ROUTER (nested under reservations)
// ============================================================================

const reservationCommunicationsRouter = Router({ mergeParams: true });

// All routes require authentication
reservationCommunicationsRouter.use(authMiddleware);

reservationCommunicationsRouter.get(
  '/',
  requirePermission('COMMUNICATION.VIEW'),
  validate({
    params: ReservationCommunicationParamsSchema,
  }),
  communicationsController.getByReservation
);

reservationCommunicationsRouter.post(
  '/confirmation',
  requirePermission('COMMUNICATION.SEND'),
  validate({
    params: ReservationCommunicationParamsSchema,
    body: ReservationSendSchema,
  }),
  communicationsController.sendConfirmation
);

reservationCommunicationsRouter.post(
  '/pre-arrival',
  requirePermission('COMMUNICATION.SEND'),
  validate({
    params: ReservationCommunicationParamsSchema,
    body: ReservationSendSchema,
  }),
  communicationsController.sendPreArrival
);

reservationCommunicationsRouter.post(
  '/checkout-reminder',
  requirePermission('COMMUNICATION.SEND'),
  validate({
    params: ReservationCommunicationParamsSchema,
    body: ReservationSendSchema,
  }),
  communicationsController.sendCheckoutReminder
);

reservationCommunicationsRouter.post(
  '/survey',
  requirePermission('COMMUNICATION.SEND'),
  validate({
    params: ReservationCommunicationParamsSchema,
    body: ReservationSendSchema,
  }),
  communicationsController.sendSurvey
);

// ============================================================================
// WEBHOOK ROUTER (no auth - signature verification only)
// ============================================================================

const webhookRouter = Router();

// No auth middleware - webhooks come from external providers
// Signature verification happens in the controller

webhookRouter.post(
  '/email',
  // Webhook validation is intentionally lenient: validation errors should not
  // cause 4xx responses that trigger provider retry storms. The body is passed
  // through as-is; the controller handles unknown/extra fields gracefully.
  validate({ body: EmailWebhookSchema }),
  communicationsController.handleEmailWebhook
);

webhookRouter.post(
  '/sms',
  validate({ body: SmsWebhookSchema }),
  communicationsController.handleSmsWebhook
);

// ============================================================================
// EXPORTS
// ============================================================================

export {
  router as communicationsRoutes,
  reservationCommunicationsRouter,
  webhookRouter as communicationsWebhookRoutes,
};

export default router;
