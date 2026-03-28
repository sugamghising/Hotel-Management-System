import type { Application } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { config } from '../../../src/config';

const ORGANIZATION_ID = '11111111-1111-1111-1111-111111111111';
const HOTEL_ID = '22222222-2222-2222-2222-222222222222';
const TASK_ID = '33333333-3333-3333-3333-333333333333';
const ITEM_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = '55555555-5555-5555-5555-555555555555';

const basePath = `/api/v1/organizations/${ORGANIZATION_ID}/hotels/${HOTEL_ID}/housekeeping`;

const createAccessToken = (
  options: { permissions?: string[]; isSuperAdmin?: boolean } = {}
): string => {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      sub: USER_ID,
      iss: 'hms-api',
      aud: 'hms-client',
      iat: now,
      exp: now + 900,
      jti: 'tok_test_housekeeping',
      org: {
        id: ORGANIZATION_ID,
        code: 'TEST',
        tier: 'PRO',
      },
      user: {
        id: USER_ID,
        email: 'hk.tester@example.com',
        firstName: 'Housekeeping',
        lastName: 'Tester',
        status: 'ACTIVE',
        isSuperAdmin: options.isSuperAdmin ?? false,
      },
      session: {
        id: 'sess_test_housekeeping',
        type: 'access',
        mfaVerified: false,
        permissions: options.permissions ?? [],
      },
    },
    config.jwt.accessSecret
  );
};

describe('Housekeeping Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /housekeeping/tasks', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const response = await request(app).post(`${basePath}/tasks`).send({}).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when permission is missing', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.READ'] });

      const response = await request(app)
        .post(`${basePath}/tasks`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when payload is invalid after permission check', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.CREATE'] });

      const response = await request(app)
        .post(`${basePath}/tasks`)
        .set('Authorization', `Bearer ${token}`)
        .send({ taskType: 'CLEANING_DEPARTURE' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /housekeeping/tasks/:taskId/dnd', () => {
    it('returns 403 when neither HOUSEKEEPING.MARK_DND nor RESERVATION.READ is present', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.READ'] });

      const response = await request(app)
        .post(`${basePath}/tasks/${TASK_ID}/dnd`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Guest requested privacy' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('accepts RESERVATION.READ for permission and then validates body', async () => {
      const token = createAccessToken({ permissions: ['RESERVATION.READ'] });

      const response = await request(app)
        .post(`${basePath}/tasks/${TASK_ID}/dnd`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /housekeeping/dashboard', () => {
    it('returns 403 when HOUSEKEEPING.DASHBOARD_READ is missing', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.READ'] });

      const response = await request(app)
        .get(`${basePath}/dashboard`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('allows super admin bypass before query validation', async () => {
      const token = createAccessToken({ isSuperAdmin: true });

      const response = await request(app)
        .get(`${basePath}/dashboard?date=not-a-date`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Lost and Found permissions', () => {
    it('returns 403 when updating item without HOUSEKEEPING.LOST_FOUND_UPDATE', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.LOST_FOUND_LOG'] });

      const response = await request(app)
        .patch(`${basePath}/lost-found/${ITEM_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CLAIMED', claimedByName: 'Guest' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when list query is invalid after LOST_FOUND_LOG permission passes', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.LOST_FOUND_LOG'] });

      const response = await request(app)
        .get(`${basePath}/lost-found?from=not-a-date`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when update payload status is invalid', async () => {
      const token = createAccessToken({ permissions: ['HOUSEKEEPING.LOST_FOUND_UPDATE'] });

      const response = await request(app)
        .patch(`${basePath}/lost-found/${ITEM_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });
});
