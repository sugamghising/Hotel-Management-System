import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { ratePlansService } from './ratePlans.service';
import type {
  CreateRatePlanInput,
  RateCalculationInput,
  RateOverrideBulkInput,
  RateOverrideInput,
  RatePlanCloneInput,
  RatePlanQueryFilters,
  UpdateRatePlanInput,
} from './ratePlans.types';

export class RatePlansController {
  /**
   * POST /organizations/:organizationId/hotels/:hotelId/rate-plans
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
   * GET /organizations/:organizationId/hotels/:hotelId/rate-plans
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as Record<string, string | undefined>;

    const filters: RatePlanQueryFilters = {};
    if (query['roomTypeId']) filters.roomTypeId = query['roomTypeId'];
    if (query['isActive'] !== undefined) filters.isActive = query['isActive'] === 'true';
    if (query['isPublic'] !== undefined) filters.isPublic = query['isPublic'] === 'true';
    if (query['channelCode']) filters.channelCode = query['channelCode'];
    if (query['validOnDate']) filters.validOnDate = new Date(query['validOnDate']);
    if (query['search']) filters.search = query['search'];

    const page = Number(query['page'] || '1');
    const limit = Number(query['limit'] || '20');

    const result = await ratePlansService.findByHotel(hotelId, organizationId, filters, {
      page,
      limit,
    });

    handleServiceResponse(ServiceResponse.success(result, 'Rate plans retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
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
   * PATCH /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
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
   * DELETE /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId
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
   * POST /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/clone
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
   * GET /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/calendar
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
   * PUT /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides
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
   * POST /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides/bulk
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
   * DELETE /organizations/:organizationId/hotels/:hotelId/rate-plans/:ratePlanId/overrides
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
   * POST /organizations/:organizationId/hotels/:hotelId/rate-plans/calculate
   * Public endpoint for booking engine
   */
  calculate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as unknown as RateCalculationInput;

    const result = await ratePlansService.calculateRates(hotelId, organizationId, input);

    handleServiceResponse(ServiceResponse.success(result, 'Rates calculated'), res);
  });
}
