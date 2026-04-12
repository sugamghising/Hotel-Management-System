import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import {
  CreateRoomTypeSchema,
  type InventoryQueryInput,
  RoomTypeInventoryBulkSchema,
  RoomTypeInventorySchema,
  RoomTypeQuerySchema,
} from './roomTypes.schema';
import { UpdateRoomTypeSchema } from './roomTypes.schema';
import { roomTypesService } from './roomTypes.service';

/**
 * Controller transport handlers for room type management.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/room-types.
 */
export class RoomTypesController {
  /**
   * Handles create requests for room type management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/room-types
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = CreateRoomTypeSchema.parse(req.body);

    const roomType = await roomTypesService.create(organizationId, hotelId, input, req.user?.sub);

    const response = ServiceResponse.success({ roomType }, 'Room type created successfully', 201);
    handleServiceResponse(response, res);
  });

  /**
   * Handles list requests for room type management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/room-types
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = RoomTypeQuerySchema.parse(req.query);

    const result = await roomTypesService.findByHotel(
      hotelId,
      organizationId,
      {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.isBookable !== undefined && { isBookable: query.isBookable }),
        ...(query.viewType !== undefined && { viewType: query.viewType }),
        ...(query.search !== undefined && { search: query.search }),
      },
      { page: query.page, limit: query.limit }
    );

    const response = ServiceResponse.success(result, 'Room types retrieved');
    handleServiceResponse(response, res);
  });

  /**
   * Handles get by id requests for room type management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const includeStats = req.query['stats'] === 'true';

    const roomType = await roomTypesService.findById(roomTypeId, organizationId, includeStats);

    const response = ServiceResponse.success({ roomType }, 'Room type retrieved');
    handleServiceResponse(response, res);
  });

  /**
   * Handles update requests for room type management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const input = UpdateRoomTypeSchema.parse(req.body);

    const roomType = await roomTypesService.update(
      roomTypeId,
      organizationId,
      input,
      req.user?.sub
    );

    const response = ServiceResponse.success({ roomType }, 'Room type updated');
    handleServiceResponse(response, res);
  });

  /**
   * Handles delete requests for room type management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };

    await roomTypesService.delete(roomTypeId, organizationId, req.user?.sub);

    const response = ServiceResponse.success(null, 'Room type deleted', 204);
    handleServiceResponse(response, res);
  });

  /**
   * Handles add image requests for room type management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  addImage = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const { url, caption, order, isPrimary } = req.body;

    const roomType = await roomTypesService.addImage(roomTypeId, organizationId, {
      url,
      caption,
      order,
      isPrimary,
    });

    const response = ServiceResponse.success({ roomType }, 'Image added', 201);
    handleServiceResponse(response, res);
  });

  /**
   * Handles remove image requests for room type management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const { url } = req.body;

    const roomType = await roomTypesService.removeImage(roomTypeId, organizationId, url);

    const response = ServiceResponse.success({ roomType }, 'Image removed');
    handleServiceResponse(response, res);
  });

  /**
   * Handles reorder images requests for room type management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images/reorder
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  reorderImages = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const { orders } = req.body; // [{ url, order }]

    const roomType = await roomTypesService.reorderImages(roomTypeId, organizationId, orders);

    const response = ServiceResponse.success({ roomType }, 'Images reordered');
    handleServiceResponse(response, res);
  });

  /**
   * Handles get inventory requests for room type management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getInventory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const { startDate, endDate } = req.query as unknown as InventoryQueryInput;

    const calendar = await roomTypesService.getInventory(
      roomTypeId,
      organizationId,
      startDate,
      endDate
    );

    const response = ServiceResponse.success({ calendar }, 'Inventory retrieved');
    handleServiceResponse(response, res);
  });

  /**
   * Handles update inventory requests for room type management.
   *
   * Route: PUT /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateInventory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const input = RoomTypeInventorySchema.parse(req.body);

    const inventory = await roomTypesService.updateInventory(roomTypeId, organizationId, input);

    const response = ServiceResponse.success({ inventory }, 'Inventory updated');
    handleServiceResponse(response, res);
  });

  /**
   * Handles bulk update inventory requests for room type management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory/bulk
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  bulkUpdateInventory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, roomTypeId } = req.params as {
      organizationId: string;
      roomTypeId: string;
    };
    const input = RoomTypeInventoryBulkSchema.parse(req.body);

    const result = await roomTypesService.bulkUpdateInventory(roomTypeId, organizationId, input);

    const response = ServiceResponse.success(result, `Updated ${result.updatedCount} days`);
    handleServiceResponse(response, res);
  });

  /**
   * Handles check availability requests for room type management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/check-availability
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId } = req.params as { roomTypeId: string };
    const { checkIn, checkOut, adults, children } = req.body;

    const result = await roomTypesService.checkAvailability(
      roomTypeId,
      new Date(checkIn),
      new Date(checkOut),
      { adults, children }
    );

    const response = ServiceResponse.success(result, 'Availability checked');
    handleServiceResponse(response, res);
  });
}

export const roomTypesController = new RoomTypesController();
