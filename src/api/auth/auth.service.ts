import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { config } from '../../config';
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  logger,
} from '../../core';
import {
  generateRandomToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../core/utils/crypto';
import { type OrganizationService, organizationService } from '../organizations';
import { type AuthRepository, authRepository } from './auth.repository';
import type { LoginInput } from './auth.schema';
import type {
  AccessTokenPayload,
  ChangePasswordInput,
  DetailedUser,
  MfaSetupResult,
  MfaTempPayload,
  PasswordResetInput,
  RefreshTokenPayload,
  RegisterInput,
  TokenPair,
  User,
  UserWithRoles,
} from './auth.types';

export class AuthService {
  private authRepo: AuthRepository;
  private orgService: OrganizationService;

  constructor(
    authRepo: AuthRepository = authRepository,
    orgService: OrganizationService = organizationService
  ) {
    this.authRepo = authRepo;
    this.orgService = orgService;
  }

  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    //Find Organizations
    const org = await this.orgService.findByCode(input.organizationCode);
    if (!org || org.deletedAt) {
      logger.warn(`Login attempt with invalid organization code: ${input.organizationCode}`);
      throw new UnauthorizedError('Organization not found');
    }

    if (org.subscriptionStatus !== 'ACTIVE') {
      logger.warn(`Login attempt with inactive subscription: ${input.organizationCode}`);
      throw new ForbiddenError('Organization subscription is not active');
    }

    //Find user
    const user = await this.authRepo.findUserByEmail(input.email, org.id);
    if (!user) {
      logger.warn(
        `Login attempt with invalid email: ${input.email} for organization: ${input.organizationCode}`
      );
      await hashPassword('dummy'); // Dummy hash to mitigate timing attacks
      throw new UnauthorizedError('Invalid Credentials.');
    }

    // 3. Check account status
    if (user.status === 'SUSPENDED') {
      logger.warn(
        `Login attempt for suspended account: ${input.email} in organization: ${input.organizationCode}`
      );
      throw new ForbiddenError('Account is suspended');
    }

    if (user.status === 'INACTIVE') {
      logger.warn(
        `Login attempt for inactive account: ${input.email} in organization: ${input.organizationCode}`
      );
      throw new ForbiddenError('Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn(
        `Login attempt for locked account: ${input.email} in organization: ${input.organizationCode}. Locked until: ${user.lockedUntil.toISOString()}`
      );
      throw new ForbiddenError(`Account is locked until ${user.lockedUntil.toISOString()}`);
    }

    // 4. Verify password
    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      logger.warn(
        `Invalid password attempt for email: ${input.email} in organization: ${input.organizationCode}`
      );
      await this.handleFailedLogin(user);
      throw new UnauthorizedError('Invalid credentials');
    }

    // 5. Check MFA
    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        return {
          user: this.mapToPublicUser(user),
          mfaRequired: true,
          mfaToken: this.generateMfaTempToken(user.id, org.id),
        };
      }

      if (!user.mfaSecret) {
        logger.error(`MFA enabled but secret not configured for user: ${user.id}`);
        throw new InternalServerError('MFA secret not configured');
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: input.mfaCode,
        window: 1,
      });

      if (!verified) {
        logger.warn(
          `Invalid MFA code attempt for email: ${input.email} in organization: ${input.organizationCode}`
        );
        throw new UnauthorizedError('Invalid MFA code');
      }
    }

    // 6. Success - generate tokens
    const tokens = await this.generateTokenPair(
      user,
      org.id,
      org.code,
      org.subscriptionTier,
      ipAddress,
      userAgent,
      input.deviceFingerprint,
      input.deviceName
    );

    await this.authRepo.recordSuccessfulLogin(user.id, ipAddress);

    logger.info(`User logged in: ${user.email}`, { userId: user.id, orgId: org.id });

    return {
      user: this.mapToPublicUser(user),
      tokens,
    };
  }

  async register(input: RegisterInput): Promise<User> {
    //Validate organization existence
    const org = await this.orgService.findById(input.organizationId);

    const limitCheck = await this.orgService.validateLimits(org.id, 'user');
    if (!limitCheck.valid) {
      logger.warn(
        `Registration attempt failed due to organization limits: ${input.organizationId}`
      );
      throw new ForbiddenError('Organization user limit reached. Please contact support.');
    }

    //check email uniqueness
    const existing = await this.authRepo.findUserByEmail(input.email, org.id);
    if (existing) {
      logger.warn(`Email already exists in the organiation: ${input.email}`);
      throw new ConflictError('Email already Exists.');
    }

    //Hash Password
    const passwordHash = await hashPassword(input.password);

    //Create User
    const user = await this.authRepo.createUser({
      organization: { connect: { id: org.id } },
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName || null,
      phone: input.phone || null,
      employeeId: input.employeeId || null,
      department: input.department || null,
      jobTitle: input.jobTitle || null,
      employmentType: input.employmentType || null,
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      phoneVerified: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordChangedAt: new Date(),
      languageCode: 'en',
      timezone: 'UTC',
      preferences: {},
      isSuperAdmin: false,
      version: 1,
    });

    //TODO: SEND VERIFICATION MAIL
    logger.info(`User registered: ${user.email}`, { userId: user.id, orgId: input.organizationId });

    return user;
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================
  async refreshToken(refreshToken: string, deviceFingerprint?: string): Promise<TokenPair> {
    //split composite token
    const [jwtPart, opaquePart] = refreshToken.split('.');
    if (!jwtPart || !opaquePart) {
      logger.warn('Invalid refresh token format.');
      throw new UnauthorizedError('Invalid refresh token format.');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(jwtPart, config.jwt.refreshSecret) as RefreshTokenPayload;
    } catch (error) {
      logger.warn('Invalid refresh token JWT', { error });
      throw new UnauthorizedError('Invalid Refresh token');
    }

    if (payload.type !== 'refresh') {
      logger.warn(`Invalid token type: ${payload.type}`);
      throw new UnauthorizedError('Invalid token type');
    }

    //find in database
    const tokenHash = hashToken(opaquePart);
    const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      logger.warn('Refresh token not found in database', { userId: payload.sub });
      throw new UnauthorizedError('Refresh Token not found or Expired.');
    }

    // Security: Check device fingerprint if provided
    if (deviceFingerprint && storedToken.deviceFingerprint !== deviceFingerprint) {
      // Potential token theft - revoke all tokens
      logger.error(`Security violation: Device fingerprint mismatch for user ${payload.sub}`);
      await this.authRepo.revokeAllUserTokens(payload.sub);
      throw new UnauthorizedError('Security violation detected. Please login again.');
    }

    // Get user and org
    const user = await this.authRepo.findUserById(payload.sub);
    if (!user || user.deletedAt) {
      logger.warn(`User not found or deleted during token refresh: ${payload.sub}`);
      throw new UnauthorizedError('User not found');
    }

    // Generate new pair
    const org = await this.orgService.findById(payload.orgId);
    if (!org) {
      logger.warn(`Organization not found during token refresh: ${payload.orgId}`);
      throw new UnauthorizedError('Organization not found');
    }

    const tokens = await this.generateTokenPair(
      user,
      org.id,
      org.code,
      org.subscriptionTier,
      undefined,
      undefined,
      deviceFingerprint
    );

    // Revoke old token
    await this.authRepo.revokeRefreshToken(storedToken.id);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const [, opaquePart] = refreshToken.split('.');
    if (!opaquePart) return;

    const tokenHash = hashToken(opaquePart);
    const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

    if (storedToken) {
      await this.authRepo.revokeRefreshToken(storedToken.id);
    }
  }

  async logoutAll(userId: string, exceptCurrentToken?: string): Promise<void> {
    let exceptId: string | undefined;

    if (exceptCurrentToken) {
      const [, opaquePart] = exceptCurrentToken.split('.');
      if (opaquePart) {
        const tokenHash = hashToken(opaquePart);
        const stored = await this.authRepo.findRefreshTokenByHash(tokenHash);
        exceptId = stored?.id;
      }
    }

    await this.authRepo.revokeAllUserTokens(userId, exceptId);
  }

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.authRepo.findUserById(userId);

    if (!user) {
      logger.error(`User not found when changing password: ${userId}`);
      throw new NotFoundError('User Not Found');
    }

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      logger.warn(`Incorrect current password attempt for user: ${userId}`);
      throw new UnauthorizedError('Current Password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);
    await this.authRepo.updatePassword(userId, newHash);

    // Revoke all tokens except current session (optional security measure)
    // await this.authRepo.revokeAllUserTokens(userId);
  }

  async forgotPassword(email: string, organizationCode: string): Promise<void> {
    const org = await this.orgService.findByCode(organizationCode);
    if (!org) {
      //DO NOT reveal org doesn't exist
      return;
    }

    const user = await this.authRepo.findUserByEmail(email, org.id);
    if (!user) {
      //DO NOT reveal user doesn't exists
      return;
    }

    //Genereate Reset token
    const resetToken = generateRandomToken(32);
    const resetHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.authRepo.setPasswordResetToken(user.id, resetHash, expiresAt);
    // TODO: Send email with resetToken

    logger.info(`Password reset requested: ${user.email}`, { userId: user.id });
  }

  async resetPassword(input: PasswordResetInput): Promise<void> {
    const tokenHash = hashToken(input.token);

    //Find user with valid token
    const user = await this.authRepo.findUserByResetToken(tokenHash);
    if (!user) {
      logger.warn('Invalid or expired password reset token');
      throw new NotFoundError('User not Found');
    }

    const newHash = await hashPassword(input.newPassword);
    await this.authRepo.updatePassword(user.id, newHash);

    await this.authRepo.revokeAllUserTokens(user.id);

    logger.info(`Password reset completed: ${user.email}`, { userId: user.id });
  }

  // ============================================================================
  // MFA
  // ============================================================================

  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      logger.error(`User not found when setting up MFA: ${userId}`);
      throw new NotFoundError('User not Found.');
    }

    if (user.mfaEnabled) {
      logger.warn(`MFA setup attempted for user with MFA already enabled: ${userId}`);
      throw new ConflictError('MFA is already enabled.');
    }

    const secret = speakeasy.generateSecret({
      length: 32,
      name: `HMS:${user.email}`,
    });

    if (!secret.otpauth_url) {
      logger.error(`Failed to generate MFA secret for user: ${userId}`);
      throw new InternalServerError('Failed to generate MFA secret');
    }

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    const backupCodes = Array.from({ length: 10 }, () => generateRandomToken(4).toUpperCase());

    // Store secret temporarily (verify first before enabling)
    // In production: store in temporary cache or separate field

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  async verifyAndEnableMfa(userId: string, code: string, secret: string): Promise<void> {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      logger.warn(`Invalid MFA code during verification for user: ${userId}`);
      throw new UnauthorizedError('Invalid MFA code');
    }

    const backupCodes = Array.from({ length: 10 }, () => generateRandomToken(4).toUpperCase());

    await this.authRepo.enableMfa(userId, secret, backupCodes);
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      logger.error(`User not found when disabling MFA: ${userId}`);
      throw new NotFoundError('User');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logger.warn(`Incorrect password when disabling MFA for user: ${userId}`);
      throw new UnauthorizedError('Password is incorrect');
    }

    await this.authRepo.disableMfa(userId);
  }

  // ============================================================================
  // CURRENT USER
  // ============================================================================

  async getCurrentUser(userId: string): Promise<DetailedUser> {
    const user = await this.authRepo.findUserWithRoles(userId);
    if (!user) {
      logger.error(`User not found when getting current user: ${userId}`);
      throw new NotFoundError('User');
    }

    return this.mapToDetailedUser(user);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async handleFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= 5
        ? new Date(Date.now() + 30 * 60000) // 30 min lock
        : undefined;

    await this.authRepo.updateLoginAttempts(user.id, attempts, lockedUntil);
  }

  private generateMfaTempToken(userId: string, orgId: string): string {
    const payload: MfaTempPayload = {
      sub: userId,
      type: 'mfa_pending',
      orgId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // 5 min
      attempt: 0,
    };

    return jwt.sign(payload, config.jwt.accessSecret);
  }

  private mapToPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    };
  }

  private async generateTokenPair(
    user: User,
    orgId: string,
    orgCode: string,
    orgTier: string,
    ipAddress?: string,
    userAgent?: string,
    deviceFingerprint?: string,
    deviceName?: string
  ): Promise<TokenPair> {
    const sessionId = `sess_${generateRandomToken(16)}`;

    // Get permissions
    const permissions = await this.authRepo.getUserPermissions(user.id);

    // Access token (15 min)
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      iss: 'hms-api',
      aud: 'hms-client',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      jti: `tok_${generateRandomToken(16)}`,
      org: {
        id: orgId,
        code: orgCode,
        tier: orgTier,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        isSuperAdmin: user.isSuperAdmin,
      },
      session: {
        id: sessionId,
        type: 'access',
        mfaVerified: user.mfaEnabled, // If MFA enabled and passed
        permissions,
      },
    };

    const accessToken = jwt.sign(accessPayload, config.jwt.accessSecret);

    // Refresh token (7 days)
    const refreshTokenId = generateRandomToken(16);
    const refreshTokenValue = generateRandomToken(32);
    const refreshTokenHash = hashToken(refreshTokenValue);

    await this.authRepo.createRefreshToken({
      id: refreshTokenId,
      user: {
        connect: { id: user.id },
      },
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceFingerprint: deviceFingerprint || null,
      deviceName: deviceName || null,
      metadata: {},
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      iss: 'hms-api',
      aud: 'hms-client',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      jti: refreshTokenId,
      type: 'refresh',
      orgId,
      sessionId,
      ...(deviceFingerprint && { deviceFingerprint }),
    };

    const refreshJwt = jwt.sign(refreshPayload, config.jwt.refreshSecret);

    return {
      accessToken,
      refreshToken: `${refreshJwt}.${refreshTokenValue}`,
      expiresIn: 900,
    };
  }

  private mapToDetailedUser(user: UserWithRoles): DetailedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      status: user.status,
      emailVerified: user.emailVerified,
      phone: user.phone,
      department: user.department,
      jobTitle: user.jobTitle,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles?.map((ur) => ({
        id: ur.id,
        roleCode: ur.role.code,
        roleName: ur.role.name,
        hotelId: ur.hotelId,
        hotelName: ur.hotel?.name,
      })),
    };
  }
}

export const authService = new AuthService();
