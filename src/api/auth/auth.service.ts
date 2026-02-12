import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { config } from '../../config';
import { ConflictError, UnauthorizedError, logger } from '../../core';
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
  MfaTempPayload,
  RefreshTokenPayload,
  RegisterInput,
  TokenPair,
  User,
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
      throw new UnauthorizedError('Organization subscription is not active');
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
      throw new UnauthorizedError('Account is suspended');
    }

    if (user.status === 'INACTIVE') {
      logger.warn(
        `Login attempt for inactive account: ${input.email} in organization: ${input.organizationCode}`
      );
      throw new UnauthorizedError('Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn(
        `Login attempt for locked account: ${input.email} in organization: ${input.organizationCode}. Locked until: ${user.lockedUntil.toISOString()}`
      );
      throw new UnauthorizedError(`Account is locked until ${user.lockedUntil.toISOString()}`);
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
        throw new UnauthorizedError('MFA secret not configured');
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
      throw new UnauthorizedError('Organization user limit reached. Please contact support.');
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
}

export const authService = new AuthService();
