import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  NightAuditDateQueryInput,
  NightAuditHistoryQueryInput,
  NightAuditReportQueryInput,
  RollbackNightAuditInput,
  RunNightAuditInput,
} from './nightAudit.schema';
import { nightAuditService } from './nightAudit.service';

/**
 * Controller transport handlers for night audit operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId.
 */
export class NightAuditController {
  /**
   * Handles pre check requests for night audit operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/pre-check
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  preCheck = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditDateQueryInput;

    const result = await nightAuditService.preCheck(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ preCheck: result }, 'Pre-check completed'),
      res
    );
  });

  /**
   * Handles run audit requests for night audit operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/run
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  runAudit = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as RunNightAuditInput;

    const result = await nightAuditService.runAudit(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ result }, 'Night audit completed', StatusCodes.OK),
      res
    );
  });

  /**
   * Handles get status requests for night audit operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/status
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const result = await nightAuditService.getStatus(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ status: result }, 'Night audit status retrieved'),
      res
    );
  });

  /**
   * Handles get history requests for night audit operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/history
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditHistoryQueryInput;

    const result = await nightAuditService.getHistory(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ history: result }, 'Night audit history retrieved'),
      res
    );
  });

  /**
   * Handles get report requests for night audit operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/report
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditReportQueryInput;

    const result = await nightAuditService.getReport(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ report: result }, 'Night audit report retrieved'),
      res
    );
  });

  /**
   * Handles rollback requests for night audit operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/rollback
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  rollback = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as RollbackNightAuditInput;

    const result = await nightAuditService.rollbackAudit(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ result }, 'Night audit rollback completed', StatusCodes.OK),
      res
    );
  });
}

export const nightAuditController = new NightAuditController();
