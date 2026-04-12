import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  CreateConnectionInput,
  MapRatesInput,
  MapRoomsInput,
  SyncAllInput,
  SyncInput,
  SyncLogQueryInput,
  UpdateConnectionInput,
} from './channel.schema';
import { channelService } from './channel.service';

/**
 * Resolves `hotelId` from webhook input sources in priority order.
 *
 * The resolver checks header (`x-hotel-id`), query string, and JSON body so
 * inbound webhook routes can identify the target hotel even when providers
 * deliver different payload shapes.
 *
 * @param req - Incoming webhook request.
 * @returns The trimmed hotel ID when present, otherwise `undefined`.
 */
const resolveInboundHotelId = (req: Request): string | undefined => {
  const headerHotelId = req.headers['x-hotel-id'];
  const headerValue = Array.isArray(headerHotelId) ? headerHotelId[0] : headerHotelId;

  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  const queryHotelId = req.query['hotelId'];
  if (typeof queryHotelId === 'string' && queryHotelId.trim().length > 0) {
    return queryHotelId.trim();
  }

  const body = req.body as Record<string, unknown>;
  const bodyHotelId = body?.['hotelId'];
  if (typeof bodyHotelId === 'string' && bodyHotelId.trim().length > 0) {
    return bodyHotelId.trim();
  }

  return undefined;
};

/**
 * Controller transport handlers for channel management.
 *
 * Module base routes: /api/v1/organizations/:organizationId/hotels/:hotelId/channels; /webhooks/channels.
 */
export class ChannelController {
  /**
   * Handles create connection requests for channel management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateConnectionInput;

    const connection = await channelService.createConnection(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list connections requests for channel management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listConnections = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const connections = await channelService.listConnections(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ connections }, 'Channel connections retrieved'),
      res
    );
  });

  /**
   * Handles get connection requests for channel management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    const connection = await channelService.getConnection(organizationId, hotelId, connectionId);

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection retrieved'),
      res
    );
  });

  /**
   * Handles update connection requests for channel management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };
    const input = req.body as UpdateConnectionInput;

    const connection = await channelService.updateConnection(
      organizationId,
      hotelId,
      connectionId,
      input
    );

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection updated'),
      res
    );
  });

  /**
   * Handles delete connection requests for channel management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  deleteConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    await channelService.deleteConnection(organizationId, hotelId, connectionId);

    handleServiceResponse(ServiceResponse.success(null, 'Channel connection deleted'), res);
  });

  /**
   * Handles activate connection requests for channel management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/activate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  activateConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    const connection = await channelService.activateConnection(
      organizationId,
      hotelId,
      connectionId
    );

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection activated'),
      res
    );
  });

  /**
   * Handles deactivate connection requests for channel management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/deactivate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  deactivateConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    const connection = await channelService.deactivateConnection(
      organizationId,
      hotelId,
      connectionId
    );

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection deactivated'),
      res
    );
  });

  /**
   * Handles map rooms requests for channel management.
   *
   * Route: PUT /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/mappings/rooms
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  mapRooms = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };
    const input = req.body as MapRoomsInput;

    const connection = await channelService.mapRooms(organizationId, hotelId, connectionId, input);

    handleServiceResponse(ServiceResponse.success({ connection }, 'Room mappings updated'), res);
  });

  /**
   * Handles map rates requests for channel management.
   *
   * Route: PUT /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/mappings/rates
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  mapRates = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };
    const input = req.body as MapRatesInput;

    const connection = await channelService.mapRates(organizationId, hotelId, connectionId, input);

    handleServiceResponse(ServiceResponse.success({ connection }, 'Rate mappings updated'), res);
  });

  /**
   * Handles get mappings requests for channel management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/mappings
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getMappings = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    const mappings = await channelService.getMappings(organizationId, hotelId, connectionId);

    handleServiceResponse(ServiceResponse.success(mappings, 'Mappings retrieved'), res);
  });

  /**
   * Handles sync connection requests for channel management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/sync
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  syncConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };
    const input = req.body as SyncInput;

    const result = await channelService.pushAvailabilityAndRates(
      organizationId,
      hotelId,
      connectionId,
      input,
      'USER'
    );

    handleServiceResponse(ServiceResponse.success(result, 'Channel sync completed'), res);
  });

  /**
   * Handles sync all requests for channel management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/channels/sync/all
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  syncAll = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as SyncAllInput;

    const result = await channelService.syncAll(organizationId, hotelId, input, 'USER');

    handleServiceResponse(ServiceResponse.success(result, 'Channel sync completed'), res);
  });

  /**
   * Handles get sync logs requests for channel management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/channels/connections/:connectionId/sync-logs
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getSyncLogs = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };
    const query = req.query as unknown as SyncLogQueryInput;

    const result = await channelService.getSyncLogs(organizationId, hotelId, connectionId, query);

    handleServiceResponse(ServiceResponse.success(result, 'Sync logs retrieved'), res);
  });

  /**
   * Handles handle reservation webhook requests for channel management.
   *
   * Route: POST /webhooks/channels/:channelCode/reservation
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  handleReservationWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { channelCode } = req.params as { channelCode: string };

    const isValid = channelService.verifyWebhookSignature(channelCode, req);
    if (!isValid) {
      handleServiceResponse(ServiceResponse.unauthorized('Invalid webhook signature'), res);
      return;
    }

    const result = await channelService.handleInboundReservation(
      channelCode,
      req.body,
      resolveInboundHotelId(req)
    );

    handleServiceResponse(ServiceResponse.success(result, 'Webhook processed'), res);
  });

  /**
   * Handles handle modification webhook requests for channel management.
   *
   * Route: POST /webhooks/channels/:channelCode/modification
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  handleModificationWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { channelCode } = req.params as { channelCode: string };

    const isValid = channelService.verifyWebhookSignature(channelCode, req);
    if (!isValid) {
      handleServiceResponse(ServiceResponse.unauthorized('Invalid webhook signature'), res);
      return;
    }

    const result = await channelService.handleInboundModification(
      channelCode,
      req.body,
      resolveInboundHotelId(req)
    );

    handleServiceResponse(ServiceResponse.success(result, 'Webhook processed'), res);
  });

  /**
   * Handles handle cancellation webhook requests for channel management.
   *
   * Route: POST /webhooks/channels/:channelCode/cancellation
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  handleCancellationWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { channelCode } = req.params as { channelCode: string };

    const isValid = channelService.verifyWebhookSignature(channelCode, req);
    if (!isValid) {
      handleServiceResponse(ServiceResponse.unauthorized('Invalid webhook signature'), res);
      return;
    }

    const result = await channelService.handleInboundCancellation(
      channelCode,
      req.body,
      resolveInboundHotelId(req)
    );

    handleServiceResponse(ServiceResponse.success(result, 'Webhook processed'), res);
  });
}

export const channelController = new ChannelController();
