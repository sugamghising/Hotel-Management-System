import { randomUUID } from 'node:crypto';
import type { Application } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { config } from '../../../src/config';
import { prisma } from '../../../src/database/prisma';

const runId = randomUUID().slice(0, 8);
const operationDate = '2030-01-15T00:00:00.000Z';

const fixtures = {
  organizationId: randomUUID(),
  hotelId: randomUUID(),
  roomTypeId: randomUUID(),
  roomId: randomUUID(),
  actorUserId: randomUUID(),
  staffUserId: randomUUID(),
  supervisorUserId: randomUUID(),
};

const basePath = `/api/v1/organizations/${fixtures.organizationId}/hotels/${fixtures.hotelId}/housekeeping`;

const createAccessToken = (
  options: { permissions?: string[]; userId?: string; isSuperAdmin?: boolean } = {}
): string => {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      sub: options.userId ?? fixtures.actorUserId,
      iss: 'hms-api',
      aud: 'hms-client',
      iat: now,
      exp: now + 900,
      jti: `tok_${randomUUID()}`,
      org: {
        id: fixtures.organizationId,
        code: `HKORG_${runId}`,
        tier: 'PRO',
      },
      user: {
        id: options.userId ?? fixtures.actorUserId,
        email: `housekeeping-${runId}@example.com`,
        firstName: 'Housekeeping',
        lastName: 'Tester',
        status: 'ACTIVE',
        isSuperAdmin: options.isSuperAdmin ?? false,
      },
      session: {
        id: `sess_${randomUUID()}`,
        type: 'access',
        mfaVerified: true,
        permissions: options.permissions ?? [],
      },
    },
    config.jwt.accessSecret
  );
};

const authHeader = (
  permissions: string[],
  options: { userId?: string; isSuperAdmin?: boolean } = {}
): string =>
  `Bearer ${createAccessToken({
    permissions,
    userId: options.userId,
    isSuperAdmin: options.isSuperAdmin,
  })}`;

const cleanupOperationalData = async (): Promise<void> => {
  const scopedTasks = await prisma.housekeepingTask.findMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
    select: { id: true },
  });

  const scopedTaskIds = scopedTasks.map((task) => task.id);

  if (scopedTaskIds.length > 0) {
    await prisma.housekeepingInspection.deleteMany({
      where: {
        taskId: {
          in: scopedTaskIds,
        },
      },
    });
  }

  await prisma.housekeepingInspection.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.housekeepingTask.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.housekeepingShiftAssignment.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.housekeepingShift.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.lostFoundItem.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.maintenanceRequest.deleteMany({
    where: {
      organizationId: fixtures.organizationId,
      hotelId: fixtures.hotelId,
    },
  });

  await prisma.room.update({
    where: { id: fixtures.roomId },
    data: {
      status: 'VACANT_CLEAN',
      lastCleanedAt: null,
      cleaningPriority: 1,
    },
  });
};

