import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequestError } from '../errors/index';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Middleware factory to validate request data against Zod schemas
 */
export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const targets: ValidationTarget[] = ['body', 'query', 'params'];

    for (const target of targets) {
      const schema = schemas[target];
      if (schema) {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
          throw new BadRequestError(`Validation failed for ${target}`, result.error.flatten());
        }
        // Replace with parsed (and potentially transformed) data
        req[target] = result.data;
      }
    }

    next();
  };
};
