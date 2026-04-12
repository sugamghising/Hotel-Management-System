import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { RoomQueryInput } from './rooms.schema';
import { roomsService } from './rooms.service';
import type {
  BulkStatusUpdateInput,
  CreateRoomInput,
  SetOutOfOrderInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
} from './rooms.types';

/**
 * Controller transport handlers for room inventory management.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/rooms.
 */
export class RoomsController {
  /**
   * Handles create requests for room inventory management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rooms
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateRoomInput;

    const room = await roomsService.create(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ room }, 'Room created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as RoomQueryInput;

    const result = await roomsService.findByHotel(
      hotelId,
      organizationId,
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        ...(query.floor !== undefined ? { floor: query.floor } : {}),
        ...(query.building ? { building: query.building } : {}),
        ...(query.isOutOfOrder !== undefined ? { isOutOfOrder: query.isOutOfOrder } : {}),
        ...(query.viewType ? { viewType: query.viewType } : {}),
        ...(query.search ? { search: query.search } : {}),
      },
      { page: query.page, limit: query.limit }
    );

    handleServiceResponse(ServiceResponse.success(result, 'Rooms retrieved'), res);
  });

  /**
   * Handles get grid requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/grid
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getGrid = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const grid = await roomsService.getGrid(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ grid }, 'Room grid retrieved'), res);
  });

  /**
   * Handles get by id requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const includeReservations = req.query['reservations'] === 'true';

    const room = await roomsService.findById(roomId, organizationId, includeReservations);

    handleServiceResponse(ServiceResponse.success({ room }, 'Room retrieved'), res);
  });

  /**
   * Handles update requests for room inventory management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const input = req.body as UpdateRoomInput;

    const room = await roomsService.update(roomId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ room }, 'Room updated'), res);
  });

  /**
   * Handles delete requests for room inventory management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };

    await roomsService.delete(roomId, organizationId, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(null, 'Room deleted', StatusCodes.NO_CONTENT),
      res
    );
  });

  /**
   * Handles update status requests for room inventory management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/status
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const input = req.body as UpdateRoomStatusInput;

    const room = await roomsService.updateStatus(roomId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ room }, 'Status updated'), res);
  });

  /**
   * Handles set out of order requests for room inventory management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/ooo
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  setOutOfOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const input = req.body as SetOutOfOrderInput;

    const room = await roomsService.setOutOfOrder(roomId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ room }, 'Room set out of order'), res);
  });

  /**
   * Handles remove out of order requests for room inventory management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/ooo
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  removeOutOfOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const { reason } = req.body;

    const room = await roomsService.removeOutOfOrder(roomId, organizationId, reason, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ room }, 'Room returned to service'), res);
  });

  /**
   * Handles bulk update status requests for room inventory management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/bulk-status
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  bulkUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as BulkStatusUpdateInput;

    const result = await roomsService.bulkUpdateStatus(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(result, `Updated ${result.updatedCount} rooms`),
      res
    );
  });

  /**
   * Handles check availability requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/availability
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const { checkIn, checkOut, excludeReservationId } = req.query as unknown as {
      checkIn: string;
      checkOut: string;
      excludeReservationId?: string;
    };

    const result = await roomsService.checkAvailability(
      roomId,
      organizationId,
      new Date(checkIn),
      new Date(checkOut),
      excludeReservationId
    );

    handleServiceResponse(ServiceResponse.success(result, 'Availability checked'), res);
  });

  /**
   * Handles find available requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/available
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  findAvailable = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const { checkIn, checkOut, roomTypeId, limit } = req.query as unknown as {
      checkIn: string;
      checkOut: string;
      roomTypeId?: string;
      limit?: string;
    };

    const rooms = await roomsService.findAvailable(
      hotelId,
      organizationId,
      new Date(checkIn),
      new Date(checkOut),
      roomTypeId,
      limit ? Number.parseInt(limit) : 10
    );

    handleServiceResponse(ServiceResponse.success({ rooms }, 'Available rooms retrieved'), res);
  });

  /**
   * Handles get history requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/history
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };
    const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string) : 50;

    const history = await roomsService.getHistory(roomId, organizationId, limit);

    handleServiceResponse(ServiceResponse.success({ history }, 'History retrieved'), res);
  });

  /**
   * Handles get maintenance history requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/:roomId/maintenance-history
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getMaintenanceHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomId } = req.params as { organizationId: string; roomId: string };

    const history = await roomsService.getMaintenanceHistory(roomId, organizationId);

    handleServiceResponse(
      ServiceResponse.success({ history }, 'Maintenance history retrieved'),
      res
    );
  });

  /**
   * Handles get cleaning tasks requests for room inventory management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rooms/cleaning-tasks
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getCleaningTasks = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const status = req.query['status'] as string | undefined;

    const tasks = await roomsService.getCleaningTasks(hotelId, organizationId, status);

    handleServiceResponse(ServiceResponse.success({ tasks }, 'Cleaning tasks retrieved'), res);
  });
}

export const roomsController = new RoomsController();
