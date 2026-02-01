import rateLimit from 'express-rate-limit';
import { config } from '../../config/index';
import { TooManyRequestsError } from '../errors/index';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests, please try again later'));
  },
  skip: () => config.isTest, // Skip rate limiting in tests
});
