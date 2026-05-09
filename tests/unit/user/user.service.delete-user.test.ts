import { describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/api/user/user.service';

const mocks = vi.hoisted(() => ({
  revokeAllUserTokens: vi.fn(),
}));

vi.mock('../../../src/api/auth/auth.repository', () => ({
  authRepository: {
    revokeAllUserTokens: mocks.revokeAllUserTokens,
  },
}));

describe('UserService.deleteUser', () => {
  it('revokes all refresh tokens after soft-deleting a user', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        organizationId: 'org-1',
        deletedAt: null,
      }),
      findSubordinates: vi.fn().mockResolvedValue([]),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };

    const service = new UserService(
      userRepo as unknown as ConstructorParameters<typeof UserService>[0],
      {} as ConstructorParameters<typeof UserService>[1]
    );

    await service.deleteUser('user-1', 'org-1');

    expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    expect(mocks.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
  });
});
