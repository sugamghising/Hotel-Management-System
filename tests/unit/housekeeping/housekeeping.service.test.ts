import { describe, expect, it } from 'vitest';
import { HousekeepingService } from '../../../src/api/housekeeping/housekeeping.service';

const createService = () => new HousekeepingService({} as never);

describe('HousekeepingService', () => {
  describe('calculateInspectionScore', () => {
    it('calculates weighted score and rounds to nearest integer', () => {
      const service = createService();

      const score = service.calculateInspectionScore({
        bedding: 100,
        bathroom: 90,
        floors: 80,
        amenities: 70,
        furniture: 60,
        general: 50,
      });

      expect(score).toBe(81);
    });
  });

  describe('hasAutoFailCategory', () => {
    it('returns true when at least one category is below 50', () => {
      const service = createService();

      const hasAutoFail = service.hasAutoFailCategory({
        bedding: 92,
        bathroom: 88,
        floors: 49,
        amenities: 90,
        furniture: 87,
        general: 84,
      });

      expect(hasAutoFail).toBe(true);
    });

    it('returns false when all categories are 50 or above', () => {
      const service = createService();

      const hasAutoFail = service.hasAutoFailCategory({
        bedding: 50,
        bathroom: 78,
        floors: 66,
        amenities: 91,
        furniture: 74,
        general: 85,
      });

      expect(hasAutoFail).toBe(false);
    });
  });

  describe('inspection outcome inputs', () => {
    it('supports high weighted score while still identifying auto-fail thresholds', () => {
      const service = createService();

      const scores = {
        bedding: 95,
        bathroom: 93,
        floors: 94,
        amenities: 92,
        furniture: 47,
        general: 91,
      };

      expect(service.calculateInspectionScore(scores)).toBeGreaterThanOrEqual(85);
      expect(service.hasAutoFailCategory(scores)).toBe(true);
    });
  });
});
