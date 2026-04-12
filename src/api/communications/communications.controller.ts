import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { reservationsService } from '../reservations';
import type {
  AnalyticsQueryInput,
  BulkSendInput,
  CommunicationQueryInput,
  CreateTemplateInput,
  PreviewTemplateInput,
  ReservationSendInput,
  SendCommunicationInput,
  TemplateQueryInput,
  UpdateTemplateInput,
} from './communications.dto';
import { communicationsService } from './communications.service';
import type { CommunicationType, ProviderChannel } from './communications.types';

/**
 * Controller transport handlers for guest communications.
 *
 * Module base routes: /api/v1/organizations/:organizationId/communications; /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications; /webhooks/communications.
 */
export class CommunicationsController {
  // ============================================================================
  // SEND COMMUNICATIONS
  // ============================================================================

  /**
   * Handles send requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/communications/send
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  send = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as SendCommunicationInput;

    const result = await communicationsService.send(organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(
        { communication: result.communication, externalId: result.externalId },
        'Communication sent',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * Handles send bulk requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/communications/send/bulk
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  sendBulk = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as BulkSendInput;

    const result = await communicationsService.sendBulk(organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(result, 'Bulk send completed', StatusCodes.OK),
      res
    );
  });

  // ============================================================================
  // QUERY COMMUNICATIONS
  // ============================================================================

  /**
   * Handles list requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/communications
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const query = req.query as unknown as CommunicationQueryInput;

    const result = await communicationsService.search(organizationId, query);

    handleServiceResponse(ServiceResponse.success(result, 'Communications retrieved'), res);
  });

  /**
   * Handles get by id requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/communications/:communicationId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, communicationId } = req.params as {
      organizationId: string;
      communicationId: string;
    };

    const communication = await communicationsService.findById(organizationId, communicationId);

    handleServiceResponse(
      ServiceResponse.success({ communication }, 'Communication retrieved'),
      res
    );
  });

  /**
   * Handles get by reservation requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getByReservation = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    // Ensure route-scoped reservation ownership is enforced.
    await reservationsService.findById(reservationId, organizationId, hotelId);

    const communications = await communicationsService.findByReservation(
      organizationId,
      hotelId,
      reservationId
    );

    handleServiceResponse(
      ServiceResponse.success({ communications }, 'Communications retrieved'),
      res
    );
  });

  /**
   * Handles get analytics requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/communications/analytics
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const query = req.query as unknown as AnalyticsQueryInput;

    const analytics = await communicationsService.getAnalytics(organizationId, query);

    handleServiceResponse(ServiceResponse.success(analytics, 'Analytics retrieved'), res);
  });

  // ============================================================================
  // RESERVATION-TRIGGERED SENDS
  // ============================================================================

  /**
   * Handles send confirmation requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications/confirmation
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  sendConfirmation = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as ReservationSendInput;

    await reservationsService.findById(reservationId, organizationId, hotelId);

    const result = await communicationsService.sendForReservation(
      reservationId,
      'RESERVATION_CONFIRMATION' as CommunicationType,
      input.channel as ProviderChannel | undefined,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        { communication: result.communication },
        'Confirmation sent',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * Handles send pre arrival requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications/pre-arrival
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  sendPreArrival = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as ReservationSendInput;

    await reservationsService.findById(reservationId, organizationId, hotelId);

    const result = await communicationsService.sendForReservation(
      reservationId,
      'CHECKIN_REMINDER' as CommunicationType,
      input.channel as ProviderChannel | undefined,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        { communication: result.communication },
        'Pre-arrival reminder sent',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * Handles send checkout reminder requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications/checkout-reminder
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  sendCheckoutReminder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as ReservationSendInput;

    await reservationsService.findById(reservationId, organizationId, hotelId);

    const result = await communicationsService.sendForReservation(
      reservationId,
      'CHECKOUT_REMINDER' as CommunicationType,
      input.channel as ProviderChannel | undefined,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        { communication: result.communication },
        'Checkout reminder sent',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * Handles send survey requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications/survey
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  sendSurvey = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as ReservationSendInput;

    await reservationsService.findById(reservationId, organizationId, hotelId);

    const result = await communicationsService.sendForReservation(
      reservationId,
      'SURVEY' as CommunicationType,
      input.channel as ProviderChannel | undefined,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        { communication: result.communication },
        'Survey sent',
        StatusCodes.CREATED
      ),
      res
    );
  });

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Handles create template requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/communications/templates
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as CreateTemplateInput;

    const template = await communicationsService.createTemplate(
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ template }, 'Template created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list templates requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/communications/templates
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listTemplates = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const query = req.query as unknown as TemplateQueryInput;

    const result = await communicationsService.searchTemplates(organizationId, query);

    handleServiceResponse(ServiceResponse.success(result, 'Templates retrieved'), res);
  });

  /**
   * Handles get template requests for guest communications.
   *
   * Route: GET /api/v1/organizations/:organizationId/communications/templates/:templateId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, templateId } = req.params as {
      organizationId: string;
      templateId: string;
    };

    const template = await communicationsService.getTemplate(organizationId, templateId);

    handleServiceResponse(ServiceResponse.success({ template }, 'Template retrieved'), res);
  });

  /**
   * Handles update template requests for guest communications.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/communications/templates/:templateId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, templateId } = req.params as {
      organizationId: string;
      templateId: string;
    };
    const input = req.body as UpdateTemplateInput;

    const template = await communicationsService.updateTemplate(
      organizationId,
      templateId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ template }, 'Template updated'), res);
  });

  /**
   * Handles delete template requests for guest communications.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/communications/templates/:templateId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, templateId } = req.params as {
      organizationId: string;
      templateId: string;
    };

    await communicationsService.deleteTemplate(organizationId, templateId, req.user?.sub);

    handleServiceResponse(ServiceResponse.success(null, 'Template deleted'), res);
  });

  /**
   * Handles preview template requests for guest communications.
   *
   * Route: POST /api/v1/organizations/:organizationId/communications/templates/:templateId/preview
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  previewTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, templateId } = req.params as {
      organizationId: string;
      templateId: string;
    };
    const input = req.body as PreviewTemplateInput;

    const preview = await communicationsService.previewTemplate(organizationId, templateId, input);

    handleServiceResponse(ServiceResponse.success(preview, 'Template preview generated'), res);
  });

  // ============================================================================
  // WEBHOOKS (no auth - signature verification only)
  // ============================================================================

  /**
   * Handles handle email webhook requests for guest communications.
   *
   * Route: POST /webhooks/communications/email
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  handleEmailWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signatureValid = communicationsService.verifyWebhookSignature('EMAIL', req);
    if (!signatureValid) {
      res.status(StatusCodes.OK).json({ received: true });
      return;
    }

    // Parse provider-specific payload
    // This is a generic handler - actual parsing depends on the provider (SendGrid, SES, etc.)
    const body = req.body as Record<string, unknown>;

    // Extract common fields (provider-specific parsing would go here)
    const externalId =
      (body['externalId'] as string) ||
      (body['sg_message_id'] as string) ||
      (body['MessageId'] as string) ||
      '';
    const event =
      (body['event'] as string) ||
      (body['eventType'] as string) ||
      (body['notificationType'] as string);
    const timestamp = body['timestamp']
      ? new Date(body['timestamp'] as string | number)
      : new Date();

    if (externalId && event) {
      const statusMap: Record<string, string> = {
        // SendGrid
        delivered: 'delivered',
        open: 'opened',
        bounce: 'bounced',
        dropped: 'failed',
        // SES
        Delivery: 'delivered',
        Open: 'opened',
        Bounce: 'bounced',
        Complaint: 'failed',
      };

      const status = statusMap[event];
      if (status) {
        await communicationsService.handleWebhook(
          'EMAIL',
          externalId,
          status as 'delivered' | 'opened' | 'failed' | 'bounced',
          timestamp
        );
      }
    }

    // Always return 200 to prevent retries
    res.status(StatusCodes.OK).json({ received: true });
  });

  /**
   * Handles handle sms webhook requests for guest communications.
   *
   * Route: POST /webhooks/communications/sms
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  handleSmsWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signatureValid = communicationsService.verifyWebhookSignature('SMS', req);
    if (!signatureValid) {
      res.status(StatusCodes.OK).json({ received: true });
      return;
    }

    // Parse provider-specific payload
    // This is a generic handler - actual parsing depends on the provider (Twilio, Nexmo, etc.)
    const body = req.body as Record<string, unknown>;

    // Extract common fields (provider-specific parsing would go here)
    const externalId =
      (body['externalId'] as string) ||
      (body['MessageSid'] as string) ||
      (body['message_id'] as string) ||
      '';
    const status = (body['MessageStatus'] as string) || (body['status'] as string) || '';
    const timestamp = body['timestamp']
      ? new Date(body['timestamp'] as string | number)
      : new Date();

    if (externalId && status) {
      const statusMap: Record<string, string> = {
        // Twilio
        delivered: 'delivered',
        undelivered: 'failed',
        failed: 'failed',
        // Nexmo
        expired: 'failed',
        rejected: 'failed',
      };

      const mappedStatus = statusMap[status.toLowerCase()];
      if (mappedStatus) {
        await communicationsService.handleWebhook(
          'SMS',
          externalId,
          mappedStatus as 'delivered' | 'failed',
          timestamp
        );
      }
    }

    // Always return 200 to prevent retries
    res.status(StatusCodes.OK).json({ received: true });
  });
}

export const communicationsController = new CommunicationsController();
