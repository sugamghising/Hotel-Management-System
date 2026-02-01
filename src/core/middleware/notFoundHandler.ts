import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { ErrorResponse } from '../errors/index';

export const notFoundHandler = (
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
      statusCode: StatusCodes.NOT_FOUND,
    },
  });
};
