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

export interface UserResponse {
  success: true;
  data: User;
}

export interface UsersResponse {
  success: true;
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface DeleteResponse {
  success: true;
  data: {
    message: string;
  };
}
