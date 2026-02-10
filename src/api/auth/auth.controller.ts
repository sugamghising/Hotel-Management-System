import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { authService } from './auth.service';
import type { LoginInput } from './auth.types';

export class AuthController {
  /**
   * POST /auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;
    const result = await authService.login(input, req.ip, req.get('User-Agent'));
    if (result.mfaRequired) {
      handleServiceResponse(
        ServiceResponse.success(
          {
            mfaRequired: true,
            mfaToken: result.mfaToken,
            user: result.user,
          },
          'MFA verification required'
        ),
        res
      );
      return;
    }

    handleServiceResponse(
      ServiceResponse.success(
        {
          user: result.user,
          tokens: result.tokens,
        },
        'Login successful'
      ),
      res
    );
  });
}
