import type { Prisma } from '../../generated/prisma';

// ============================================================================
// ENUMS
// ============================================================================

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'SEASONAL';

// ============================================================================
// DOMAIN ENTITY
// ============================================================================

export interface User {
  id: string;
  organizationId: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;

  // Profile
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  dateOfBirth: Date | null;
  gender: string | null;

  // Employment
  employeeId: string | null;
  employmentType: EmploymentType | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: Date | null;
  terminationDate: Date | null;
  managerId: string | null;

  // Status
  status: UserStatus;
  isSuperAdmin: boolean;

  // Preferences
  languageCode: string;
  timezone: string;
  preferences: Record<string, unknown>;

  // Audit
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

// ============================================================================
// PRISMA EXTENSIONS
// ============================================================================

export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true;
        hotel: true;
      };
    };
    manager: true;
    subordinates: true;
  };
}>;

export type UserWithOrganization = Prisma.UserGetPayload<{
  include: {
    organization: true;
  };
}>;

export type UserRoleWithRelations = Prisma.UserRoleGetPayload<{
  include: {
    role: {
      include: {
        permissions: {
          include: {
            permission: true;
          };
        };
      };
    };
    hotel: true;
  };
}>;

// ============================================================================
// ROLE ASSIGNMENT
// ============================================================================

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  hotelId: string | null;
  organizationId: string;
  assignedBy: string | null;
  assignedAt: Date;
  expiresAt: Date | null;
}

export interface Role {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  level: number;
}

// ============================================================================
// SERVICE INPUTS/OUTPUTS
// ============================================================================

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
  employmentType?: EmploymentType;
  hireDate?: Date;
  managerId?: string;
  languageCode?: string;
  timezone?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
  employmentType?: EmploymentType;
  hireDate?: Date;
  terminationDate?: Date;
  managerId?: string;
  status?: UserStatus;
  languageCode?: string;
  timezone?: string;
  preferences?: Record<string, unknown>;
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  hotelId?: string;
  expiresAt?: Date;
}

export interface UserFilters {
  search?: string;
  status?: UserStatus;
  department?: string;
  jobTitle?: string;
  managerId?: string;
  skip?: number;
  take?: number;
}

export interface UserListResult {
  data: UserWithRoles[];
  total: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{
    id: string;
    roleCode: string;
    roleName: string;
    hotelId: string | null;
    hotelName: string | null;
  }>;
  manager: {
    id: string;
    name: string;
  } | null;
  permissions: string[];
}
