import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { createRateLimiter } from '../../core/middleware/rateLimiter';
import { requireAnyPermission, requirePermission } from '../../core/middleware/requirePermission';
import { housekeepingController } from './housekeeping.controller';
import {
  AssignShiftStaffSchema,
  AssignTaskSchema,
  AutoGenerateTasksSchema,
  BulkAssignSchema,
  CancelTaskSchema,
  CompleteTaskSchema,
  CreateLostFoundItemSchema,
  CreateShiftSchema,
  CreateTaskSchema,
  DashboardQuerySchema,
  DndTaskSchema,
  HotelIdParamSchema,
  InspectionIdParamSchema,
  InspectionListQuerySchema,
  LostFoundItemIdParamSchema,
  LostFoundListQuerySchema,
  NotifyLostFoundSchema,
  OrganizationIdParamSchema,
  RoomIdParamSchema,
  ShiftIdParamSchema,
  ShiftListQuerySchema,
  StaffIdParamSchema,
  StaffScoreQuerySchema,
  StaffWorkloadQuerySchema,
  StartTaskSchema,
  SubmitInspectionSchema,
  TaskIdParamSchema,
  TaskListQuerySchema,
  UpdateLostFoundItemSchema,
  UpdateShiftSchema,
  UpdateTaskSchema,
} from './housekeeping.dto';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelTaskParams = OrgHotelParams.merge(TaskIdParamSchema);
const OrgHotelInspectionParams = OrgHotelParams.merge(InspectionIdParamSchema);
const OrgHotelStaffParams = OrgHotelParams.merge(StaffIdParamSchema);
const OrgHotelRoomParams = OrgHotelParams.merge(RoomIdParamSchema);
const OrgHotelShiftParams = OrgHotelParams.merge(ShiftIdParamSchema);
const OrgHotelLostFoundItemParams = OrgHotelParams.merge(LostFoundItemIdParamSchema);

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

router.post(
  '/tasks',
  requirePermission('HOUSEKEEPING.CREATE'),
  validate({ params: OrgHotelParams, body: CreateTaskSchema }),
  housekeepingController.createTask
);

router.get(
  '/tasks',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelParams, query: TaskListQuerySchema }),
  housekeepingController.listTasks
);

router.post(
  '/tasks/auto-generate',
  requirePermission('HOUSEKEEPING.AUTO_GENERATE'),
  validate({ params: OrgHotelParams, body: AutoGenerateTasksSchema }),
  housekeepingController.autoGenerateTasks
);

router.post(
  '/tasks/bulk-assign',
  requirePermission('HOUSEKEEPING.ASSIGN'),
  validate({ params: OrgHotelParams, body: BulkAssignSchema }),
  housekeepingController.bulkAssign
);

router.get(
  '/tasks/:taskId',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelTaskParams }),
  housekeepingController.getTaskDetail
);

router.patch(
  '/tasks/:taskId',
  requirePermission('HOUSEKEEPING.UPDATE'),
  validate({ params: OrgHotelTaskParams, body: UpdateTaskSchema }),
  housekeepingController.updateTask
);

router.post(
  '/tasks/:taskId/assign',
  requirePermission('HOUSEKEEPING.ASSIGN'),
  validate({ params: OrgHotelTaskParams, body: AssignTaskSchema }),
  housekeepingController.assignTask
);

router.post(
  '/tasks/:taskId/start',
  requirePermission('HOUSEKEEPING.START_TASK'),
  createRateLimiter({ windowMs: 60 * 1000, max: 60 }),
  validate({ params: OrgHotelTaskParams, body: StartTaskSchema }),
  housekeepingController.startTask
);

router.post(
  '/tasks/:taskId/complete',
  requirePermission('HOUSEKEEPING.COMPLETE_TASK'),
  createRateLimiter({ windowMs: 60 * 1000, max: 60 }),
  validate({ params: OrgHotelTaskParams, body: CompleteTaskSchema }),
  housekeepingController.completeTask
);

router.post(
  '/tasks/:taskId/dnd',
  requireAnyPermission('HOUSEKEEPING.MARK_DND', 'RESERVATION.READ'),
  validate({ params: OrgHotelTaskParams, body: DndTaskSchema }),
  housekeepingController.markDnd
);

router.post(
  '/tasks/:taskId/cancel',
  requirePermission('HOUSEKEEPING.CANCEL'),
  validate({ params: OrgHotelTaskParams, body: CancelTaskSchema }),
  housekeepingController.cancelTask
);

