import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger/index';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Log request
  logger.http(`→ ${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'http';

    logger.log(level, `← ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
};
