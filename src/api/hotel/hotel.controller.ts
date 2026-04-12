// src/features/hotels/hotels.controller.ts

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { HotelQueryInput } from './hotel.dto';
import { CloneHotelSchema, CreateHotelSchema, UpdateHotelSchema } from './hotel.schema';
import { hotelService } from './hotel.service';

/**
 * Controller transport handlers for hotel management.
 *
 * Module base route: /api/v1/hotels.
 */
export class HotelController {
  /**
   * Handles create requests for hotel management.
   *
   * Route: POST /api/v1/hotels
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles list requests for hotel management.
   *
   * Route: GET /api/v1/hotels
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get by id requests for hotel management.
   *
   * Route: GET /api/v1/hotels/:hotelId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const includeStats = req.query['stats'] === 'true';

    const hotel = await hotelService.findById(hotelId, organizationId, includeStats);

    handleServiceResponse(ServiceResponse.success({ hotel }, 'Hotel retrieved successfully'), res);
  });

  /**
   * Handles update requests for hotel management.
   *
   * Route: PATCH /api/v1/hotels/:hotelId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = UpdateHotelSchema.parse(req.body);

    const hotel = await hotelService.update(hotelId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ hotel }, 'Hotel updated successfully'), res);
  });

  /**
   * Handles delete requests for hotel management.
   *
   * Route: DELETE /api/v1/hotels/:hotelId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get dashboard requests for hotel management.
   *
   * Route: GET /api/v1/hotels/:hotelId/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const dashboard = await hotelService.getDashboard(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ dashboard }, 'Dashboard retrieved'), res);
  });

  /**
   * Handles get room status summary requests for hotel management.
   *
   * Route: GET /api/v1/hotels/:hotelId/rooms/status-summary
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRoomStatusSummary = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const summary = await hotelService.getRoomStatusSummary(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ summary }, 'Room status retrieved'), res);
  });

  /**
   * Handles get availability requests for hotel management.
   *
   * Route: GET /api/v1/hotels/:hotelId/rooms/availability
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const { startDate, endDate, roomTypeId } = req.query as unknown as {
      startDate: Date;
      endDate: Date;
      roomTypeId?: string;
    };

    const calendar = await hotelService.getAvailabilityCalendar(
      hotelId,
      organizationId,
      startDate,
      endDate,
      roomTypeId
    );

    handleServiceResponse(ServiceResponse.success({ calendar }, 'Availability retrieved'), res);
  });

  /**
   * Handles get settings requests for hotel management.
   *
   * Route: GET /api/v1/hotels/:hotelId/settings
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const settings = await hotelService.getSettings(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ settings }, 'Settings retrieved'), res);
  });

  /**
   * Handles update settings requests for hotel management.
   *
   * Route: PATCH /api/v1/hotels/:hotelId/settings
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles clone requests for hotel management.
   *
   * Route: POST /api/v1/hotels/:hotelId/clone
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
