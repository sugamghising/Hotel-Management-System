import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { healthService } from './health.service';
import type { HealthResponse } from './health.types';

export const healthController = {
  getHealth(_req: Request, res: Response<HealthResponse>): void {
    const health = healthService.getHealth();
    res.status(StatusCodes.OK).json({
      success: true,
      data: health,
    });
  },
};
