export { AuthController } from './auth.controller';
export { AuthService, authService } from './auth.service';
export { authRepository, AuthRepository } from './auth.repository';
export { default as authRoutes } from './auth.routes';
export { authRegistry } from './auth.registry';

// Types
export type {
  User,
  UserStatus,
  RefreshToken,
  AccessTokenPayload,
  RefreshTokenPayload,
  MfaTempPayload,
  AuthContext,
  LoginResult,
  TokenPair,
  MfaSetupResult,
  UserWithRoles,
  UserWithOrganization,
} from './auth.types';

// Schemas
export {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SetupMfaSchema,
  VerifyMfaSchema,
  UpdateUserSchema,
  UserQuerySchema,
  EmailSchema,
  PasswordSchema,
  // Types
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SetupMfaInput,
  type VerifyMfaInput,
  type UpdateUserInput,
  type UserQueryInput,
} from './auth.schema';

// DTOs
export type { AuthResponse, UserResponse } from './auth.dto';
