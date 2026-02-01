import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { config } from '../../config/index';
import { AppError, type ErrorResponse } from '../errors/index';
import { logger } from '../logger/index';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void => {
  // Log the error
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    name: err.name,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: StatusCodes.BAD_REQUEST,
        details: err.flatten(),
      },
    });
    return;
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
      },
    };

    // Include stack trace in development
    if (config.isDevelopment) {
      response.error.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle syntax errors in JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        message: 'Invalid JSON payload',
        code: 'INVALID_JSON',
        statusCode: StatusCodes.BAD_REQUEST,
      },
    });
    return;
  }

  // Handle unknown errors (don't leak details in production)
  const statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  const response: ErrorResponse = {
    success: false,
    error: {
      message: config.isProduction ? 'An unexpected error occurred' : err.message,
      code: 'INTERNAL_ERROR',
      statusCode,
    },
  };

  if (config.isDevelopment) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
