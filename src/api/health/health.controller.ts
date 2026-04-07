import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { healthService } from './health.service';
import type { HealthResponse, ReadinessResponse } from './health.types';

export const healthController = {
  /**
   * Returns liveness health metadata for the current API process.
   *
   * @param _req - Express request object; unused because liveness data is process-derived.
   * @param res - Express response used to return a `200` payload with health data.
   * @returns Sends a JSON response containing status, timestamp, uptime, version, and environment.
   */
  getHealth(_req: Request, res: Response<HealthResponse>): void {
    const health = healthService.getHealth();
    res.status(StatusCodes.OK).json({
      success: true,
      data: health,
    });
  },

  /**
   * Returns readiness status by checking dependencies and mapping to HTTP readiness semantics.
   *
   * Calls the health service readiness check, then maps a healthy database status to `200`
   * and any non-healthy database status to `503`. It always responds with a JSON envelope
   * containing readiness diagnostics for operational visibility.
   *
   * @param _req - Express request object; unused because readiness is computed from service dependencies.
   * @param res - Express response used to return readiness diagnostics and the derived status code.
   * @returns Sends a JSON response with readiness details and either `200` or `503`.
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