// ============================================================================
// INSPECTION
// ============================================================================

router.post(
  '/inspections',
  requirePermission('HOUSEKEEPING.INSPECT'),
  validate({ params: OrgHotelParams, body: SubmitInspectionSchema }),
  housekeepingController.submitInspection
);

router.get(
  '/inspections',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelParams, query: InspectionListQuerySchema }),
  housekeepingController.listInspections
);

router.get(
  '/inspections/:inspId',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelInspectionParams }),
  housekeepingController.getInspectionDetail
);

router.get(
  '/tasks/:taskId/inspections',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelTaskParams }),
  housekeepingController.getTaskInspections
);

router.get(
  '/staff/:staffId/scores',
  requirePermission('HOUSEKEEPING.REPORT'),
  validate({ params: OrgHotelStaffParams, query: StaffScoreQuerySchema }),
  housekeepingController.getStaffScores
);

router.get(
  '/rooms/:roomId/inspections',
  requirePermission('HOUSEKEEPING.READ'),
  validate({ params: OrgHotelRoomParams }),
  housekeepingController.getRoomInspections
);

// ============================================================================
// SHIFTS, STAFF WORKLOAD & DASHBOARD
// ============================================================================

router.post(
  '/shifts',
  requirePermission('HOUSEKEEPING.SHIFT_MANAGE'),
  validate({ params: OrgHotelParams, body: CreateShiftSchema }),
  housekeepingController.createShift
);

router.get(
  '/shifts',
  requirePermission('HOUSEKEEPING.SHIFT_MANAGE'),
  validate({ params: OrgHotelParams, query: ShiftListQuerySchema }),
  housekeepingController.listShifts
);

router.get(
  '/shifts/:shiftId',
  requirePermission('HOUSEKEEPING.SHIFT_MANAGE'),
  validate({ params: OrgHotelShiftParams }),
  housekeepingController.getShiftDetail
);

router.patch(
  '/shifts/:shiftId',
  requirePermission('HOUSEKEEPING.SHIFT_MANAGE'),
  validate({ params: OrgHotelShiftParams, body: UpdateShiftSchema }),
  housekeepingController.updateShift
);

router.post(
  '/shifts/:shiftId/assign-staff',
  requirePermission('HOUSEKEEPING.SHIFT_MANAGE'),
  validate({ params: OrgHotelShiftParams, body: AssignShiftStaffSchema }),
  housekeepingController.assignShiftStaff
);

router.get(
  '/staff/workload',
  requirePermission('HOUSEKEEPING.REPORT'),
  validate({ params: OrgHotelParams, query: StaffWorkloadQuerySchema }),
  housekeepingController.getStaffWorkload
);

router.get(
  '/dashboard',
  requirePermission('HOUSEKEEPING.DASHBOARD_READ'),
  validate({ params: OrgHotelParams, query: DashboardQuerySchema }),
  housekeepingController.getDashboard
);

// ============================================================================
// LOST & FOUND
// ============================================================================

router.post(
  '/lost-found',
  requirePermission('HOUSEKEEPING.LOST_FOUND_LOG'),
  validate({ params: OrgHotelParams, body: CreateLostFoundItemSchema }),
  housekeepingController.createLostFoundItem
);

router.get(
  '/lost-found',
  requireAnyPermission('HOUSEKEEPING.READ', 'HOUSEKEEPING.LOST_FOUND_LOG'),
  validate({ params: OrgHotelParams, query: LostFoundListQuerySchema }),
  housekeepingController.listLostFoundItems
);

router.get(
  '/lost-found/:itemId',
  requireAnyPermission('HOUSEKEEPING.READ', 'HOUSEKEEPING.LOST_FOUND_LOG'),
  validate({ params: OrgHotelLostFoundItemParams }),
  housekeepingController.getLostFoundItemDetail
);

router.patch(
  '/lost-found/:itemId',
  requirePermission('HOUSEKEEPING.LOST_FOUND_UPDATE'),
  validate({ params: OrgHotelLostFoundItemParams, body: UpdateLostFoundItemSchema }),
  housekeepingController.updateLostFoundItem
);

router.post(
  '/lost-found/:itemId/notify',
  requirePermission('HOUSEKEEPING.LOST_FOUND_NOTIFY'),
  validate({ params: OrgHotelLostFoundItemParams, body: NotifyLostFoundSchema }),
  housekeepingController.notifyLostFoundOwner
);

export default router;
