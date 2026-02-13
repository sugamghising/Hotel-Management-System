import { Router } from 'express';
import { createRateLimiter, validate } from '../../core';
import { AuthController } from './auth.controller';
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyMfaSchema,
} from './auth.schema';

const router = Router();
const controller = new AuthController();

// Stricter rate limiting for login endpoint
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
});

//Routes
router.post('/login', loginRateLimiter, validate({ body: LoginSchema }), controller.login);
router.post('/register', validate({ body: RegisterSchema }), controller.register);
router.post('/logout', controller.logout);
router.post('/logout-all', controller.logoutAll);

router.post('/refresh', validate({ body: RefreshTokenSchema }), controller.refresh);

router.post(
  '/change-password',
  validate({ body: ChangePasswordSchema }),
  controller.changePassword
);
router.post(
  '/forgot-password',
  validate({ body: ForgotPasswordSchema }),
  controller.forgotPassword
);
router.post('/reset-password', validate({ body: ResetPasswordSchema }), controller.resetPassword);

router.post('/mfa/set-up', controller.setupMfa);
router.post('/mfa/verify', validate({ body: VerifyMfaSchema }), controller.verifyMfa);
router.post('/mfa/disable', controller.disableMfa);

router.get('/me', controller.me);

export default router;
