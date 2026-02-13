import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';

// ============ Response Schemas with OpenAPI metadata ============

export const UserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().optional(),
    organizationId: z.string().uuid(),
    status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED']),
    mfaEnabled: z.boolean(),
    emailVerified: z.boolean(),
  })
  .openapi('UserResponse');

export const TokensResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
  })
  .openapi('TokensResponse');

export const LoginResponseSchema = z
  .object({
    user: UserResponseSchema,
    tokens: TokensResponseSchema,
  })
  .openapi('LoginResponse');

export const MfaRequiredResponseSchema = z
  .object({
    mfaRequired: z.boolean(),
    mfaToken: z.string(),
    user: UserResponseSchema,
  })
  .openapi('MfaRequiredResponse');

export const MfaSetupResponseSchema = z
  .object({
    secret: z.string(),
    qrCode: z.string(),
    backupCodes: z.array(z.string()),
  })
  .openapi('MfaSetupResponse');

export const MessageResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi('MessageResponse');

export const RefreshTokenResponseSchema = z
  .object({
    tokens: TokensResponseSchema,
  })
  .openapi('RefreshTokenResponse');

export const CurrentUserResponseSchema = z
  .object({
    user: UserResponseSchema,
  })
  .openapi('CurrentUserResponse');

// ============ Request Schemas (imported and enhanced with OpenAPI) ============

export const LoginRequestSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    organizationCode: z.string().min(1, 'Organization code is required'),
    mfaCode: z.string().length(6).regex(/^\d+$/).optional(),
    deviceFingerprint: z.string().optional(),
    deviceName: z.string().max(100).optional(),
  })
  .openapi('LoginRequest');

export const RegisterRequestSchema = z
  .object({
    organizationId: z.string().uuid('Invalid organization ID'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    middleName: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    employeeId: z.string().max(50).optional(),
    department: z.string().max(100).optional(),
    jobTitle: z.string().max(100).optional(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']).optional(),
  })
  .openapi('RegisterRequest');

export const RefreshTokenRequestSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
    deviceFingerprint: z.string().optional(),
  })
  .openapi('RefreshTokenRequest');

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  })
  .openapi('ChangePasswordRequest');

export const ForgotPasswordRequestSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    organizationCode: z.string().min(1, 'Organization code is required'),
  })
  .openapi('ForgotPasswordRequest');

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  })
  .openapi('ResetPasswordRequest');

export const VerifyMfaRequestSchema = z
  .object({
    code: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d+$/, 'Must be numeric'),
    tempToken: z.string().optional(),
  })
  .openapi('VerifyMfaRequest');

export const DisableMfaRequestSchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
  })
  .openapi('DisableMfaRequest');

export const LogoutRequestSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  })
  .openapi('LogoutRequest');

// ============ OpenAPI Registry ============

export const authRegistry = new OpenAPIRegistry();

// Register schemas
authRegistry.register('UserResponse', UserResponseSchema);
authRegistry.register('TokensResponse', TokensResponseSchema);
authRegistry.register('LoginResponse', LoginResponseSchema);
authRegistry.register('LoginRequest', LoginRequestSchema);

// POST /api/v1/auth/login - Authenticate user
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  summary: 'Login user',
  description:
    'Authenticate a user with email, password, and organization code. Returns user info and tokens, or requires MFA if enabled.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
          example: {
            email: 'user@example.com',
            password: 'SecurePass123!',
            organizationCode: 'ORG001',
            deviceFingerprint: 'device123',
            deviceName: 'Chrome Browser',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      z.union([LoginResponseSchema, MfaRequiredResponseSchema]),
      'Login successful',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Invalid credentials', StatusCodes.UNAUTHORIZED),
    ...createApiResponse(z.null(), 'Too many login attempts', StatusCodes.TOO_MANY_REQUESTS),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// POST /api/v1/auth/register - Register new user
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Authentication'],
  summary: 'Register new user',
  description: 'Create a new user account within an organization',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterRequestSchema,
          example: {
            organizationId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'newuser@example.com',
            password: 'SecurePass123!@#',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+1234567890',
            department: 'IT',
            jobTitle: 'Developer',
            employmentType: 'FULL_TIME',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(UserResponseSchema, 'User registered successfully', StatusCodes.CREATED),
    ...createApiResponse(z.null(), 'Email already exists', StatusCodes.CONFLICT),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// POST /api/v1/auth/logout - Logout user
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Authentication'],
  summary: 'Logout user',
  description: 'Invalidate the current refresh token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LogoutRequestSchema,
          example: {
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(MessageResponseSchema, 'Logged out successfully', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Invalid token', StatusCodes.UNAUTHORIZED),
  },
});

// POST /api/v1/auth/logout-all - Logout from all devices
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout-all',
  tags: ['Authentication'],
  summary: 'Logout from all devices',
  description: 'Invalidate all refresh tokens for the authenticated user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LogoutRequestSchema,
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      MessageResponseSchema,
      'Logged out from all devices successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Unauthorized', StatusCodes.UNAUTHORIZED),
  },
});

