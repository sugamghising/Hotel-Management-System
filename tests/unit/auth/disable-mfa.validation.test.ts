import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../src/core/middleware/errorHandler';

const mocks = vi.hoisted(() => ({
  disableMfa: vi.fn(),
}));

vi.mock('../../../src/core/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      user: {
        id: '00000000-0000-0000-0000-000000000001',
      },
    } as Request['user'];
    next();
  },
}));

vi.mock('../../../src/api/auth/auth.service', () => ({
  authService: {
    disableMfa: mocks.disableMfa,
  },
}));

import authRoutes from '../../../src/api/auth/auth.routes';

describe('Auth Routes - disable MFA validation', () => {
  let app: Application;

  beforeEach(() => {
    mocks.disableMfa.mockResolvedValue(undefined);
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
    app.use(errorHandler);
  });

  afterEach(() => {
    mocks.disableMfa.mockReset();
  });

  it('returns 400 when password is missing for POST /api/v1/auth/mfa/disable', async () => {
    const response = await request(app).post('/api/v1/auth/mfa/disable').send({}).expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(mocks.disableMfa).not.toHaveBeenCalled();
  });
});
