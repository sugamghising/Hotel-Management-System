import { prisma } from '../../database/prisma';
import type { Prisma, UserRole } from '../../generated/prisma';
import type { UserCreateInput, UserUpdateInput } from '../auth/auth.repository';
import type { User, UserRoleWithRelations, UserWithRoles } from './user.types';

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

  async findWithRoles(id: string): Promise<UserWithRoles | null> {
    return (await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
    })) as UserWithRoles | null;
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
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
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

  // ============================================================================
  // ROLE ASSIGNMENTS
  // ============================================================================

  async assignRole(data: {
    userId: string;
    roleId: string;
    organizationId: string;
    hotelId?: string;
    assignedBy: string;
    expiresAt?: Date;
  }): Promise<UserRole> {
    return prisma.userRole.create({
      data: {
        id: crypto.randomUUID(),
        userId: data.userId,
        roleId: data.roleId,
        organizationId: data.organizationId,
        hotelId: data.hotelId || null,
        assignedBy: data.assignedBy,
        assignedAt: new Date(),
        expiresAt: data.expiresAt || null,
      },
    }) as Promise<UserRole>;
  }

  async removeRole(roleAssignmentId: string): Promise<void> {
    await prisma.userRole.delete({
      where: {
        id: roleAssignmentId,
      },
    });
  }

  async findUserRole(userId: string): Promise<UserRoleWithRelations[]> {
    return prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        hotel: true,
      },
    });
  }

  // ============================================================================
  // MANAGER HIERARCHY
  // ============================================================================

  async findSubordinates(managerId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        managerId,
        deletedAt: null,
      },
    }) as Promise<User[]>;
  }

  async updateManager(userId: string, managerId: string | null): Promise<void> {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        managerId,
      },
    });
  }

  // ============================================================================
  // PERMISSIONS (via view)
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
  // EXISTS CHECKS
  // ============================================================================

  async existsByEmail(email: string, organizationId: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        email: email.toLowerCase(),
        organizationId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async existsById(id: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id, deletedAt: null },
    });
    return count > 0;
  }

  async getDepartments(organizationId: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: { department: true },
    });

    const departments = new Set<string>();
    users.forEach((u) => {
      if (u.department) departments.add(u.department);
    });

    return Array.from(departments).sort();
  }

  async getJobTitles(organizationId: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: { jobTitle: true },
    });

    const titles = new Set<string>();
    users.forEach((u) => {
      if (u.jobTitle) titles.add(u.jobTitle);
    });

    return Array.from(titles).sort();
  }
}

export const userRepository = new UserRepository();