describe('Housekeeping Routes DB Integration', () => {
  let app: Application;

  beforeAll(async () => {
    app = createApp();

    await prisma.organization.create({
      data: {
        id: fixtures.organizationId,
        code: `HKORG_${runId}`,
        name: `Housekeeping Org ${runId}`,
        legalName: `Housekeeping Org ${runId} LLC`,
        email: `org-${runId}@example.com`,
        subscriptionTier: 'PRO',
        subscriptionStatus: 'ACTIVE',
      },
    });

    await prisma.hotel.create({
      data: {
        id: fixtures.hotelId,
        organizationId: fixtures.organizationId,
        code: `HKHOT_${runId}`,
        name: `Housekeeping Hotel ${runId}`,
        email: `hotel-${runId}@example.com`,
        phone: '+1234567890',
        addressLine1: '123 Test Street',
        city: 'Test City',
        postalCode: '10001',
        countryCode: 'US',
      },
    });

    await prisma.roomType.create({
      data: {
        id: fixtures.roomTypeId,
        organizationId: fixtures.organizationId,
        hotelId: fixtures.hotelId,
        code: `STD_${runId}`,
        name: 'Standard Room',
        bedTypes: ['QUEEN'],
      },
    });

    await prisma.room.create({
      data: {
        id: fixtures.roomId,
        organizationId: fixtures.organizationId,
        hotelId: fixtures.hotelId,
        roomTypeId: fixtures.roomTypeId,
        roomNumber: `10${runId.slice(0, 2)}`,
        status: 'VACANT_CLEAN',
        cleaningPriority: 1,
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: fixtures.actorUserId,
          organizationId: fixtures.organizationId,
          email: `actor-${runId}@example.com`,
          passwordHash: 'test-password-hash',
          firstName: 'Actor',
          lastName: 'User',
          status: 'ACTIVE',
        },
        {
          id: fixtures.staffUserId,
          organizationId: fixtures.organizationId,
          email: `staff-${runId}@example.com`,
          passwordHash: 'test-password-hash',
          firstName: 'Staff',
          lastName: 'User',
          status: 'ACTIVE',
        },
        {
          id: fixtures.supervisorUserId,
          organizationId: fixtures.organizationId,
          email: `supervisor-${runId}@example.com`,
          passwordHash: 'test-password-hash',
          firstName: 'Supervisor',
          lastName: 'User',
          status: 'ACTIVE',
        },
      ],
    });
  });

  beforeEach(async () => {
    await cleanupOperationalData();
  });

  afterAll(async () => {
    await cleanupOperationalData();

    await prisma.room.deleteMany({ where: { id: fixtures.roomId } });
    await prisma.roomType.deleteMany({ where: { id: fixtures.roomTypeId } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fixtures.actorUserId, fixtures.staffUserId, fixtures.supervisorUserId],
        },
      },
    });
    await prisma.hotel.deleteMany({ where: { id: fixtures.hotelId } });
    await prisma.organization.deleteMany({ where: { id: fixtures.organizationId } });
  });

  it('creates, starts, completes, and verifies a housekeeping task', async () => {
    const createTaskResponse = await request(app)
      .post(`${basePath}/tasks`)
      .set('Authorization', authHeader(['HOUSEKEEPING.CREATE']))
      .send({
        roomId: fixtures.roomId,
        taskType: 'CLEANING_DEPARTURE',
        scheduledFor: operationDate,
        priority: 2,
        notes: 'Guest checked out late',
      })
      .expect(201);

    const taskId: string = createTaskResponse.body.data.task.id;

    expect(createTaskResponse.body.success).toBe(true);
    expect(createTaskResponse.body.data.task.status).toBe('PENDING');

    await request(app)
      .post(`${basePath}/tasks/${taskId}/assign`)
      .set('Authorization', authHeader(['HOUSEKEEPING.ASSIGN']))
      .send({ staffId: fixtures.staffUserId })
      .expect(200);

    const startTaskResponse = await request(app)
      .post(`${basePath}/tasks/${taskId}/start`)
      .set(
        'Authorization',
        authHeader(['HOUSEKEEPING.START_TASK'], { userId: fixtures.staffUserId })
      )
      .send({})
      .expect(200);

    expect(startTaskResponse.body.data.task.status).toBe('IN_PROGRESS');

    const completeTaskResponse = await request(app)
      .post(`${basePath}/tasks/${taskId}/complete`)
      .set(
        'Authorization',
        authHeader(['HOUSEKEEPING.COMPLETE_TASK'], { userId: fixtures.staffUserId })
      )
      .send({
        notes: 'Task completed successfully',
        actualMinutes: 35,
        photos: ['https://example.com/photo-1.jpg'],
      })
      .expect(200);

    expect(completeTaskResponse.body.data.task.status).toBe('COMPLETED');
    expect(completeTaskResponse.body.data.task.actualMinutes).toBe(35);

    const submitInspectionResponse = await request(app)
      .post(`${basePath}/inspections`)
      .set(
        'Authorization',
        authHeader(['HOUSEKEEPING.INSPECT'], { userId: fixtures.supervisorUserId })
      )
      .send({
        taskId,
        scores: {
          bedding: 95,
          bathroom: 94,
          floors: 93,
          amenities: 96,
          furniture: 92,
          general: 97,
        },
      })
      .expect(201);

    expect(submitInspectionResponse.body.data.inspection.outcome).toBe('PASSED');

    const taskDetailResponse = await request(app)
      .get(`${basePath}/tasks/${taskId}`)
      .set('Authorization', authHeader(['HOUSEKEEPING.READ']))
      .expect(200);

    expect(taskDetailResponse.body.data.task.status).toBe('VERIFIED');

    const room = await prisma.room.findUnique({
      where: { id: fixtures.roomId },
      select: { status: true },
    });

    expect(room?.status).toBe('VACANT_CLEAN');
  }, 15_000);

  it('creates a shift, assigns staff, and returns workload and dashboard data', async () => {
    await request(app)
      .post(`${basePath}/tasks`)
      .set('Authorization', authHeader(['HOUSEKEEPING.CREATE']))
      .send({
        roomId: fixtures.roomId,
        taskType: 'CLEANING_STAYOVER',
        scheduledFor: operationDate,
        assignedTo: fixtures.staffUserId,
        priority: 1,
      })
      .expect(201);

    const createShiftResponse = await request(app)
      .post(`${basePath}/shifts`)
      .set('Authorization', authHeader(['HOUSEKEEPING.SHIFT_MANAGE']))
      .send({
        shiftDate: operationDate,
        startTime: '2030-01-15T08:00:00.000Z',
        endTime: '2030-01-15T16:00:00.000Z',
        supervisorId: fixtures.supervisorUserId,
        notes: 'Day shift',
      })
      .expect(201);

    const shiftId: string = createShiftResponse.body.data.shift.id;

    const assignShiftResponse = await request(app)
      .post(`${basePath}/shifts/${shiftId}/assign-staff`)
      .set('Authorization', authHeader(['HOUSEKEEPING.SHIFT_MANAGE']))
      .send({
        staffIds: [fixtures.staffUserId],
        role: 'ROOM_ATTENDANT',
      })
      .expect(200);

    expect(assignShiftResponse.body.data.shift.assignments).toHaveLength(1);

    const workloadResponse = await request(app)
      .get(`${basePath}/staff/workload`)
      .query({ date: operationDate })
      .set('Authorization', authHeader(['HOUSEKEEPING.REPORT']))
      .expect(200);

    const workloadEntry = workloadResponse.body.data.workload.find(
      (item: { staffId: string }) => item.staffId === fixtures.staffUserId
    );

    expect(workloadEntry).toBeDefined();
    expect(workloadEntry.assignedTasks).toBeGreaterThanOrEqual(1);
    expect(workloadEntry.activeShifts).toBeGreaterThanOrEqual(1);

    const dashboardResponse = await request(app)
      .get(`${basePath}/dashboard`)
      .query({ date: operationDate })
      .set('Authorization', authHeader(['HOUSEKEEPING.DASHBOARD_READ']))
      .expect(200);

    expect(dashboardResponse.body.data.dashboard.tasks.total).toBeGreaterThanOrEqual(1);
    expect(dashboardResponse.body.data.dashboard.shifts.planned).toBeGreaterThanOrEqual(1);
  });

  it('creates and updates a lost and found item and logs owner notification', async () => {
    const createItemResponse = await request(app)
      .post(`${basePath}/lost-found`)
      .set('Authorization', authHeader(['HOUSEKEEPING.LOST_FOUND_LOG']))
      .send({
        roomId: fixtures.roomId,
        itemName: 'Wireless Earbuds',
        category: 'Electronics',
        description: 'Black charging case',
        locationFound: 'Nightstand',
        storageLocation: 'Locker A1',
      })
      .expect(201);

    const itemId: string = createItemResponse.body.data.item.id;

    expect(createItemResponse.body.data.item.status).toBe('REPORTED');

    const updateItemResponse = await request(app)
      .patch(`${basePath}/lost-found/${itemId}`)
      .set('Authorization', authHeader(['HOUSEKEEPING.LOST_FOUND_UPDATE']))
      .send({
        status: 'CLAIMED',
        claimedByName: 'Alex Guest',
      })
      .expect(200);

    expect(updateItemResponse.body.data.item.status).toBe('CLAIMED');
    expect(updateItemResponse.body.data.item.claimedByName).toBe('Alex Guest');

    const notifyResponse = await request(app)
      .post(`${basePath}/lost-found/${itemId}/notify`)
      .set('Authorization', authHeader(['HOUSEKEEPING.LOST_FOUND_NOTIFY']))
      .send({
        message: 'Your item is available at the front desk.',
        channel: 'EMAIL',
      })
      .expect(200);

    expect(notifyResponse.body.data.notification.sent).toBe(true);

    const detailResponse = await request(app)
      .get(`${basePath}/lost-found/${itemId}`)
      .set('Authorization', authHeader(['HOUSEKEEPING.READ']))
      .expect(200);

    expect(detailResponse.body.data.item.status).toBe('CLAIMED');

    const listResponse = await request(app)
      .get(`${basePath}/lost-found`)
      .query({ status: 'CLAIMED' })
      .set('Authorization', authHeader(['HOUSEKEEPING.LOST_FOUND_LOG']))
      .expect(200);

    expect(listResponse.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});
