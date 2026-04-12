import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { healthService } from './health.service';
import type { HealthResponse, ReadinessResponse } from './health.types';

/**
 * Controller transport handlers for health monitoring.
 *
 * Module base route: /health.
 */
export const healthController = {
  /**
   * Handles get health requests for health monitoring.
   *
   * Route: GET /health
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getHealth(_req: Request, res: Response<HealthResponse>): void {
    const health = healthService.getHealth();
    res.status(StatusCodes.OK).json({
      success: true,
      data: health,
    });
  },

  /**
   * Handles ready requests for health monitoring.
   *
   * Route: GET /health/ready
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  async ready(_req: Request, res: Response<ReadinessResponse>): Promise<void> {
    const health = await healthService.check();

    const statusCode =
      health.database.status === 'healthy' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  },
};
