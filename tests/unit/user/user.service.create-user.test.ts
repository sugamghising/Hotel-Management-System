import { describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/api/user/user.service';
import { BadRequestError } from '../../../src/core/errors';

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock('../../../src/core/utils/crypto', () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock('../../../src/api/communications/providers/email.provider', () => ({
  emailProvider: {
    send: mocks.emailSend,
  },
}));

describe('UserService.createUser', () => {
  it('sends a welcome email with temporary password after creating user', async () => {
    mocks.hashPassword.mockResolvedValue('hashed-temp-password');
    mocks.emailSend.mockResolvedValue('welcome-email-id');

    const userRepo = {
      existsByEmail: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'new.user@example.com',
      }),
      findWithRoles: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'new.user@example.com',
        userRoles: [],
      }),
    };

    const orgService = {
      validateLimits: vi.fn().mockResolvedValue({ valid: true }),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      orgService as unknown as ConstructorParameters<typeof UserService>[1]
    );

    await service.createUser('org-1', 'admin-1', {
      email: 'New.User@example.com',
      firstName: 'New',
      lastName: 'User',
      languageCode: 'en',
      timezone: 'UTC',
    } as never);

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@example.com',
      })
    );
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    expect(mocks.emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new.user@example.com',
        subject: expect.any(String),
        content: expect.any(String),
      })
    );
  });

  it('throws BadRequestError when manager belongs to a different organization', async () => {
    mocks.hashPassword.mockResolvedValue('hashed-temp-password');
    mocks.emailSend.mockResolvedValue('welcome-email-id');

    const userRepo = {
      existsByEmail: vi.fn().mockResolvedValue(false),
      existsById: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue({
        id: 'manager-1',
        organizationId: 'org-2',
        deletedAt: null,
      }),
      create: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'new.user@example.com',
      }),
      findWithRoles: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'new.user@example.com',
        userRoles: [],
      }),
    };

    const orgService = {
      validateLimits: vi.fn().mockResolvedValue({ valid: true }),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      orgService as unknown as ConstructorParameters<typeof UserService>[1]
    );

    await expect(
      service.createUser('org-1', 'admin-1', {
        email: 'new.user@example.com',
        firstName: 'New',
        lastName: 'User',
        managerId: 'manager-1',
        languageCode: 'en',
        timezone: 'UTC',
      } as never)
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
