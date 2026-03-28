import type { Application } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';

describe('User Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /api/v1/users', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/v1/users').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return 401 without auth before path validation', async () => {
      const response = await request(app).get('/api/v1/users/invalid-id').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/users', () => {
    it('should return 401 when unauthenticated', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({ email: 'new@example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for malformed token', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer malformed')
        .send({ email: 'new@example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should return 401 when unauthenticated', async () => {
      const response = await request(app)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .send({ firstName: 'Updated' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should return 401 when unauthenticated', async () => {
      const response = await request(app)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