// POST /api/v1/auth/refresh - Refresh access token
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Get a new access token using a valid refresh token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenRequestSchema,
          example: {
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            deviceFingerprint: 'device123',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      RefreshTokenResponseSchema,
      'Token refreshed successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Invalid or expired token', StatusCodes.UNAUTHORIZED),
  },
});

// POST /api/v1/auth/change-password - Change password
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/change-password',
  tags: ['Authentication'],
  summary: 'Change password',
  description: 'Change password for the authenticated user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChangePasswordRequestSchema,
          example: {
            currentPassword: 'OldPassword123!',
            newPassword: 'NewSecurePass123!@#',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(MessageResponseSchema, 'Password changed successfully', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Current password is incorrect', StatusCodes.UNAUTHORIZED),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// POST /api/v1/auth/forgot-password - Request password reset
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/forgot-password',
  tags: ['Authentication'],
  summary: 'Request password reset',
  description: 'Send a password reset email to the user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordRequestSchema,
          example: {
            email: 'user@example.com',
            organizationCode: 'ORG001',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(
      MessageResponseSchema,
      'If the email exists, a reset link has been sent',
      StatusCodes.OK
    ),
  },
});

// POST /api/v1/auth/reset-password - Reset password
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/reset-password',
  tags: ['Authentication'],
  summary: 'Reset password',
  description: 'Reset password using the token from email',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordRequestSchema,
          example: {
            token: 'reset-token-from-email',
            newPassword: 'NewSecurePass123!@#',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(MessageResponseSchema, 'Password reset successfully', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Invalid or expired token', StatusCodes.BAD_REQUEST),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.BAD_REQUEST),
  },
});

// POST /api/v1/auth/mfa/set-up - Setup MFA
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/mfa/set-up',
  tags: ['Multi-Factor Authentication'],
  summary: 'Setup MFA',
  description: 'Initialize MFA setup for the authenticated user. Returns QR code and secret.',
  responses: {
    ...createApiResponse(
      MfaSetupResponseSchema,
      'MFA setup initiated successfully',
      StatusCodes.OK
    ),
    ...createApiResponse(z.null(), 'Unauthorized', StatusCodes.UNAUTHORIZED),
  },
});

// POST /api/v1/auth/mfa/verify - Verify and enable MFA
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/mfa/verify',
  tags: ['Multi-Factor Authentication'],
  summary: 'Verify and enable MFA',
  description: 'Verify the MFA code and enable MFA for the user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: VerifyMfaRequestSchema,
          example: {
            code: '123456',
            tempToken: 'temp-mfa-token',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(MessageResponseSchema, 'MFA enabled successfully', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Invalid MFA code', StatusCodes.BAD_REQUEST),
    ...createApiResponse(z.null(), 'Unauthorized', StatusCodes.UNAUTHORIZED),
  },
});

// POST /api/v1/auth/mfa/disable - Disable MFA
authRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/mfa/disable',
  tags: ['Multi-Factor Authentication'],
  summary: 'Disable MFA',
  description: 'Disable MFA for the authenticated user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: DisableMfaRequestSchema,
          example: {
            password: 'YourCurrentPassword123!',
          },
        },
      },
    },
  },
  responses: {
    ...createApiResponse(MessageResponseSchema, 'MFA disabled successfully', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Invalid password', StatusCodes.UNAUTHORIZED),
  },
});

// GET /api/v1/auth/me - Get current user
authRegistry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Authentication'],
  summary: 'Get current user',
  description: 'Retrieve the authenticated user information',
  responses: {
    ...createApiResponse(CurrentUserResponseSchema, 'Current user retrieved', StatusCodes.OK),
    ...createApiResponse(z.null(), 'Unauthorized', StatusCodes.UNAUTHORIZED),
  },
});
