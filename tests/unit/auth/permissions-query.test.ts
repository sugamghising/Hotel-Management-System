import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const extractQueryText = (query: unknown): string => {
  if (typeof query === 'string') {
    return query;
  }

  if (Array.isArray(query)) {
    return query.join(' ');
  }

  if (query && typeof query === 'object') {
    const value = query as { sql?: string; text?: string; strings?: readonly string[] };
    if (typeof value.sql === 'string') {
      return value.sql;
    }
    if (typeof value.text === 'string') {
      return value.text;
    }
    if (Array.isArray(value.strings)) {
      return value.strings.join(' ');
    }
  }

  return '';
};

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
  },
}));

import { AuthRepository } from '../../../src/api/auth/auth.repository';
import { UserRepository } from '../../../src/api/user/user.repository';

describe('permission queries', () => {
  beforeEach(() => {
    mocks.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = extractQueryText(query).toLowerCase();
      if (sql.includes('v_user_permissions')) {
        throw new Error('relation "v_user_permissions" does not exist');
      }
      return [{ permission_code: 'USER.READ' }];
    });
  });

  afterEach(() => {
    mocks.queryRaw.mockReset();
  });

  it('AuthRepository resolves permissions without depending on v_user_permissions', async () => {
    const repository = new AuthRepository();

    await expect(
      repository.getUserPermissions('00000000-0000-0000-0000-000000000001')
    ).resolves.toEqual(['USER.READ']);

    const sql = extractQueryText(mocks.queryRaw.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain('from user_roles');
  });

  it('UserRepository resolves permissions without depending on v_user_permissions', async () => {
    const repository = new UserRepository();

    await expect(
      repository.getUserPermissions('00000000-0000-0000-0000-000000000001')
    ).resolves.toEqual(['USER.READ']);

    const sql = extractQueryText(mocks.queryRaw.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain('from user_roles');
  });
});
