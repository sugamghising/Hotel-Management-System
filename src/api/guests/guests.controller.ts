import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { GuestQueryInput, UpdateVIPInput } from './guests.schema';
import { guestsService } from './guests.service';
import type {
  CreateGuestInput,
  DuplicateDetectionInput,
  MergeGuestsInput,
  UpdateGuestInput,
} from './guests.types';

/**
 * Controller transport handlers for guest profile management.
 *
 * Module base routes: /api/v1/organizations/:organizationId/guests; /api/v1/organizations/:organizationId/hotels/:hotelId/guests.
 */
export class GuestsController {
  /**
   * Handles create requests for guest profile management.
   *
   * Route: POST /api/v1/organizations/:organizationId/guests
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as CreateGuestInput;

    const guest = await guestsService.create(organizationId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ guest }, 'Guest created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list requests for guest profile management.
   *
   * Route: GET /api/v1/organizations/:organizationId/guests
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const query = req.query as unknown as GuestQueryInput;

    const result = await guestsService.findByOrganization(
      organizationId,
      Object.fromEntries(
        Object.entries({
          search: query.search,
          vipStatus: query.vipStatus,
          guestType: query.guestType,
          companyName: query.companyName,
          hasEmail: query.hasEmail,
          hasPhone: query.hasPhone,
          lastStayAfter: query.lastStayAfter,
          lastStayBefore: query.lastStayBefore,
          minStays: query.minStays,
          minRevenue: query.minRevenue,
          marketingConsent: query.marketingConsent,
        }).filter(([, v]) => v !== undefined)
      ),
      { page: query.page, limit: query.limit }
    );

    handleServiceResponse(ServiceResponse.success(result, 'Guests retrieved successfully'), res);
  });

  /**
   * Handles get by id requests for guest profile management.
   *
   * Route: GET /api/v1/organizations/:organizationId/guests/:guestId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };
    const includeHistory = req.query['history'] === 'true';

    const guest = await guestsService.findById(guestId, organizationId, includeHistory);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guest retrieved successfully'), res);
  });

  /**
   * Handles update requests for guest profile management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/guests/:guestId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };
    const input = req.body as UpdateGuestInput;

    const guest = await guestsService.update(guestId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guest updated successfully'), res);
  });

  /**
   * Handles delete requests for guest profile management.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/guests/:guestId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };

    await guestsService.delete(guestId, organizationId, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(null, 'Guest deleted successfully', StatusCodes.NO_CONTENT),
      res
    );
  });

  /**
   * Handles find duplicates requests for guest profile management.
   *
   * Route: POST /api/v1/organizations/:organizationId/guests/search/duplicates
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  findDuplicates = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as DuplicateDetectionInput;

    const duplicates = await guestsService.findDuplicates(organizationId, input);

    handleServiceResponse(
      ServiceResponse.success({ duplicates }, 'Duplicate search completed'),
      res
    );
  });

  /**
   * Handles merge requests for guest profile management.
   *
   * Route: POST /api/v1/organizations/:organizationId/guests/merge
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  merge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as MergeGuestsInput;

    const guest = await guestsService.merge(organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guests merged successfully'), res);
  });

  /**
   * Handles update vip requests for guest profile management.
   *
   * Route: POST /api/v1/organizations/:organizationId/guests/:guestId/vip
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateVIP = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };
    const { vipStatus, vipReason } = req.body as UpdateVIPInput;

    const guest = await guestsService.updateVIP(
      guestId,
      organizationId,
      vipStatus,
      vipReason,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ guest }, 'VIP status updated'), res);
  });

  /**
   * Handles get stay history requests for guest profile management.
   *
   * Route: GET /api/v1/organizations/:organizationId/guests/:guestId/history
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getStayHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };

    const history = await guestsService.getStayHistory(guestId, organizationId);

    handleServiceResponse(ServiceResponse.success({ history }, 'Stay history retrieved'), res);
  });

  /**
   * Handles get in house guests requests for guest profile management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/guests/in-house
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getInHouseGuests = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const businessDate = req.query['date'] ? new Date(req.query['date'] as string) : undefined;

    const guests = await guestsService.getInHouseGuests(hotelId, organizationId, businessDate);

    handleServiceResponse(ServiceResponse.success({ guests }, 'In-house guests retrieved'), res);
  });

  /**
   * Handles get stats requests for guest profile management.
   *
   * Route: GET /api/v1/organizations/:organizationId/guests/stats
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };

    const stats = await guestsService.getStats(organizationId);

    handleServiceResponse(ServiceResponse.success({ stats }, 'Guest statistics retrieved'), res);
  });
}

export const guestsController = new GuestsController();
