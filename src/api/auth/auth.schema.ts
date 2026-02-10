import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const EmailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const PhoneSchema = z
  .string()
  .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
  .max(50)
  .optional();

export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .trim();

export const OrganizationCodeSchema = z.string().min(1, 'Organization code is required').trim();

export const MfaCodeSchema = z
  .string()
  .length(6, 'MFA code must be 6 digits')
  .regex(/^\d+$/, 'MFA code must contain only digits');

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  organizationCode: OrganizationCodeSchema,
  mfaCode: MfaCodeSchema.optional(),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().max(100).optional(),
});

export const RegisterSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  middleName: NameSchema.optional(),
  phone: PhoneSchema,
  employeeId: z.string().max(50).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']).optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  deviceFingerprint: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
  organizationCode: OrganizationCodeSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: PasswordSchema,
});

export const SetupMfaSchema = z.object({
  method: z.enum(['TOTP', 'SMS']).default('TOTP'),
  phoneNumber: z.string().optional(), // Required if SMS
});

export const VerifyMfaSchema = z.object({
  code: MfaCodeSchema,
  tempToken: z.string().optional(), // For initial setup verification
});

// ============================================================================
// USER SCHEMAS (for user management)
// ============================================================================

export const UpdateUserSchema = z.object({
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  middleName: z.string().max(100).optional(),
  phone: PhoneSchema,
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']).optional(),
  languageCode: z.string().length(2).optional(),
  timezone: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const UserQuerySchema = z.object({
  page: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v ? Number(v) : 1)),
  limit: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v ? Number(v) : 10)),
  search: z.string().optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  department: z.string().optional(),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const UserIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type SetupMfaInput = z.infer<typeof SetupMfaSchema>;
export type VerifyMfaInput = z.infer<typeof VerifyMfaSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserQueryInput = z.infer<typeof UserQuerySchema>;
