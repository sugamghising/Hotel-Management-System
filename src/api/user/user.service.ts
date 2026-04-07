import crypto from 'node:crypto';
import { BadRequestError, ConflictError, NotFoundError, logger } from '../../core';
import { hashPassword } from '../../core/utils/crypto';
import type { Prisma } from '../../generated/prisma';
import { type OrganizationService, organizationService } from '../organizations';
import { type UserRepository, userRepository } from './user.repository';
import type { AssignRoleInput, CreateUserInput } from './user.schema';
import type {
  UpdateUserInput,
  UserFilters,
  UserListResult,
  UserProfile,
  UserWithRoles,
} from './user.types';

/**
 * Generates a random temporary password using an ambiguity-safe character set.
 *
 * @returns A 12-character password suitable for first-login credential delivery.
 */
export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let index = 0; index < 12; index++) {
    password += chars.charAt(crypto.randomInt(chars.length));
  }
  return password;
}

export class UserService {
  private userRepo: UserRepository;
  private orgService: OrganizationService;

  /**
   * Creates a user service with repository and organization-service dependencies.
   *
   * @param userRepo - Repository used for user persistence operations.
   * @param orgService - Service used for organization-level validations.
   */
  constructor(
    userRepo: UserRepository = userRepository,
    orgService: OrganizationService = organizationService
  ) {
    this.userRepo = userRepo;
    this.orgService = orgService;
  }

  // ============================================================================
  // USER CRUD
  // ============================================================================

  /**
   * Creates an organization-scoped user and returns the generated temporary password.
   *
   * The method validates organization user limits, enforces email uniqueness,
   * verifies optional manager existence, creates a random temporary password,
   * persists the user with secure password hash, and re-reads the user with
   * role relations for API responses.
   *
   * @param organizationId - Organization UUID that will own the user.
   * @param createdByUserId - User UUID that initiated creation.
   * @param input - Validated user creation payload.
   * @returns Created user with relations plus plaintext temporary password.
   * @throws {BadRequestError} Thrown when organization user limits are exceeded.
   * @throws {ConflictError} Thrown when email already exists in the organization.
   * @throws {NotFoundError} Thrown when referenced manager is missing or post-create read fails.
   */
  async createUser(
    organizationId: string,
    createdByUserId: string,
    input: CreateUserInput
  ): Promise<{ user: UserWithRoles; temporaryPassword: string }> {
    //Check Organization Capacity
    const limitCheck = await this.orgService.validateLimits(organizationId, 'user', 1);
    if (!limitCheck.valid) {
      throw new BadRequestError(limitCheck.message || 'Organization user limit exceeded');
    }

    // Check email uniqueness
    const exists = await this.userRepo.existsByEmail(input.email, organizationId);
    if (exists) {
      throw new ConflictError(
        `User with email '${input.email}' already exists in this organization`
      );
    }

    // Validate manager if provided
    if (input.managerId) {
      const managerExists = await this.userRepo.existsById(input.managerId);
      if (!managerExists) {
        throw new NotFoundError('Manager not Found');
      }
    }

    //Generate Temporary Password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    //Create User
    const user = await this.userRepo.create({
      organization: { connect: { id: organizationId } },
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
      hireDate: input.hireDate || null,
      ...(input.managerId && { manager: { connect: { id: input.managerId } } }),
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      phoneVerified: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordChangedAt: new Date(),
      languageCode: input.languageCode || 'en',
      timezone: input.timezone || 'UTC',
      preferences: {},
      isSuperAdmin: false,
      version: 1,
    });

    //Fetch with Roles
    const userWithRoles = await this.userRepo.findWithRoles(user.id);
    if (!userWithRoles) {
      throw new NotFoundError('Failed to retrieve user after creation');
    }

    // TODO: Send welcome email with temporary password

    logger.info(`User created: ${user.email}`, {
      userId: user.id,
      orgId: organizationId,
      createdBy: createdByUserId,
    });

    return {
      user: userWithRoles,
      temporaryPassword,
    };
  }

