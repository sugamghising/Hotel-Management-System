import type { Application } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { config } from '../../../src/config';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const HOTEL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const REQUEST_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SCHEDULE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ASSET_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const basePath = `/api/v1/organizations/${ORGANIZATION_ID}/hotels/${HOTEL_ID}/maintenance`;

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
      jti: 'tok_test_maintenance',
      org: {
        id: ORGANIZATION_ID,
        code: 'TEST',
        tier: 'PRO',
      },
      user: {
        id: USER_ID,
        email: 'maint.tester@example.com',
        firstName: 'Maintenance',
        lastName: 'Tester',
        status: 'ACTIVE',
        isSuperAdmin: options.isSuperAdmin ?? false,
      },
      session: {
        id: 'sess_test_maintenance',
        type: 'access',
        mfaVerified: false,
        permissions: options.permissions ?? [],
      },
    },
    config.jwt.accessSecret
  );
};

describe('Maintenance Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // MAINTENANCE REQUESTS
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /requests', () => {
    it('returns 401 when unauthenticated', async () => {
      const response = await request(app).post(`${basePath}/requests`).send({}).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when MAINTENANCE.CREATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .post(`${basePath}/requests`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when body is invalid', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.CREATE'] });

      const response = await request(app)
        .post(`${basePath}/requests`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('super admin bypasses permission check and reaches body validation', async () => {
      const token = createAccessToken({ isSuperAdmin: true });

      const response = await request(app)
        .post(`${basePath}/requests`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /requests', () => {
    it('returns 401 when unauthenticated', async () => {
      const response = await request(app).get(`${basePath}/requests`).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when MAINTENANCE.READ permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.CREATE'] });

      const response = await request(app)
        .get(`${basePath}/requests`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when query params are invalid', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .get(`${basePath}/requests?page=-1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /requests/:requestId', () => {
    it('returns 403 when MAINTENANCE.READ permission is missing', async () => {
      const token = createAccessToken({ permissions: [] });

      const response = await request(app)
        .get(`${basePath}/requests/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /requests/:requestId', () => {
    it('returns 403 when MAINTENANCE.UPDATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .patch(`${basePath}/requests/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New title' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when update body is invalid', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.UPDATE'] });

      const response = await request(app)
        .patch(`${basePath}/requests/${REQUEST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ priority: 'INVALID_PRIORITY' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /requests/:requestId/assign', () => {
    it('returns 403 when MAINTENANCE.ASSIGN permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.UPDATE'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedTo: USER_ID })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when assign body is invalid', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.ASSIGN'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedTo: 'not-a-uuid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /requests/:requestId/log-parts (parts consumption)', () => {
    it('returns 403 when neither MAINTENANCE.PARTS_LOG nor INVENTORY.CONSUME is present', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/log-parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parts: [{ itemId: ASSET_ID, qty: 2 }] })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('accepts INVENTORY.CONSUME as alternate permission and reaches body validation', async () => {
      const token = createAccessToken({ permissions: ['INVENTORY.CONSUME'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/log-parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parts: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when qty is not a positive integer', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.PARTS_LOG'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/log-parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parts: [{ itemId: ASSET_ID, qty: 0 }] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when qty is a non-integer float', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.PARTS_LOG'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/log-parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parts: [{ itemId: ASSET_ID, qty: 1.5 }] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /requests/:requestId/complete', () => {
    it('returns 403 when MAINTENANCE.COMPLETE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.UPDATE'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ resolution: 'Fixed it' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when resolution is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.COMPLETE'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when complete body has non-integer parts qty', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.COMPLETE'] });

      const response = await request(app)
        .post(`${basePath}/requests/${REQUEST_ID}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          resolution: 'Fixed it',
          parts: [{ itemId: ASSET_ID, qty: 2.7 }],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /dashboard', () => {
    it('returns 403 when MAINTENANCE.DASHBOARD_READ permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .get(`${basePath}/dashboard`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('super admin bypasses permission and reaches query validation', async () => {
      const token = createAccessToken({ isSuperAdmin: true });

      const response = await request(app)
        .get(`${basePath}/dashboard?date=not-a-date`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PREVENTIVE SCHEDULES
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /preventive/schedules', () => {
    it('returns 401 when unauthenticated', async () => {
      const response = await request(app)
        .post(`${basePath}/preventive/schedules`)
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when PREVENTIVE.CREATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['PREVENTIVE.READ'] });

      const response = await request(app)
        .post(`${basePath}/preventive/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when body is invalid', async () => {
      const token = createAccessToken({ permissions: ['PREVENTIVE.CREATE'] });

      const response = await request(app)
        .post(`${basePath}/preventive/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ frequency: 'INVALID' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /preventive/schedules', () => {
    it('returns 403 when PREVENTIVE.READ permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .get(`${basePath}/preventive/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /preventive/schedules/generate-due', () => {
    it('returns 403 when PREVENTIVE.GENERATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['PREVENTIVE.READ'] });

      const response = await request(app)
        .post(`${basePath}/preventive/schedules/generate-due`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /preventive/schedules/:scheduleId/pause', () => {
    it('returns 403 when PREVENTIVE.PAUSE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['PREVENTIVE.READ'] });

      const response = await request(app)
        .post(`${basePath}/preventive/schedules/${SCHEDULE_ID}/pause`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ASSETS
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /assets', () => {
    it('returns 401 when unauthenticated', async () => {
      const response = await request(app).post(`${basePath}/assets`).send({}).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when ASSET.CREATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['ASSET.READ'] });

      const response = await request(app)
        .post(`${basePath}/assets`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when body is invalid', async () => {
      const token = createAccessToken({ permissions: ['ASSET.CREATE'] });

      const response = await request(app)
        .post(`${basePath}/assets`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /assets', () => {
    it('returns 403 when ASSET.READ permission is missing', async () => {
      const token = createAccessToken({ permissions: ['MAINTENANCE.READ'] });

      const response = await request(app)
        .get(`${basePath}/assets`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /assets/:assetId', () => {
    it('returns 403 when ASSET.READ permission is missing', async () => {
      const token = createAccessToken({ permissions: [] });

      const response = await request(app)
        .get(`${basePath}/assets/${ASSET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /assets/:assetId', () => {
    it('returns 403 when ASSET.UPDATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['ASSET.READ'] });

      const response = await request(app)
        .patch(`${basePath}/assets/${ASSET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New name' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /assets/:assetId/evaluate', () => {
    it('returns 403 when ASSET.EVALUATE permission is missing', async () => {
      const token = createAccessToken({ permissions: ['ASSET.READ'] });

      const response = await request(app)
        .post(`${basePath}/assets/${ASSET_ID}/evaluate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
