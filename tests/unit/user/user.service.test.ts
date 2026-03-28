import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword } from '../../../src/api/user/user.service';

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
});
