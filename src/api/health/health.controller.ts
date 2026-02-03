import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { healthService } from './health.service';
import type { HealthResponse, ReadinessResponse } from './health.types';

export const healthController = {
  getHealth(_req: Request, res: Response<HealthResponse>): void {
    const health = healthService.getHealth();
    res.status(StatusCodes.OK).json({
      success: true,
      data: health,
    });
  },

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
