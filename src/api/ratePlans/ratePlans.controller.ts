import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { RatePlanQueryInput } from './ratePlans.schema';
import { ratePlansService } from './ratePlans.service';
import type {
  CreateRatePlanInput,
  RateCalculationInput,
  RateOverrideBulkInput,
  RateOverrideInput,
  RatePlanCloneInput,
  UpdateRatePlanInput,
} from './ratePlans.types';

/**
 * Controller transport handlers for rate plan management.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans.
 */
export class RatePlansController {
  /**
   * Handles create requests for rate plan management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateRatePlanInput;

    const ratePlan = await ratePlansService.create(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ ratePlan }, 'Rate plan created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list requests for rate plan management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as RatePlanQueryInput;

    const result = await ratePlansService.findByHotel(
      hotelId,
      organizationId,
      {
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.isPublic !== undefined ? { isPublic: query.isPublic } : {}),
        ...(query.channelCode ? { channelCode: query.channelCode } : {}),
        ...(query.validOnDate ? { validOnDate: query.validOnDate } : {}),
        ...(query.search ? { search: query.search } : {}),
      },
      { page: query.page, limit: query.limit }
    );

    handleServiceResponse(ServiceResponse.success(result, 'Rate plans retrieved'), res);
  });

  /**
   * Handles get by id requests for rate plan management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const includeStats = req.query['stats'] === 'true';

    const ratePlan = await ratePlansService.findById(ratePlanId, organizationId, includeStats);

    handleServiceResponse(ServiceResponse.success({ ratePlan }, 'Rate plan retrieved'), res);
  });

  /**
   * Handles update requests for rate plan management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const input = req.body as unknown as UpdateRatePlanInput;

    const ratePlan = await ratePlansService.update(
      ratePlanId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ ratePlan }, 'Rate plan updated'), res);
  });

  /**
   * Handles delete requests for rate plan management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };

    await ratePlansService.delete(ratePlanId, organizationId, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(null, 'Rate plan deleted', StatusCodes.NO_CONTENT),
      res
    );
  });

  /**
   * Handles clone requests for rate plan management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/clone
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  clone = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const input = req.body as RatePlanCloneInput;

    const cloned = await ratePlansService.clone(ratePlanId, organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ ratePlan: cloned }, 'Rate plan cloned', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles get calendar requests for rate plan management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/calendar
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getCalendar = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const { startDate, endDate } = req.query as { startDate: string; endDate: string };

    const calendar = await ratePlansService.getCalendar(
      ratePlanId,
      organizationId,
      new Date(startDate),
      new Date(endDate)
    );

    handleServiceResponse(ServiceResponse.success({ calendar }, 'Rate calendar retrieved'), res);
  });

  /**
   * Handles update override requests for rate plan management.
   *
   * Route: PUT /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateOverride = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const input = req.body as unknown as RateOverrideInput;

    const override = await ratePlansService.updateOverride(ratePlanId, organizationId, input);

    handleServiceResponse(ServiceResponse.success({ override }, 'Rate override updated'), res);
  });

  /**
   * Handles bulk update overrides requests for rate plan management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides/bulk
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  bulkUpdateOverrides = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const input = req.body as unknown as RateOverrideBulkInput;

    const result = await ratePlansService.bulkUpdateOverrides(ratePlanId, organizationId, input);

    handleServiceResponse(ServiceResponse.success(result, 'Bulk overrides updated'), res);
  });

  /**
   * Handles delete override requests for rate plan management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  deleteOverride = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, ratePlanId } = req.params as {
      organizationId: string;
      ratePlanId: string;
    };
    const { date } = req.body;

    await ratePlansService.deleteOverride(ratePlanId, organizationId, new Date(date));

    handleServiceResponse(
      ServiceResponse.success(null, 'Rate override deleted', StatusCodes.NO_CONTENT),
      res
    );
  });

  /**
   * Handles calculate requests for rate plan management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans/calculate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  calculate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as unknown as RateCalculationInput;

    const result = await ratePlansService.calculateRates(hotelId, organizationId, input);

    handleServiceResponse(ServiceResponse.success(result, 'Rates calculated'), res);
  });
}
export const ratePlansController = new RatePlansController();
