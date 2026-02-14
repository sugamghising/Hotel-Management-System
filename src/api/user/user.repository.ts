import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type { UserCreateInput, UserUpdateInput } from '../auth/auth.repository';
import type { User, UserWithRoles } from './user.types';

export class UserRepository {
  // ============================================================================
  // USER CRUD
  // ============================================================================
  async findById(userId: string, include?: Prisma.UserInclude): Promise<User | null> {
    return (await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      ...(include && { include }),
    })) as User | null;
  }

  async findWithRoles(id: string): Promise<User | null> {
    return (await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          where: {
            expiresAt: null,
          },
          include: {
            role: true,
            hotel: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subordinates: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })) as User | null;
  }

  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    return (await prisma.user.findFirst({
      where: { email: email.toLowerCase(), organizationId, deletedAt: null },
    })) as User | null;
  }

  async findMany(params: {
    where?: Prisma.UserWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    include?: Prisma.UserInclude;
  }): Promise<UserWithRoles[]> {
    const { where, skip, take, orderBy, include } = params;
    return (await prisma.user.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
      ...(orderBy && { orderBy }),
      include: include || {
        userRoles: {
          where: { expiresAt: null },
          include: {
            role: true,
            hotel: true,
          },
        },
      },
    })) as unknown as UserWithRoles[];
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({
      where: {
        ...where,
        deletedAt: null,
      },
    });
  }

  async create(data: UserCreateInput): Promise<User> {
    return prisma.user.create({ data }) as Promise<User>;
  }

  async update(id: string, data: UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
    }) as Promise<User>;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        email: `deleted_${id}_${Date.now()}@deleted.com`,
        updatedAt: new Date(),
      },
    });
  }
}
