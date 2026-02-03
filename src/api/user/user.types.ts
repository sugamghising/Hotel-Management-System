import type { PaginatedData, ServiceResponseType } from '@/common/models/serviceResponse';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
}

export interface UpdateUserDTO {
  email?: string;
  name?: string;
}

// ServiceResponse-based types
export type UserResponse = ServiceResponseType<User>;
export type UsersResponse = ServiceResponseType<PaginatedData<User>>;
export type DeleteResponse = ServiceResponseType<{ deleted: boolean }>;
