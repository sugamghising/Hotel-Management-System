export { userRoutes } from './user.routes';
export { userController } from './user.controller';
export { userService, UserService } from './user.service';
export * from './user.schema';
// Types
export type {
  User,
  UserStatus,
  EmploymentType,
  UserWithRoles,
  UserRole,
  Role,
  UserFilters,
  UserListResult,
  UserProfile,
  CreateUserInput,
  UpdateUserInput,
  AssignRoleInput,
} from './user.types';

// DTOs
export type { CreateUserResponse, UserListResponse } from './user.dto';