  /**
   * Lists organization users using optional search and attribute filters.
   *
   * @param organizationId - Organization UUID scope.
   * @param filters - Filter and pagination options.
   * @returns Paginated user list with total count.
   * @remarks Complexity: O(p) in page size with two parallel repository queries.
   */
  async findAll(organizationId: string, filters: UserFilters): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = {
      organizationId,
    };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.department) {
      where.department = filters.department;
    }

    if (filters.jobTitle) {
      where.jobTitle = filters.jobTitle;
    }

    if (filters.managerId) {
      where.managerId = filters.managerId;
    }

    const [data, total] = await Promise.all([
      this.userRepo.findMany({
        where,
        skip: filters.skip || 0,
        take: filters.take || 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.userRepo.count(where),
    ]);

    return { data, total };
  }

  /**
   * Retrieves a single non-deleted user by identifier.
   *
   * @param id - User UUID.
   * @returns User entity cast to `UserWithRoles`.
   * @throws {NotFoundError} Thrown when the user does not exist or is soft-deleted.
   */
  async findById(id: string): Promise<UserWithRoles> {
    const user = await this.userRepo.findById(id);
    if (!user || user.deletedAt) {
      logger.warn('User does not exist');
      throw new NotFoundError('User does not Exists.');
    }
    return user as UserWithRoles;
  }

  /**
   * Updates mutable user fields while enforcing organization and manager constraints.
   *
   * Verifies user ownership, validates manager reassignment rules (no self-manager
   * and no reporting cycles), applies only defined fields, and returns the
   * refreshed user with role relations.
   *
   * @param id - User UUID to update.
   * @param organizationId - Organization UUID the user must belong to.
   * @param input - Partial user update payload.
   * @returns Updated user with role relations.
   * @throws {NotFoundError} Thrown when user or new manager is not found.
   * @throws {BadRequestError} Thrown when update would create invalid manager hierarchy.
   */
  async updateUser(
    id: string,
    organizationId: string,
    input: UpdateUserInput
  ): Promise<UserWithRoles> {
    //Verify user exists and belongs to the organizations
    const user = await this.userRepo.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User does not exist.');
    }

    if (user.organizationId !== organizationId) {
      throw new NotFoundError('User does not  belong to the organizations.');
    }

    //Validate manager  if changing
    if (input.managerId !== undefined && input.managerId !== user.managerId) {
      if (input.managerId === id) {
        throw new NotFoundError('User cannot be their own manager.');
      }

      if (user.managerId) {
        const managerExists = await this.userRepo.existsById(input.managerId);
        if (!managerExists) {
          throw new NotFoundError('Manager doesnot exists.');
        }

        // Prevent circular reporting (A reports to B, B reports to A)
        const wouldCreateCycle = await this.checkManagerCycle(id, input.managerId);
        if (wouldCreateCycle) {
          throw new BadRequestError('This manager assignment would create a reporting cycle.');
        }
      }
    }

    //Build update data
    const updatedData: Prisma.UserUpdateInput = {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.middleName !== undefined && { middleName: input.middleName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.employeeId !== undefined && { employeeId: input.employeeId }),
      ...(input.department !== undefined && { department: input.department }),
      ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle }),
      ...(input.employmentType !== undefined && { employmentType: input.employmentType }),
      ...(input.hireDate !== undefined && { hireDate: input.hireDate }),
      ...(input.terminationDate !== undefined && { terminationDate: input.terminationDate }),
      ...(input.managerId !== undefined && { managerId: input.managerId }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.languageCode !== undefined && { languageCode: input.languageCode }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.preferences !== undefined && {
        preferences: input.preferences as Prisma.InputJsonValue,
      }),
    };

    //Update user and return
    await this.userRepo.update(id, updatedData);
    const updated = await this.userRepo.findWithRoles(id);

    if (!updated) {
      throw new NotFoundError('User update failed');
    }

    logger.info(`User updated: ${updated.email}`, { userId: id });

    return updated;
  }

  /**
   * Soft-deletes a user after ensuring organizational ownership and no subordinates.
   *
   * @param id - User UUID to delete.
   * @param organizationId - Organization UUID scope.
   * @returns Resolves when soft deletion completes.
   * @throws {NotFoundError} Thrown when the user does not exist.
   * @throws {BadRequestError} Thrown when the user is outside the organization scope.
   * @throws {ConflictError} Thrown when the user still has subordinate users.
   */
  async deleteUser(id: string, organizationId: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User not Found');
    }

    if (user.organizationId !== organizationId) {
      throw new BadRequestError('User does not belong to the organizations.');
    }

    //check if the user has subordinates
    const subordinates = await this.userRepo.findSubordinates(id);
    if (subordinates.length > 0) {
      throw new ConflictError(
        `Cannot delete user with ${subordinates.length} subordinates. Reassign them first.`
      );
    }

    await this.userRepo.softDelete(id);

    // Revoke all sessions
    // Note: This would need to be done via auth repository or service

    logger.info(`User deleted: ${user.email}`, { userId: id });
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  /**
   * Assigns a role to an organization user with optional hotel scope and expiry.
   *
   * @param userId - Target user UUID.
   * @param organizationId - Organization UUID scope.
   * @param assignedBy - User UUID performing the assignment.
   * @param input - Role assignment payload.
   * @returns Resolves when assignment is created.
   * @throws {NotFoundError} Thrown when target user is missing.
   * @throws {BadRequestError} Thrown when user is outside the organization scope.
   */
  async assignRole(
    userId: string,
    organizationId: string,
    assignedBy: string,
    input: AssignRoleInput
  ): Promise<void> {
    //Verify user exists and belongs to the organizations
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User does not exists.');
    }

    if (user.organizationId !== organizationId) {
      throw new BadRequestError('User does not belong to the organization.');
    }

    // Verify role exists (would need role repository)
    // For now, assume role exists

    await this.userRepo.assignRole({
      userId,
      roleId: input.roleId,
      organizationId,
      assignedBy,
      ...(input.hotelId !== undefined && { hotelId: input.hotelId }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    });

    logger.info(`Role assigned to user: ${user.email}`, {
      userId,
      roleId: input.roleId,
      hotelId: input.hotelId,
    });
  }

  /**
   * Removes a user-role assignment.
   *
   * @param roleAssignmentId - User-role assignment UUID.
   * @param _organizationId - Reserved organization scope parameter.
   * @returns Resolves when the assignment is removed.
   */
  async removeRole(roleAssignmentId: string, _organizationId: string): Promise<void> {
    // Verify the assignment belongs to this organization
    // Would need to fetch the assignment first

    await this.userRepo.removeRole(roleAssignmentId);

    logger.info(`Role removed: ${roleAssignmentId}`);
  }

  // ============================================================================
  // PROFILE & PERMISSIONS
  // ============================================================================

  /**
   * Builds a full user profile response including roles, manager, and permissions.
   *
   * @param id - User UUID.
   * @returns User profile DTO enriched with permission codes.
   * @throws {NotFoundError} Thrown when the user cannot be found.
   */
  async getUserProfile(id: string): Promise<UserProfile> {
    const user = await this.userRepo.findWithRoles(id);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User');
    }

    const permissions = await this.userRepo.getUserPermissions(id);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      department: user.department,
      jobTitle: user.jobTitle,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.id,
        roleCode: ur.role.code,
        roleName: ur.role.name,
        hotelId: ur.hotelId,
        hotelName: ur.hotel?.name ?? null,
      })),
      manager: user.manager
        ? {
            id: user.manager.id,
            name: `${user.manager.firstName} ${user.manager.lastName}`,
          }
        : null,
      permissions,
    };
  }

  /**
   * Lists distinct department values used by organization users.
   *
   * @param organizationId - Organization UUID scope.
   * @returns Sorted department names.
   */
  async getDepartments(organizationId: string): Promise<string[]> {
    return this.userRepo.getDepartments(organizationId);
  }

  /**
   * Lists distinct job titles used by organization users.
   *
   * @param organizationId - Organization UUID scope.
   * @returns Sorted job title names.
   */
  async getJobTitles(organizationId: string): Promise<string[]> {
    return this.userRepo.getJobTitles(organizationId);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Generates a temporary password using the module-level password generator.
   *
   * @returns New temporary password string.
   */
  private generateTemporaryPassword(): string {
    return generateTemporaryPassword();
  }

  /**
   * Detects whether a proposed manager assignment creates a reporting cycle.
   *
   * Traverses upward through manager links from the proposed manager to ensure
   * the target user is not encountered in the ancestor chain.
   *
   * @param userId - User UUID being reassigned.
   * @param newManagerId - Proposed manager UUID.
   * @returns `true` when assigning the manager would create a cycle.
   * @remarks Complexity: O(h) in hierarchy depth from `newManagerId`.
   */
  private async checkManagerCycle(userId: string, newManagerId: string): Promise<boolean> {
    let currentId: string | null = newManagerId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === userId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const manager = await this.userRepo.findById(currentId);
      currentId = manager?.managerId || null;
    }
    return false;
  }
}

export const userService = new UserService();
