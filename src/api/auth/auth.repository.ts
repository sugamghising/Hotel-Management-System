import { prisma } from '../../database/prisma';
import { Prisma, type RefreshToken, type UserStatus } from '../../generated/prisma';
import type { User } from './auth.types';

export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;
export type { UserStatus };

export class AuthRepository {
  // ============================================================================
  // USER OPERATIONS
  // ============================================================================
  async findUserById(userId: string, include?: Prisma.UserInclude): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      ...(include && { include }),
    }) as Promise<User | null>;
  }

  async findUserByEmail(email: string, organizationId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId,
        deletedAt: null,
      },
    }) as Promise<User | null>;
  }

  async findUserWithRoles(userId: string): Promise<User | null> {
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
    }) as Promise<User | null>;
  }

  async createUser(data: UserCreateInput): Promise<User> {
    return prisma.user.create({
      data,
    }) as unknown as Promise<User>;
  }

  async updateUser(userId: string, data: UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    }) as unknown as Promise<User>;
  }

  async updateLoginAttempts(userId: string, attempts: number, lockedUntil?: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: lockedUntil || null,
      },
    });
  }

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

  async setPasswordResetToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });
  }

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

  async createRefreshToken(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data,
    }) as Promise<RefreshToken>;
  }

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

  async revokeRefreshToken(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

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
