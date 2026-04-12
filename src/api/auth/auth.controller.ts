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

/**
 * Controller transport handlers for authentication.
 *
 * Module base route: /api/v1/auth.
 */
export class AuthController {
  /**
   * Handles login requests for authentication.
   *
   * Route: POST /api/v1/auth/login
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles register requests for authentication.
   *
   * Route: POST /api/v1/auth/register
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles refresh requests for authentication.
   *
   * Route: POST /api/v1/auth/refresh
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles logout requests for authentication.
   *
   * Route: POST /api/v1/auth/logout
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles logout all requests for authentication.
   *
   * Route: POST /api/v1/auth/logout-all
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  logoutAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { refreshToken } = req.body;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.logoutAll(req.user.user.id, refreshToken);
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
   * Handles change password requests for authentication.
   *
   * Route: POST /api/v1/auth/change-password
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  changePassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as ChangePasswordInput;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.changePassword(req.user.user.id, input);
    handleServiceResponse(
      ServiceResponse.success({ message: 'Password changed successfully' }),
      res
    );
  });

  /**
   * Handles forgot password requests for authentication.
   *
   * Route: POST /api/v1/auth/forgot-password
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles reset password requests for authentication.
   *
   * Route: POST /api/v1/auth/reset-password
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.body as ResetPasswordInput;
    await authService.resetPassword(input);
    handleServiceResponse(ServiceResponse.success({ message: 'Password Reset Successfully' }), res);
  });

  /**
   * Handles setup mfa requests for authentication.
   *
   * Route: POST /api/v1/auth/mfa/set-up
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  setupMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    const result = await authService.setupMfa(req.user.user.id);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'MFA setup successfully',
        data: result,
      }),
      res
    );
  });

  /**
   * Handles verify mfa requests for authentication.
   *
   * Route: POST /api/v1/auth/mfa/verify
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  verifyMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { code, secret } = req.body as VerifyMfaInput & { secret: string };
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.verifyAndEnableMfa(req.user.user.id, code, secret);

    handleServiceResponse(ServiceResponse.success({ message: 'MFA enabled successfully' }), res);
  });

  /**
   * Handles disable mfa requests for authentication.
   *
   * Route: POST /api/v1/auth/mfa/disable
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  disableMfa = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { password } = req.body;
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    await authService.disableMfa(req.user.user.id, password);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'MFA disabled successfully',
      }),
      res
    );
  });

  /**
   * Handles me requests for authentication.
   *
   * Route: GET /api/v1/auth/me
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  me = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    const user = await authService.getCurrentUser(req.user.user.id);

    handleServiceResponse(
      ServiceResponse.success({
        message: 'Current user retrieved',
        data: { user },
      }),
      res
    );
  });
}
