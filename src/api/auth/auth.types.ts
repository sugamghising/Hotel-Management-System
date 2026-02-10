import type { Prisma } from '../../generated/prisma';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'SEASONAL';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;

  //profile
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string;
  avatarUrl: string | null;
  dateOfBirth: Date | null;
  gender: string | null;

  //Employment
  employeeId: string | null;
  employmentType: EmploymentType | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: Date | null;
  terminationDate: Date | null;
  managerId: string | null;

  //Security
  passwordHash: string;
  passwordChangedAt: Date | null;
  passwordResetToken: string | null;
  passwordResetTokenExpires: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;

  // MFA
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodes: string[] | null;

  // Super admin flag (system-wide)
  isSuperAdmin: boolean;

  // Preferences
  languageCode: string;
  timezone: string;
  preferences: Record<string, unknown>;

  // Status
  status: UserStatus;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
  deviceName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================================================
// PRISMA EXTENSIONS
// ============================================================================

export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true;
              };
            };
          };
        };
        hotel: true;
      };
    };
  };
}>;

export type UserWithOrganization = Prisma.UserGetPayload<{
  include: {
    organization: true;
  };
}>;

// ============================================================================
// AUTH PAYLOADS (JWT)
// ============================================================================

export interface AccessTokenPayload {
  // Standard JWT claims
  sub: string; // User ID
  iss: string; // 'hms-api'
  aud: string; // 'hms-client'
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // Token ID

  // HMS specific
  org: {
    id: string;
    code: string;
    tier: string;
  };

  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    isSuperAdmin: boolean;
  };

  session: {
    id: string;
    type: 'access';
    mfaVerified: boolean;
    permissions: string[];
  };

  hotel?: {
    id: string;
    role: string;
  };
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  type: 'refresh';
  orgId: string;
  sessionId: string;
  deviceFingerprint?: string;
}

export interface MfaTempPayload {
  sub: string;
  type: 'mfa_pending';
  orgId: string;
  iat: number;
  exp: number;
  attempt: number;
}

// ============================================================================
// SERVICE INPUTS/OUTPUTS
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
  organizationCode: string;
  mfaCode?: string;
  deviceFingerprint?: string;
  deviceName?: string;
}

export interface RegisterInput {
  organizationId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
  employmentType?: EmploymentType;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    mfaEnabled: boolean;
  };
  tokens?: TokenPair;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface PasswordResetInput {
  token: string;
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

// ============================================================================
// SESSION/CONTEXT
// ============================================================================

export interface AuthContext {
  userId: string;
  organizationId: string;
  permissions: string[];
  sessionId: string;
  mfaVerified: boolean;
  hotelId?: string;
  hotelRole?: string;
}
