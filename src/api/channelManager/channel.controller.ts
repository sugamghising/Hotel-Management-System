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
  createConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateConnectionInput;

    const connection = await channelService.createConnection(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success({ connection }, 'Channel connection created', StatusCodes.CREATED),
      res
    );
  });

  listConnections = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const connections = await channelService.listConnections(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ connections }, 'Channel connections retrieved'),
      res
    );
  });

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

  deleteConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    await channelService.deleteConnection(organizationId, hotelId, connectionId);

    handleServiceResponse(ServiceResponse.success(null, 'Channel connection deleted'), res);
  });

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

  getMappings = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, connectionId } = req.params as {
      organizationId: string;
      hotelId: string;
      connectionId: string;
    };

    const mappings = await channelService.getMappings(organizationId, hotelId, connectionId);

    handleServiceResponse(ServiceResponse.success(mappings, 'Mappings retrieved'), res);
  });

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

  syncAll = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as SyncAllInput;

    const result = await channelService.syncAll(organizationId, hotelId, input, 'USER');

    handleServiceResponse(ServiceResponse.success(result, 'Channel sync completed'), res);
  });

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
