import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/core/errors';

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
}));

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    userRole: {
      delete: mocks.delete,
    },
  },
}));

import { UserRepository } from '../../../src/api/user/user.repository';

describe('UserRepository.removeRole', () => {
  afterEach(() => {
    mocks.delete.mockReset();
  });

  it('throws NotFoundError when the role assignment does not exist', async () => {
    const repository = new UserRepository();

    const prismaNotFoundError = Object.assign(new Error('No record was found for a delete.'), {
      code: 'P2025',
    });

    mocks.delete.mockRejectedValueOnce(prismaNotFoundError);

    await expect(repository.removeRole('missing-role-assignment-id')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
