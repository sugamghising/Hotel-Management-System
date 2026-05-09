import { describe, expect, it, vi } from 'vitest';
import { UserService, generateTemporaryPassword } from '../../../src/api/user/user.service';
import { BadRequestError, NotFoundError } from '../../../src/core/errors';

describe('UserService', () => {
  describe('generateTemporaryPassword', () => {
    it('returns a 12-character password', () => {
      const password = generateTemporaryPassword();

      expect(password).toHaveLength(12);
    });

    it('uses only the allowed character set', () => {
      const password = generateTemporaryPassword();

      expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]{12}$/);
    });

    it('produces sufficiently distinct values across samples', () => {
      const sampleSize = 100;
      const generated = new Set<string>();

      for (let index = 0; index < sampleSize; index += 1) {
        generated.add(generateTemporaryPassword());
      }

      expect(generated.size).toBeGreaterThan(95);
    });
  });

  describe('removeRole', () => {
    it('throws NotFoundError when role assignment does not exist', async () => {
      const userRepo = {
        findRoleAssignmentById: vi.fn().mockResolvedValue(null),
        removeRole: vi.fn(),
      };

      const service = new UserService(
        userRepo as unknown as ConstructorParameters<typeof UserService>[0],
        {} as ConstructorParameters<typeof UserService>[1]
      );

      await expect(service.removeRole('role-assignment-id', 'org-1')).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(userRepo.removeRole).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when role assignment belongs to another organization', async () => {
      const userRepo = {
        findRoleAssignmentById: vi
          .fn()
          .mockResolvedValue({ id: 'role-assignment-id', organizationId: 'org-2' }),
        removeRole: vi.fn(),
      };

      const service = new UserService(
        userRepo as unknown as ConstructorParameters<typeof UserService>[0],
        {} as ConstructorParameters<typeof UserService>[1]
      );

      await expect(service.removeRole('role-assignment-id', 'org-1')).rejects.toBeInstanceOf(
        BadRequestError
      );
      expect(userRepo.removeRole).not.toHaveBeenCalled();
    });

    it('removes role assignment when it belongs to the organization', async () => {
      const userRepo = {
        findRoleAssignmentById: vi
          .fn()
          .mockResolvedValue({ id: 'role-assignment-id', organizationId: 'org-1' }),
        removeRole: vi.fn().mockResolvedValue(undefined),
      };

      const service = new UserService(
        userRepo as unknown as ConstructorParameters<typeof UserService>[0],
        {} as ConstructorParameters<typeof UserService>[1]
      );

      await expect(service.removeRole('role-assignment-id', 'org-1')).resolves.toBeUndefined();
      expect(userRepo.removeRole).toHaveBeenCalledWith('role-assignment-id');
    });
  });
});
