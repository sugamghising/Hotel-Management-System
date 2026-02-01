import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    stack?: string | undefined;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = ReasonPhrases.BAD_REQUEST, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ReasonPhrases.UNAUTHORIZED) {
    super(message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ReasonPhrases.FORBIDDEN) {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ReasonPhrases.NOT_FOUND) {
    super(message, StatusCodes.NOT_FOUND, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ReasonPhrases.CONFLICT) {
    super(message, StatusCodes.CONFLICT, 'CONFLICT', true);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = ReasonPhrases.UNPROCESSABLE_ENTITY, details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'UNPROCESSABLE_ENTITY', true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = ReasonPhrases.TOO_MANY_REQUESTS) {
    super(message, StatusCodes.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', true);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = ReasonPhrases.INTERNAL_SERVER_ERROR) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = ReasonPhrases.SERVICE_UNAVAILABLE) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', false);
  }
}
