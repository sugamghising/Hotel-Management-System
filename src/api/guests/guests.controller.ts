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

export class GuestsController {
  /**
   * POST /organizations/:organizationId/guests
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
   * GET /organizations/:organizationId/guests
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
   * GET /organizations/:organizationId/guests/:guestId
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };
    const includeHistory = req.query['history'] === 'true';

    const guest = await guestsService.findById(guestId, organizationId, includeHistory);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guest retrieved successfully'), res);
  });

  /**
   * PATCH /organizations/:organizationId/guests/:guestId
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };
    const input = req.body as UpdateGuestInput;

    const guest = await guestsService.update(guestId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guest updated successfully'), res);
  });

  /**
   * DELETE /organizations/:organizationId/guests/:guestId
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
   * POST /organizations/:organizationId/guests/search/duplicates
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
   * POST /organizations/:organizationId/guests/merge
   */
  merge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const input = req.body as MergeGuestsInput;

    const guest = await guestsService.merge(organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ guest }, 'Guests merged successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/guests/:guestId/vip
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
   * GET /organizations/:organizationId/guests/:guestId/history
   */
  getStayHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, guestId } = req.params as { organizationId: string; guestId: string };

    const history = await guestsService.getStayHistory(guestId, organizationId);

    handleServiceResponse(ServiceResponse.success({ history }, 'Stay history retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/guests/in-house
   */
  getInHouseGuests = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const businessDate = req.query['date'] ? new Date(req.query['date'] as string) : undefined;

    const guests = await guestsService.getInHouseGuests(hotelId, organizationId, businessDate);

    handleServiceResponse(ServiceResponse.success({ guests }, 'In-house guests retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/guests/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };

    const stats = await guestsService.getStats(organizationId);

    handleServiceResponse(ServiceResponse.success({ stats }, 'Guest statistics retrieved'), res);
  });
}

export const guestsController = new GuestsController();
