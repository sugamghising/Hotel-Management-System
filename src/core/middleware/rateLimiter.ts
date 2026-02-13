import rateLimit from 'express-rate-limit';
import { config } from '../../config/index';
import { TooManyRequestsError } from '../errors/index';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skipInTests?: boolean;
}

/**
 * Creates a rate limiter middleware with custom or default options
 */
export const createRateLimiter = (options?: RateLimiterOptions) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = 'Too many requests, please try again later',
    skipInTests = true,
  } = options || {};

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError(message));
    },
    skip: () => skipInTests && config.isTest,
  });
};

/**
 * Default rate limiter middleware using config defaults
 */
export const rateLimiter = createRateLimiter();
