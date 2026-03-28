import { describe, expect, it } from 'vitest';
import { UserService } from '../../../src/api/user/user.service';

const createService = () => new UserService({} as never, {} as never);
const generateTemporaryPassword = (service: UserService): string => {
  const privateApi = service as unknown as { generateTemporaryPassword: () => string };
  return privateApi.generateTemporaryPassword();
};

describe('UserService', () => {
  describe('generateTemporaryPassword', () => {
    it('returns a 12-character password', () => {
      const service = createService();
      const password = generateTemporaryPassword(service);

      expect(password).toHaveLength(12);
    });

    it('uses only the allowed character set', () => {
      const service = createService();
      const password = generateTemporaryPassword(service);

      expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]{12}$/);
    });

    it('produces sufficiently distinct values across samples', () => {
      const service = createService();
      const sampleSize = 100;
      const generated = new Set<string>();

      for (let index = 0; index < sampleSize; index += 1) {
        generated.add(generateTemporaryPassword(service));
      }

      expect(generated.size).toBeGreaterThan(95);
    });
  });
});
