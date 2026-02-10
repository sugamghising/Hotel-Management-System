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
  UserIdParamSchema,
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

// API-specific DTOs
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    mfaEnabled: boolean;
    organizationId: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles?: Array<{
    id: string;
    roleCode: string;
    roleName: string;
    hotelId?: string;
    hotelName?: string;
  }>;
}
