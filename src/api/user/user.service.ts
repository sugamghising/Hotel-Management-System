import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../core/errors/index';
import type { CreateUserDTO, UpdateUserDTO, User } from './user.types';

// In-memory store for demo purposes
// In production, replace with actual database
const users = new Map<string, User>();

export const userService = {
  async findAll(page = 1, limit = 10): Promise<{ users: User[]; total: number }> {
    const allUsers = Array.from(users.values());
    const total = allUsers.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limit);

    return { users: paginatedUsers, total };
  },

  async findById(id: string): Promise<User> {
    const user = users.get(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    return user;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(users.values()).find((user) => user.email === email);
  },

  async create(dto: CreateUserDTO): Promise<User> {
    // Check for duplicate email
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictError(`User with email ${dto.email} already exists`);
    }

    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: dto.email,
      name: dto.name,
      createdAt: now,
      updatedAt: now,
    };

    users.set(user.id, user);
    return user;
  },

  async update(id: string, dto: UpdateUserDTO): Promise<User> {
    const user = await this.findById(id);

    // Check for email conflict if updating email
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email);
      if (existingUser) {
        throw new ConflictError(`User with email ${dto.email} already exists`);
      }
    }

    const updatedUser: User = {
      ...user,
      ...dto,
      updatedAt: new Date(),
    };

    users.set(id, updatedUser);
    return updatedUser;
  },

  async delete(id: string): Promise<void> {
    const user = users.get(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    users.delete(id);
  },

  // Utility method for testing
  _clear(): void {
    users.clear();
  },
};
