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

export class RoomTypesController {
  /**
   * POST /organizations/:organizationId/hotels/:hotelId/room-types
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = CreateRoomTypeSchema.parse(req.body);

    const roomType = await roomTypesService.create(organizationId, hotelId, input, req.user?.sub);

    const response = ServiceResponse.success({ roomType }, 'Room type created successfully', 201);
    handleServiceResponse(response, res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/room-types
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
   * GET /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
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
   * PATCH /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
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
   * DELETE /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId
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
   * POST /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images
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
   * DELETE /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images
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
   * POST /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/images/reorder
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
   * GET /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory
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
   * PUT /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory
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
   * POST /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/inventory/bulk
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
   * POST /organizations/:organizationId/hotels/:hotelId/room-types/:roomTypeId/check-availability
   * Internal endpoint for booking engine
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
