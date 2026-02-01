import { beforeEach, describe, expect, it } from 'vitest';
import { userService } from '../../../src/api/user/user.service';

describe('UserService', () => {
  beforeEach(() => {
    userService._clear();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const dto = { email: 'test@example.com', name: 'Test User' };

      const user = await userService.create(dto);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(dto.email);
      expect(user.name).toBe(dto.name);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw ConflictError for duplicate email', async () => {
      const dto = { email: 'test@example.com', name: 'Test User' };
      await userService.create(dto);

      await expect(userService.create(dto)).rejects.toThrow('already exists');
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const created = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      const found = await userService.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(userService.findById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      // Create 5 users
      for (let i = 0; i < 5; i++) {
        await userService.create({
          email: `user${i}@example.com`,
          name: `User ${i}`,
        });
      }

      const result = await userService.findAll(1, 3);

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('should return empty array when no users', async () => {
      const result = await userService.findAll();

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const created = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      const updated = await userService.update(created.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe(created.email);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should throw ConflictError when updating to existing email', async () => {
      await userService.create({ email: 'existing@example.com', name: 'Existing' });
      const user = await userService.create({ email: 'test@example.com', name: 'Test' });

      await expect(userService.update(user.id, { email: 'existing@example.com' })).rejects.toThrow(
        'already exists'
      );
    });
  });

  describe('delete', () => {
    it('should delete existing user', async () => {
      const created = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      await userService.delete(created.id);

      await expect(userService.findById(created.id)).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(userService.delete('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'not found'
      );
    });
  });
});
