import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { config } from '../../config';
import { UnauthorizedError } from '../errors';

export interface AuthPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
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
    req.user = payload as unknown as AuthPayload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
