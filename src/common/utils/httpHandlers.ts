import type { ServiceResponse } from '@/common/models/serviceResponse';
import type { Response } from 'express';

/**
 * Send a ServiceResponse to the client
 */
export function handleServiceResponse<T>(serviceResponse: ServiceResponse<T>, res: Response): void {
  res.status(serviceResponse.statusCode).json({
    success: serviceResponse.success,
    message: serviceResponse.message,
    data: serviceResponse.data,
  });
}

/**
 * Type for Express response with ServiceResponse
 */
export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};
