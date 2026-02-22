// src/features/hotels/hotels.controller.ts

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { HotelQueryInput } from './hotel.dto';
import { CloneHotelSchema, CreateHotelSchema, UpdateHotelSchema } from './hotel.schema';
import { hotelService } from './hotel.service';

export class HotelController {
  /**
   * POST /organizations/:organizationId/hotels
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = CreateHotelSchema.parse(req.body);

    const hotel = await hotelService.create(organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ hotel }, 'Hotel created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const query = req.query as unknown as HotelQueryInput;

    const result = await hotelService.findByOrganization(
      organizationId,
      {
        status: query.status,
        propertyType: query.propertyType,
        countryCode: query.countryCode,
        city: query.city,
        search: query.search,
      } as Parameters<typeof hotelService.findByOrganization>[1],
      { page: query.page, limit: query.limit }
    );

    handleServiceResponse(ServiceResponse.success(result, 'Hotels retrieved successfully'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const includeStats = req.query['stats'] === 'true';

    const hotel = await hotelService.findById(hotelId, organizationId, includeStats);

    handleServiceResponse(ServiceResponse.success({ hotel }, 'Hotel retrieved successfully'), res);
  });

  /**
   * PATCH /organizations/:organizationId/hotels/:hotelId
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = UpdateHotelSchema.parse(req.body);

    const hotel = await hotelService.update(hotelId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ hotel }, 'Hotel updated successfully'), res);
  });

  /**
   * DELETE /organizations/:organizationId/hotels/:hotelId
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    await hotelService.delete(hotelId, organizationId, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(null, 'Hotel deleted successfully', StatusCodes.NO_CONTENT),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/dashboard
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const dashboard = await hotelService.getDashboard(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ dashboard }, 'Dashboard retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/rooms/status-summary
   */
  getRoomStatusSummary = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const summary = await hotelService.getRoomStatusSummary(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ summary }, 'Room status retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/rooms/availability
   */
  getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const { startDate, endDate, roomTypeId } = req.query as {
      startDate: string;
      endDate: string;
      roomTypeId?: string;
    };

    const calendar = await hotelService.getAvailabilityCalendar(
      hotelId,
      organizationId,
      new Date(startDate),
      new Date(endDate),
      roomTypeId
    );

    handleServiceResponse(ServiceResponse.success({ calendar }, 'Availability retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/settings
   */
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const settings = await hotelService.getSettings(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ settings }, 'Settings retrieved'), res);
  });

  /**
   * PATCH /organizations/:organizationId/hotels/:hotelId/settings
   */
  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const { operational, policies, amenities } = req.body;

    await hotelService.updateSettings(
      hotelId,
      organizationId,
      { operational, policies, amenities },
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(null, 'Settings updated successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/clone
   */
  clone = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = CloneHotelSchema.parse(req.body);

    const cloned = await hotelService.clone(hotelId, organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ hotel: cloned }, 'Hotel cloned successfully', StatusCodes.CREATED),
      res
    );
  });
}

export const hotelController = new HotelController();
