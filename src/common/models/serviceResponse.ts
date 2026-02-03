import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

/**
 * Generic ServiceResponse class for unified API responses
 */
export class ServiceResponse<T = null> {
  readonly success: boolean;
  readonly message: string;
  readonly data: T;
  readonly statusCode: number;

  private constructor(success: boolean, message: string, data: T, statusCode: number) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
  }

  /**
   * Create a successful response
   */
  static success<T>(data: T, message = 'Success', statusCode = StatusCodes.OK): ServiceResponse<T> {
    return new ServiceResponse(true, message, data, statusCode);
  }

  /**
   * Create a failed response
   */
  static failure<T = null>(
    message: string,
    data: T = null as T,
    statusCode = StatusCodes.BAD_REQUEST
  ): ServiceResponse<T> {
    return new ServiceResponse(false, message, data, statusCode);
  }

  /**
   * Create a not found response
   */
  static notFound(message = 'Resource not found'): ServiceResponse<null> {
    return new ServiceResponse(false, message, null, StatusCodes.NOT_FOUND);
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message = 'Unauthorized'): ServiceResponse<null> {
    return new ServiceResponse(false, message, null, StatusCodes.UNAUTHORIZED);
  }

  /**
   * Create a forbidden response
   */
  static forbidden(message = 'Forbidden'): ServiceResponse<null> {
    return new ServiceResponse(false, message, null, StatusCodes.FORBIDDEN);
  }

  /**
   * Create a validation error response
   */
  static validationError<T = null>(
    message = 'Validation failed',
    data: T = null as T
  ): ServiceResponse<T> {
    return new ServiceResponse(false, message, data, StatusCodes.UNPROCESSABLE_ENTITY);
  }

  /**
   * Create an internal server error response
   */
  static serverError(message = 'Internal server error'): ServiceResponse<null> {
    return new ServiceResponse(false, message, null, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Zod schema factory for ServiceResponse
 * Use this to generate OpenAPI schemas
 */
export const ServiceResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data: dataSchema,
    statusCode: z.number(),
  });

/**
 * Type helper for extracting ServiceResponse type
 */
export type ServiceResponseType<T> = {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
};

/**
 * Paginated response wrapper
 */
export interface PaginatedData<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Create a paginated ServiceResponse
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): ServiceResponse<PaginatedData<T>> {
  return ServiceResponse.success(
    {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
    message
  );
}
