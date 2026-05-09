import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequestError } from '../errors/index';
import { logger } from '../logger/index';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'otp',
  'code',
]);

const redactSensitiveData = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(objectValue).map(([key, fieldValue]) => [
        key,
        SENSITIVE_FIELD_NAMES.has(key.toLowerCase())
          ? '[REDACTED]'
          : redactSensitiveData(fieldValue),
      ])
    );
  }

  return value;
};

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
          const flattenedErrors = result.error.flatten();

          logger.error('Request validation failed', {
            method: req.method,
            path: req.originalUrl,
            target,
            issues: result.error.issues,
            formattedErrors: result.error.format(),
            flattenedErrors,
            receivedData: redactSensitiveData(req[target]),
          });

          throw new BadRequestError(`Validation failed for ${target}`, flattenedErrors);
        }
        // Replace with parsed (and potentially transformed) data
        req[target] = result.data;
      }
    }

    next();
  };
};
