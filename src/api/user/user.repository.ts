import { prisma } from '../../database/prisma';
import type { Prisma, UserRole } from '../../generated/prisma';
import type { UserCreateInput, UserUpdateInput } from '../auth/auth.repository';
import type { User, UserRoleWithRelations, UserWithRoles } from './user.types';

export class UserRepository {
  // ============================================================================
  // USER CRUD
  // ============================================================================
  /**
   * Retrieves a non-deleted user by identifier.
   *
   * @param userId - User UUID.
   * @param include - Optional Prisma include graph for related entities.
   * @returns Matching user, or `null` when not found or soft-deleted.
   */
  async findById(userId: string, include?: Prisma.UserInclude): Promise<User | null> {
    return (await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      ...(include && { include }),
    })) as User | null;
  }

  /**
   * Retrieves a non-deleted user with active role assignments and hierarchy relations.
   *
   * @param id - User UUID.
   * @returns User with roles, manager, and subordinates, or `null` when missing.
   */
  async findWithRoles(id: string): Promise<UserWithRoles | null> {
    return (await prisma.user.findFirst({
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

  /**
   * Finds a non-deleted user by normalized email inside an organization scope.
   *
   * @param email - User email address; normalized to lowercase before querying.
   * @param organizationId - Organization UUID the user must belong to.
   * @returns Matching user, or `null` when none exists.
   */
  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    return (await prisma.user.findFirst({
      where: { email: email.toLowerCase(), organizationId, deletedAt: null },
    })) as User | null;
  }

  /**
   * Lists non-deleted users with optional filtering, pagination, sorting, and includes.
   *
   * @param params - Query options for where, skip/take, ordering, and relation includes.
   * @returns Users matching the query scope.
   */
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

  /**
   * Counts non-deleted users matching an optional filter.
   *
   * @param where - Optional Prisma filter criteria.
   * @returns Number of users in scope.
   */
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({
      where: {
        ...where,
        deletedAt: null,
      },
    });
  }

  /**
   * Creates a user record.
   *
   * @param data - Prepared Prisma user create payload.
   * @returns Newly created user entity.
   */
  async create(data: UserCreateInput): Promise<User> {
    return prisma.user.create({ data }) as Promise<User>;
  }

  /**
   * Updates a user and applies standard audit/version mutations.
   *
   * @param id - User UUID to update.
   * @param data - Partial user update payload.
   * @returns Updated user entity.
   */
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

  /**
   * Soft-deletes a user and anonymizes email to preserve uniqueness constraints.
   *
   * @param id - User UUID to soft-delete.
   * @returns Resolves when the update completes.
   */
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

  /**
   * Creates a user-role assignment.
   *
   * @param data - Assignment data including user, role, organization, and optional hotel scope.
   * @returns Created user-role assignment row.
   */
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

  /**
   * Removes a user-role assignment by its identifier.
   *
   * @param roleAssignmentId - User-role assignment UUID.
   * @returns Resolves when deletion completes.
   */
  async removeRole(roleAssignmentId: string): Promise<void> {
    await prisma.userRole.delete({
      where: {
        id: roleAssignmentId,
      },
    });
  }

  /**
   * Retrieves active role assignments for a user with role permissions and hotel context.
   *
   * @param userId - User UUID.
   * @returns Active role assignments with related role and permission data.
   */
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

  /**
   * Lists non-deleted users who report directly to a manager.
   *
   * @param managerId - Manager user UUID.
   * @returns Direct subordinate users.
   */
  async findSubordinates(managerId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        managerId,
        deletedAt: null,
      },
    }) as Promise<User[]>;
  }

  /**
   * Sets or clears the manager relationship for a user.
   *
   * @param userId - User UUID to update.
   * @param managerId - Manager UUID, or `null` to remove manager assignment.
   * @returns Resolves when the update completes.
   */
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

  /**
   * Retrieves distinct permission codes granted to a user through role assignments.
   *
   * @param userId - User UUID.
   * @returns Permission code list from `v_user_permissions`.
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
  // EXISTS CHECKS
  // ============================================================================

  /**
   * Checks whether a non-deleted user exists for an email in an organization.
   *
   * @param email - Email address to test.
   * @param organizationId - Organization UUID scope.
   * @returns `true` when at least one matching user exists.
   */
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

  /**
   * Checks whether a non-deleted user exists by identifier.
   *
   * @param id - User UUID.
   * @returns `true` when the user exists and is not soft-deleted.
   */
  async existsById(id: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id, deletedAt: null },
    });
    return count > 0;
  }

  /**
   * Returns distinct department names used by users in an organization.
   *
   * @param organizationId - Organization UUID.
   * @returns Alphabetically sorted unique department names.
   * @remarks Complexity: O(n) in number of users returned by the query.
   */
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

  /**
   * Returns distinct job titles used by users in an organization.
   *
   * @param organizationId - Organization UUID.
   * @returns Alphabetically sorted unique job titles.
   * @remarks Complexity: O(n) in number of users returned by the query.
   */
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
