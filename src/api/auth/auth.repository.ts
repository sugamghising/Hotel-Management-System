import { prisma } from '../../database/prisma';
import { Prisma, type RefreshToken, type UserStatus } from '../../generated/prisma';
import type { User, UserWithRoles } from '../auth/auth.types';

export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;
export type { UserStatus };

export class AuthRepository {
  // ============================================================================
  // USER OPERATIONS
  // ============================================================================
  /**
   * Retrieves a user by identifier with optional relations.
   *
   * @param userId - User UUID.
   * @param include - Optional Prisma include graph.
   * @returns Matching user, or `null` when no row exists.
   */
  async findUserById(userId: string, include?: Prisma.UserInclude): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      ...(include && { include }),
    }) as Promise<User | null>;
  }

  /**
   * Retrieves an active user by email within an organization scope.
   *
   * @param email - User email address; normalized to lowercase before querying.
   * @param organizationId - Organization UUID that owns the user.
   * @returns Matching non-deleted user, or `null`.
   */
  async findUserByEmail(email: string, organizationId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId,
        deletedAt: null,
      },
    }) as Promise<User | null>;
  }

  /**
   * Loads a user with non-expired role assignments and permission relations.
   *
   * @param userId - User UUID.
   * @returns User plus role/permission graph, or `null` when not found.
   */
  async findUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          where: { expiresAt: null },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
            hotel: true,
          },
        },
      },
    }) as Promise<UserWithRoles | null>;
  }

  /**
   * Creates a user record.
   *
   * @param data - Prisma create payload for the user.
   * @returns Newly created user.
   */
  async createUser(data: UserCreateInput): Promise<User> {
    return prisma.user.create({
      data,
    }) as unknown as Promise<User>;
  }

  /**
   * Updates a user by identifier.
   *
   * @param userId - User UUID to update.
   * @param data - Partial user update payload.
   * @returns Updated user.
   */
  async updateUser(userId: string, data: UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    }) as unknown as Promise<User>;
  }

  /**
   * Persists failed-login attempt counters and optional lock expiration.
   *
   * @param userId - User UUID to update.
   * @param attempts - Current number of failed attempts.
   * @param lockedUntil - Optional account lock expiration timestamp.
   * @returns Resolves when the update completes.
   */
  async updateLoginAttempts(userId: string, attempts: number, lockedUntil?: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: lockedUntil || null,
      },
    });
  }

  /**
   * Records successful login metadata and clears lockout counters.
   *
   * @param userId - User UUID to update.
   * @param ipAddress - Optional IP address captured during login.
   * @returns Resolves when the update completes.
   */
  async recordSuccessfulLogin(userId: string, ipAddress?: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress || null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * Stores a password-reset token hash and expiration for a user.
   *
   * @param id - User UUID.
   * @param tokenHash - Hashed reset token value.
   * @param expiresAt - Token expiration timestamp.
   * @returns Resolves when the update completes.
   */
  async setPasswordResetToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });
  }

  /**
   * Updates password hash and clears password-reset/lockout state.
   *
   * @param userId - User UUID.
   * @param passwordHash - Newly hashed password.
   * @returns Resolves when the update completes.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * Enables MFA and stores secret plus backup codes.
   *
   * @param userId - User UUID.
   * @param secret - Base32 MFA secret.
   * @param backupCodes - One-time backup code list.
   * @returns Resolves when the update completes.
   */
  async enableMfa(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: secret,
        mfaBackupCodes: backupCodes,
      },
    });
  }

  /**
   * Disables MFA and clears stored MFA credentials.
   *
   * @param id - User UUID.
   * @returns Resolves when the update completes.
   */
  async disableMfa(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: Prisma.DbNull,
      },
    });
  }

  /**
   * Soft-deletes a user and anonymizes email to keep uniqueness intact.
   *
   * @param id - User UUID to soft-delete.
   * @returns Resolves when the update completes.
   */
  async softDeleteUser(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        email: `deleted_${id}_${Date.now()}@deleted.com`, // Preserve email uniqueness
      },
    });
  }

  // ============================================================================
  // REFRESH TOKEN OPERATIONS
  // ============================================================================

  /**
   * Creates a refresh-token persistence record.
   *
   * @param data - Prisma create payload for refresh token storage.
   * @returns Created refresh-token row.
   */
  async createRefreshToken(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data,
    }) as Promise<RefreshToken>;
  }

  /**
   * Retrieves an active, non-expired refresh token by hashed value.
   *
   * @param tokenHash - Hashed opaque refresh token component.
   * @returns Matching refresh token, or `null` when revoked/expired/missing.
   */
  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    }) as Promise<RefreshToken | null>;
  }

  /**
   * Revokes a refresh token by setting `revokedAt`.
   *
   * @param id - Refresh-token UUID.
   * @returns Resolves when revocation is persisted.
   */
  async revokeRefreshToken(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes all active refresh tokens for a user, optionally excluding one token.
   *
   * @param userId - User UUID whose tokens should be revoked.
   * @param exceptId - Optional refresh-token UUID to keep active.
   * @returns Resolves when bulk revocation completes.
   */
  async revokeAllUserTokens(userId: string, exceptId?: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptId && { id: { not: exceptId } }),
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Atomically revokes one refresh token and creates its replacement.
   *
   * Runs both operations inside a Prisma transaction so token rotation cannot
   * leave both old and new tokens active when partial failures occur.
   *
   * @param oldId - Existing refresh-token UUID to revoke.
   * @param newData - Create payload for the replacement token.
   * @returns Newly created refresh-token row.
   * @remarks Complexity: O(1) database work across two writes in one transaction.
   */
  async replaceRefreshToken(
    oldId: string,
    newData: Prisma.RefreshTokenCreateInput
  ): Promise<RefreshToken> {
    return prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { revokedAt: new Date() },
      });
      return tx.refreshToken.create({ data: newData }) as Promise<RefreshToken>;
    });
  }

  /**
   * Finds a non-deleted user by password-reset token hash and valid expiry.
   *
   * @param tokenHash - Hashed password reset token.
   * @returns Matching user, or `null` when token is invalid or expired.
   */
  async findUserByResetToken(tokenHash: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
        deletedAt: null,
      },
    }) as Promise<User | null>;
  }

  // ============================================================================
  // PERMISSIONS (via view or direct query)
  // ============================================================================

  /**
   * Returns distinct permission codes granted to a user.
   *
   * @param userId - User UUID.
   * @returns Permission code list from the `v_user_permissions` view.
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const result = await prisma.$queryRaw<{ permission_code: string }[]>`
      SELECT DISTINCT permission_code 
      FROM v_user_permissions 
      WHERE user_id = ${userId}::uuid
    `;
    return result.map((r) => r.permission_code);
  }

  // ============================================================================
  // COUNTERS
  // ============================================================================

  /**
   * Counts non-deleted users in an organization with optional status filter.
   *
   * @param organizationId - Organization UUID scope.
   * @param status - Optional user status filter.
   * @returns Number of users matching the criteria.
   */
  async countUsers(organizationId: string, status?: UserStatus): Promise<number> {
    return prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        ...(status && { status }),
      },
    });
  }
}

export const authRepository = new AuthRepository();
