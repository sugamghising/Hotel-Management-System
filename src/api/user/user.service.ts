import { BadRequestError, ConflictError, NotFoundError, logger } from '../../core';
import { hashPassword } from '../../core/utils/crypto';
import type { Prisma } from '../../generated/prisma';
import { type OrganizationService, organizationService } from '../organizations';
import { type UserRepository, userRepository } from './user.repository';
import type { CreateUserInput } from './user.schema';
import type { UserFilters, UserListResult, UserWithRoles } from './user.types';

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

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateTemporaryPassword(): string {
    // Generate pronounceable temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const userService = new UserService();
