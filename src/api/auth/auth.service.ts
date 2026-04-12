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

  /**
   * Creates an authentication service with repository and organization dependencies.
   *
   * @param authRepo - Repository used for user and token persistence.
   * @param orgService - Service used for organization validation and limits.
   */
  constructor(
    authRepo: AuthRepository = authRepository,
    orgService: OrganizationService = organizationService
  ) {
    this.authRepo = authRepo;
    this.orgService = orgService;
  }

  /**
   * Authenticates a user and returns either MFA challenge metadata or active tokens.
   *
   * The flow validates organization access, loads the user by normalized email,
   * enforces account state and lockout checks, verifies password, optionally
   * verifies TOTP MFA, then issues access/refresh tokens and records successful
   * login metadata.
   *
   * @param input - Login payload including organization code, credentials, and optional MFA data.
   * @param ipAddress - Optional client IP for session tracking.
   * @param userAgent - Optional client user-agent string for refresh-token metadata.
   * @returns Logged-in user with token pair, or MFA challenge fields when MFA code is still required.
   * @throws {UnauthorizedError} Thrown for invalid organization, credentials, token format, or MFA code.
   * @throws {ForbiddenError} Thrown for inactive organization subscription or blocked account states.
   * @throws {InternalServerError} Thrown when MFA is enabled but required secret is missing.
   */
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

  /**
   * Registers a new user under an existing organization.
   *
   * Validates organization existence, checks user-limit capacity, enforces
   * organization-scoped email uniqueness, hashes the provided password, and
   * persists a new user in `'PENDING_VERIFICATION'` state.
   *
   * @param input - Registration payload.
   * @returns Newly created user entity.
   * @throws {ForbiddenError} Thrown when organization user limits are exceeded.
   * @throws {ConflictError} Thrown when email already exists in the organization.
   */
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
  /**
   * Rotates a refresh token and returns a new access/refresh token pair.
   *
   * The method parses the composite refresh token, validates the JWT segment,
   * verifies token type, checks persisted token hash state, optionally enforces
   * device-fingerprint binding, reloads user and organization context, issues a
   * fresh token pair, and revokes the previously used token record.
   *
   * @param refreshToken - Composite token in `<refresh-jwt>.<opaque-secret>` format.
   * @param deviceFingerprint - Optional fingerprint to enforce token-device binding.
   * @returns Newly issued access and refresh tokens.
   * @throws {UnauthorizedError} Thrown for malformed, invalid, missing, expired, or mismatched refresh tokens.
   */
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

  /**
   * Revokes a refresh token when it can be resolved from the provided composite token.
   *
   * @param refreshToken - Composite token in `<refresh-jwt>.<opaque-secret>` format.
   * @returns Resolves after best-effort revocation; no error is thrown for unknown tokens.
   */
  async logout(refreshToken: string): Promise<void> {
    const [, opaquePart] = refreshToken.split('.');
    if (!opaquePart) return;

    const tokenHash = hashToken(opaquePart);
    const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

    if (storedToken) {
      await this.authRepo.revokeRefreshToken(storedToken.id);
    }
  }

  /**
   * Revokes all refresh tokens for a user, optionally preserving one current token.
   *
   * @param userId - User UUID whose sessions should be invalidated.
   * @param exceptCurrentToken - Optional composite token to exclude from revocation.
   * @returns Resolves when revocation completes.
   */
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

  /**
   * Changes a user's password after validating the current password.
   *
   * @param userId - User UUID requesting password change.
   * @param input - Current and new password payload.
   * @returns Resolves when password update completes.
   * @throws {NotFoundError} Thrown when the user cannot be found.
   * @throws {UnauthorizedError} Thrown when the current password is incorrect.
   */
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

  /**
   * Creates and stores a password-reset token for a known organization/email pair.
   *
   * The method intentionally returns without error for unknown organizations or
   * users to avoid account-enumeration leaks.
   *
   * @param email - Email address requesting reset.
   * @param organizationCode - Organization code that scopes the user lookup.
   * @returns Resolves after best-effort reset-token creation.
   */
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

  /**
   * Resets a user's password using a valid password-reset token.
   *
   * Hashes the incoming token for lookup, verifies token validity/expiry,
   * updates password hash, and revokes all active refresh tokens to terminate
   * existing sessions.
   *
   * @param input - Reset token and replacement password payload.
   * @returns Resolves when password reset completes.
   * @throws {NotFoundError} Thrown when the reset token is invalid or expired.
   */
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

  /**
   * Generates MFA setup materials for a user without enabling MFA yet.
   *
   * Produces a TOTP secret, QR code data URL, and backup codes. Persistence is
   * deferred until `verifyAndEnableMfa` confirms a valid MFA code.
   *
   * @param userId - User UUID.
   * @returns MFA setup payload containing secret, QR code URL, and backup codes.
   * @throws {NotFoundError} Thrown when the user is missing.
   * @throws {ConflictError} Thrown when MFA is already enabled.
   * @throws {InternalServerError} Thrown when secret generation fails.
   */
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

  /**
   * Verifies a TOTP code and permanently enables MFA for the user.
   *
   * @param userId - User UUID.
   * @param code - Current TOTP code from the authenticator app.
   * @param secret - Base32 MFA secret generated during setup.
   * @returns Resolves when MFA is enabled and backup codes are stored.
   * @throws {UnauthorizedError} Thrown when the provided TOTP code is invalid.
   */
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

  /**
   * Disables MFA after password re-verification.
   *
   * @param userId - User UUID.
   * @param password - User password used to authorize MFA disable action.
   * @returns Resolves when MFA credentials are cleared.
   * @throws {NotFoundError} Thrown when the user cannot be found.
   * @throws {UnauthorizedError} Thrown when password verification fails.
   */
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

  /**
   * Returns the authenticated user's detailed profile with role context.
   *
   * @param userId - User UUID.
   * @returns Detailed user payload for current-session endpoints.
   * @throws {NotFoundError} Thrown when the user cannot be found.
   */
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

  /**
   * Increments failed-login attempts and applies temporary lockout after threshold.
   *
   * @param user - User entity containing current failed-attempt counters.
   * @returns Resolves when lockout state is persisted.
   */
  private async handleFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= 5
        ? new Date(Date.now() + 30 * 60000) // 30 min lock
        : undefined;

    await this.authRepo.updateLoginAttempts(user.id, attempts, lockedUntil);
  }

  /**
   * Creates a short-lived JWT used to continue MFA challenge flow.
   *
   * @param userId - User UUID.
   * @param orgId - Organization UUID to embed in MFA context.
   * @returns Signed JWT valid for five minutes.
   */
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

  /**
   * Maps an internal user entity to the public login response shape.
   *
   * @param user - Internal user entity.
   * @returns Public user projection safe for authentication responses.
   */
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

  /**
   * Generates and persists an access/refresh token pair for a user session.
   *
   * Creates a session identifier, fetches effective permissions, signs a
   * short-lived access token, creates and stores a hashed opaque refresh secret,
   * signs refresh JWT metadata, and returns the composite refresh token value.
   *
   * @param user - Authenticated user.
   * @param orgId - Organization UUID to embed in token claims.
   * @param orgCode - Organization code included in access token claims.
   * @param orgTier - Organization tier included in access token claims.
   * @param ipAddress - Optional client IP persisted with refresh token metadata.
   * @param userAgent - Optional client user-agent persisted with refresh token metadata.
   * @param deviceFingerprint - Optional device fingerprint for theft detection.
   * @param deviceName - Optional human-readable device label.
   * @returns Access token, composite refresh token, and access expiry seconds.
   * @remarks Complexity: O(p) in permission count, with one permission read and one token write.
   */
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

  /**
   * Maps a user-with-roles entity into the detailed current-user response.
   *
   * @param user - User entity including role and hotel assignments.
   * @returns Detailed user DTO used by profile endpoints.
   */
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
