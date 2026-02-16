export {
  CreateUserSchema,
  UpdateUserSchema,
  UserQuerySchema,
  AssignRoleSchema,
  RemoveRoleSchema,
  UserIdParamSchema,
  UserStatusSchema,
  EmploymentTypeSchema,
  // Types
  type CreateUserInput,
  type UpdateUserInput,
  type UserQueryInput,
  type AssignRoleInput,
  type RemoveRoleInput,
} from './user.schema';

// API-specific DTOs
export interface CreateUserResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    temporaryPassword?: string; // If generated
  };
  message: string;
}

export interface UserListResponse {
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department: string | null;
    jobTitle: string | null;
    status: string;
    lastLoginAt: Date | null;
    roles: Array<{
      roleName: string;
      hotelName: string | null;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
