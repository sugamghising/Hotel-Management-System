import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';

describe('Health Routes', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ok',
          environment: expect.any(String),
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          version: expect.any(String),
        },
      });
    });
  });
});
