import { ServiceResponseSchema } from '@/common/models/serviceResponse';
import { StatusCodes } from 'http-status-codes';
import type { z } from 'zod';

/**
 * Create an OpenAPI response object for a single status code
 */
export function createApiResponse(
  schema: z.ZodTypeAny,
  description: string,
  statusCode = StatusCodes.OK
) {
  return {
    [statusCode]: {
      description,
      content: {
        'application/json': {
          schema: ServiceResponseSchema(schema),
        },
      },
    },
  };
}

/**
 * Configuration for multiple API responses
 */
export type ApiResponseConfig = {
  schema: z.ZodTypeAny;
  description: string;
  statusCode: StatusCodes;
};

/**
 * Create multiple OpenAPI response objects
 */
export function createApiResponses(configs: ApiResponseConfig[]) {
  const responses: Record<
    number,
    {
      description: string;
      content: {
        'application/json': {
          schema: z.ZodTypeAny;
        };
      };
    }
  > = {};

  for (const { schema, description, statusCode } of configs) {
    responses[statusCode] = {
      description,
      content: {
        'application/json': {
          schema: ServiceResponseSchema(schema),
        },
      },
    };
  }

  return responses;
}
