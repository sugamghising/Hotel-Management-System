import type { Application } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { userService } from '../../../src/api/user/user.service';
import { createApp } from '../../../src/app';

describe('User Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    userService._clear();
  });

  describe('GET /api/v1/users', () => {
    it('should return empty array when no users', async () => {
      const response = await request(app).get('/api/v1/users').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
        },
      });
    });

    it('should return paginated users', async () => {
      await userService.create({ email: 'user1@example.com', name: 'User 1' });
      await userService.create({ email: 'user2@example.com', name: 'User 2' });

      const response = await request(app).get('/api/v1/users?page=1&limit=1').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by id', async () => {
      const user = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      const response = await request(app).get(`/api/v1/users/${user.id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid uuid', async () => {
      const response = await request(app).get('/api/v1/users/invalid-id').expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/users', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({ email: 'new@example.com', name: 'New User' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('new@example.com');
      expect(response.body.data.id).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({ email: 'invalid-email', name: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      await userService.create({ email: 'test@example.com', name: 'Existing' });

      const response = await request(app)
        .post('/api/v1/users')
        .send({ email: 'test@example.com', name: 'New User' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user', async () => {
      const user = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      const response = await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete user', async () => {
      const user = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      await request(app).delete(`/api/v1/users/${user.id}`).expect(200);

      // Verify user is deleted
      await request(app).get(`/api/v1/users/${user.id}`).expect(404);
    });
  });
});
