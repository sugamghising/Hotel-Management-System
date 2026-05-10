import { describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/api/user/user.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../../src/core/errors';

describe('UserService.assignRole', () => {
  it('throws NotFoundError when role does not exist', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        organizationId: 'org-1',
        deletedAt: null,
      }),
      findRoleById: vi.fn().mockResolvedValue(null),
      findHotelById: vi.fn(),
      hasActiveRoleAssignment: vi.fn(),
      assignRole: vi.fn(),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      {} as ConstructorParameters<typeof UserService>[1]
    );

    await expect(
      service.assignRole('user-1', 'org-1', 'admin-1', { roleId: 'role-1' } as never)
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(userRepo.assignRole).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when role belongs to another organization', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        organizationId: 'org-1',
        deletedAt: null,
      }),
      findRoleById: vi
        .fn()
        .mockResolvedValue({ id: 'role-1', organizationId: 'org-2', deletedAt: null }),
      findHotelById: vi.fn(),
      hasActiveRoleAssignment: vi.fn(),
      assignRole: vi.fn(),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      {} as ConstructorParameters<typeof UserService>[1]
    );

    await expect(
      service.assignRole('user-1', 'org-1', 'admin-1', { roleId: 'role-1' } as never)
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(userRepo.assignRole).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the same active role assignment already exists', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        organizationId: 'org-1',
        deletedAt: null,
      }),
      findRoleById: vi
        .fn()
        .mockResolvedValue({ id: 'role-1', organizationId: 'org-1', deletedAt: null }),
      findHotelById: vi.fn(),
      hasActiveRoleAssignment: vi.fn().mockResolvedValue(true),
      assignRole: vi.fn(),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      {} as ConstructorParameters<typeof UserService>[1]
    );

    await expect(
      service.assignRole('user-1', 'org-1', 'admin-1', { roleId: 'role-1' } as never)
    ).rejects.toBeInstanceOf(ConflictError);

    expect(userRepo.assignRole).not.toHaveBeenCalled();
  });

  it('assigns role when role and optional hotel are valid in organization', async () => {
    const expiresAt = new Date('2026-12-31T00:00:00.000Z');
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        organizationId: 'org-1',
        deletedAt: null,
      }),
      findRoleById: vi
        .fn()
        .mockResolvedValue({ id: 'role-1', organizationId: 'org-1', deletedAt: null }),
      findHotelById: vi
        .fn()
        .mockResolvedValue({ id: 'hotel-1', organizationId: 'org-1', deletedAt: null }),
      hasActiveRoleAssignment: vi.fn().mockResolvedValue(false),
      assignRole: vi.fn().mockResolvedValue(undefined),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      {} as ConstructorParameters<typeof UserService>[1]
    );

    await expect(
      service.assignRole('user-1', 'org-1', 'admin-1', {
        roleId: 'role-1',
        hotelId: 'hotel-1',
        expiresAt,
      } as never)
    ).resolves.toBeUndefined();

    expect(userRepo.assignRole).toHaveBeenCalledWith({
      userId: 'user-1',
      roleId: 'role-1',
      organizationId: 'org-1',
      assignedBy: 'admin-1',
      hotelId: 'hotel-1',
      expiresAt,
    });
  });
});
