import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../src/config';
import { UnauthorizedError } from '../../../src/core/errors';
import { errorHandler } from '../../../src/core/middleware/errorHandler';

describe('errorHandler', () => {
  const originalIsDevelopment = config.isDevelopment;
  const mutableConfig = config as unknown as { isDevelopment: boolean };

  afterEach(() => {
    mutableConfig.isDevelopment = originalIsDevelopment;
    vi.restoreAllMocks();
  });

  it('does not expose stack trace for unauthorized operational errors', () => {
    mutableConfig.isDevelopment = true;

    const err = new UnauthorizedError('Authentication required');
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;

    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledOnce();
    const payload = json.mock.calls[0][0] as {
      error: { message: string; code: string; stack?: string };
    };
    expect(payload.error.message).toBe('Authentication required');
    expect(payload.error.code).toBe('UNAUTHORIZED');
    expect(payload.error.stack).toBeUndefined();
  });
});
