import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import type { AccessTokenPayload } from '../../api/auth/auth.types';
import { config } from '../../config';
import { UnauthorizedError } from '../errors';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);

  try {
    const secret = new TextEncoder().encode(config.jwt.accessSecret);
    const { payload } = await jwtVerify(token, secret);
    req.user = payload as unknown as AccessTokenPayload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
