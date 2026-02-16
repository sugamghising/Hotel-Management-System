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

export class UserService {
  private userRepo: UserRepository;
  private orgService: OrganizationService;

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

  async findById(id: string): Promise<UserWithRoles> {
    const user = await this.userRepo.findById(id);
    if (!user || user.deletedAt) {
      logger.warn('User does not exist');
      throw new NotFoundError('User does not Exists.');
    }
    return user as UserWithRoles;
  }

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

  async removeRole(roleAssignmentId: string, _organizationId: string): Promise<void> {
    // Verify the assignment belongs to this organization
    // Would need to fetch the assignment first

    await this.userRepo.removeRole(roleAssignmentId);

    logger.info(`Role removed: ${roleAssignmentId}`);
  }

  // ============================================================================
  // PROFILE & PERMISSIONS
  // ============================================================================

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

  async getDepartments(organizationId: string): Promise<string[]> {
    return this.userRepo.getDepartments(organizationId);
  }

  async getJobTitles(organizationId: string): Promise<string[]> {
    return this.userRepo.getJobTitles(organizationId);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(bytes.readUInt8(i) % chars.length);
    }
    return password;
  }

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
