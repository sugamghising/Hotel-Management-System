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

export class ChannelController {
  /**
   * Creates a channel connection for a hotel and returns the persisted record.
   *
   * @param req - Express request containing organization/hotel params and payload.
   * @param res - Express response writer.
   * @returns Sends a `201` response with the created connection.
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
   * Lists all channel connections configured for a hotel.
   *
   * @param req - Express request containing organization and hotel identifiers.
   * @param res - Express response writer.
   * @returns Sends a success response with ordered connection rows.
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
   * Retrieves one channel connection by ID within hotel scope.
   *
   * @param req - Express request containing organization, hotel, and connection IDs.
   * @param res - Express response writer.
   * @returns Sends a success response with the requested connection.
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
   * Updates editable channel connection attributes (name, credentials, property mapping).
   *
   * @param req - Express request containing route identifiers and update payload.
   * @param res - Express response writer.
   * @returns Sends a success response with the updated connection.
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
   * Deletes a channel connection after scope validation.
   *
   * @param req - Express request containing organization, hotel, and connection IDs.
   * @param res - Express response writer.
   * @returns Sends a success response with no payload.
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
   * Activates a channel connection so outbound sync jobs can dispatch to providers.
   *
   * @param req - Express request containing scoped route identifiers.
   * @param res - Express response writer.
   * @returns Sends a success response with the activated connection state.
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
   * Deactivates a channel connection to stop outbound synchronization attempts.
   *
   * @param req - Express request containing scoped route identifiers.
   * @param res - Express response writer.
   * @returns Sends a success response with the deactivated connection state.
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
   * Replaces room-type mappings used to translate internal inventory to channel room codes.
   *
   * @param req - Express request containing mapping payload and scoped IDs.
   * @param res - Express response writer.
   * @returns Sends a success response with updated mapping state.
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
   * Replaces rate-plan mappings used for outbound channel rate publication.
   *
   * @param req - Express request containing mapping payload and scoped IDs.
   * @param res - Express response writer.
   * @returns Sends a success response with updated rate mapping state.
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
   * Fetches current room and rate mappings for a connection.
   *
   * @param req - Express request containing scoped route identifiers.
   * @param res - Express response writer.
   * @returns Sends mapping collections used by channel sync jobs.
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
   * Runs an on-demand outbound availability and rate sync for one connection.
   *
   * @param req - Express request with sync date range and scoped identifiers.
   * @param res - Express response writer.
   * @returns Sends sync execution metrics from the service layer.
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
   * Runs outbound synchronization for all active channel connections in a hotel.
   *
   * @param req - Express request with sync window and hotel scope.
   * @param res - Express response writer.
   * @returns Sends an aggregate success/failure summary per connection.
   */
  syncAll = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as SyncAllInput;

    const result = await channelService.syncAll(organizationId, hotelId, input, 'USER');

    handleServiceResponse(ServiceResponse.success(result, 'Channel sync completed'), res);
  });

  /**
   * Returns paginated sync logs for a channel connection.
   *
   * @param req - Express request with route identifiers and log query filters.
   * @param res - Express response writer.
   * @returns Sends log entries plus pagination metadata.
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
   * Processes reservation-create webhooks after signature validation.
   *
   * The handler rejects invalid signatures with `401` and, for valid payloads,
   * forwards raw webhook data to the channel service which performs mapping,
   * persistence, and communication side effects.
   *
   * @param req - Express webhook request containing `channelCode`, headers, and payload.
   * @param res - Express response writer.
   * @returns Sends unauthorized or webhook processing results.
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
   * Processes reservation-modification webhooks after signature validation.
   *
   * @param req - Express webhook request containing `channelCode`, headers, and payload.
   * @param res - Express response writer.
   * @returns Sends unauthorized or webhook processing results.
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
   * Processes reservation-cancellation webhooks after signature validation.
   *
   * @param req - Express webhook request containing `channelCode`, headers, and payload.
   * @param res - Express response writer.
   * @returns Sends unauthorized or webhook processing results.
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
