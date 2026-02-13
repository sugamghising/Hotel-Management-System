import type { NextFunction, Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { UnauthorizedError, asyncHandler } from '../../core';
import type {
  ForgotPasswordInput,
  RefreshTokenInput,
  ResetPasswordInput,
  VerifyMfaInput,
} from './auth.schema';
import { authService } from './auth.service';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.types';

export class AuthController {
  /**
   * POST /auth/login
   */
  login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
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

  /**
   * POST: /auth/register
   */
  register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as RegisterInput;
    const result = await authService.register(input);
    handleServiceResponse(
      ServiceResponse.success({ data: result }, 'Registration Successful'),
      res
    );
  });

  /**
   * POST /auth/refresh
   */
  refresh = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as RefreshTokenInput;
    const tokens = await authService.refreshToken(input.refreshToken, input.deviceFingerprint);
    handleServiceResponse(
      ServiceResponse.success({ data: { tokens } }, 'Token refreshed successfully'),
      res
    );
  });

  /**
   * POST /auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    handleServiceResponse(
      ServiceResponse.success({ message: 'Logged out successfully' }, 'Logout successful'),
      res
    );
  });

  /**
   *  POST /auth/logout-all
   */
  logoutAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { refreshToken } = req.body;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.logoutAll(req.user.userId, refreshToken);
    handleServiceResponse(
      ServiceResponse.success(
        {
          message: 'Loggedout successful in all devices.',
        },
        'Logged out from all devices'
      ),
      res
    );
  });

  /**
   * POST /auth/change-password
   */
  changePassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as ChangePasswordInput;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.changePassword(req.user.userId, input);
    handleServiceResponse(
      ServiceResponse.success({ message: 'Password changed successfully' }),
      res
    );
  });

  /**
   *  POST /auth/forgot-password
   */
  forgotPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as ForgotPasswordInput;
    await authService.forgotPassword(input.email, input.organizationCode);
    handleServiceResponse(
      ServiceResponse.success({ message: 'If the email exists, a reset link has been sent' }),
      res
    );
  });

  /**
   *  POST /auth/reset-password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as ResetPasswordInput;
    await authService.resetPassword(input);
    handleServiceResponse(ServiceResponse.success({ message: 'Password Reset Successfully' }), res);
  });

  /**
   * POST /auth/mfa/setup
   */
  setupMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    const result = await authService.setupMfa(req.user.userId);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'MFA setup successfully',
        data: result,
      }),
      res
    );
  });

  /**
   * POST /auth/mfa/verify
   */
  verifyMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { code, secret } = req.body as VerifyMfaInput & { secret: string };
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.verifyAndEnableMfa(req.user.userId, code, secret);

    handleServiceResponse(ServiceResponse.success({ message: 'MFA enabled successfully' }), res);
  });

  /**
   * POST /auth/mfa/disable
   */
  disableMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { password } = req.body;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.disableMfa(req.user.userId, password);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'MFA disabled successfully',
      }),
      res
    );
  });

  /**
   * GET /auth/me
   */
  me = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    const user = await authService.getCurrentUser(req.user.userId);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'Current user retrieved',
        data: { user },
      }),
      res
    );
  });
}
