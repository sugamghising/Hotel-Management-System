import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse, paginatedResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  DashboardQueryInput,
  InspectionListQueryInput,
  LostFoundListQueryInput,
  ShiftListQueryInput,
  StaffScoreQueryInput,
  StaffWorkloadQueryInput,
  TaskListQueryInput,
} from './housekeeping.schema';
import { housekeepingService } from './housekeeping.service';
import type {
  AssignShiftStaffInput,
  AssignTaskInput,
  AutoGenerateTasksInput,
  BulkAssignInput,
  CancelTaskInput,
  CompleteTaskInput,
  CreateLostFoundItemInput,
  CreateShiftInput,
  CreateTaskInput,
  DndTaskInput,
  NotifyLostFoundInput,
  SubmitInspectionInput,
  UpdateLostFoundItemInput,
  UpdateShiftInput,
  UpdateTaskInput,
} from './housekeeping.types';

export class HousekeepingController {
  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks
   */
  createTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateTaskInput;

    const task = await housekeepingService.createTask(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ task }, 'Housekeeping task created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks
   */
  listTasks = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as TaskListQueryInput;

    const filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.taskType ? { taskType: query.taskType } : {}),
      ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    };

    const result = await housekeepingService.listTasks(organizationId, hotelId, filters, {
      page: query.page,
      limit: query.limit,
    });

    handleServiceResponse(
      paginatedResponse(
        result.items,
        result.total,
        query.page,
        query.limit,
        'Housekeeping tasks retrieved'
      ),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId
   */
  getTaskDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };

    const task = await housekeepingService.getTaskDetail(organizationId, hotelId, taskId);

    handleServiceResponse(ServiceResponse.success({ task }, 'Housekeeping task retrieved'), res);
  });

  /**
   * PATCH /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId
   */
  updateTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };
    const input = req.body as UpdateTaskInput;

    const task = await housekeepingService.updateTask(organizationId, hotelId, taskId, input);

    handleServiceResponse(ServiceResponse.success({ task }, 'Housekeeping task updated'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/assign
   */
  assignTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };
    const input = req.body as AssignTaskInput;

    const task = await housekeepingService.assignTask(organizationId, hotelId, taskId, input);

    handleServiceResponse(ServiceResponse.success({ task }, 'Task assigned successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/start
   */
  startTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };

    const task = await housekeepingService.startTask(
      organizationId,
      hotelId,
      taskId,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ task }, 'Task started successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/complete
   */
  completeTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };
    const input = req.body as CompleteTaskInput;

    const task = await housekeepingService.completeTask(
      organizationId,
      hotelId,
      taskId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ task }, 'Task completed successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/dnd
   */
  markDnd = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };
    const input = req.body as DndTaskInput;

    const task = await housekeepingService.markDnd(
      organizationId,
      hotelId,
      taskId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ task }, 'Task marked as DND'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/cancel
   */
  cancelTask = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };
    const input = req.body as CancelTaskInput;

    const task = await housekeepingService.cancelTask(
      organizationId,
      hotelId,
      taskId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ task }, 'Task cancelled successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/auto-generate
   */
  autoGenerateTasks = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as AutoGenerateTasksInput;

    const result = await housekeepingService.autoGenerateStayoverTasks(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(result, 'Stayover tasks generated'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/bulk-assign
   */
  bulkAssign = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as BulkAssignInput;

    const result = await housekeepingService.bulkAutoAssign(organizationId, hotelId, input);

    handleServiceResponse(ServiceResponse.success(result, 'Tasks bulk-assigned successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/inspections
   */
  submitInspection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as SubmitInspectionInput;

    const inspection = await housekeepingService.submitInspection(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        { inspection },
        'Inspection submitted successfully',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/inspections
   */
  listInspections = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as InspectionListQueryInput;

    const filters = {
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    };

    const result = await housekeepingService.listInspections(organizationId, hotelId, filters, {
      page: query.page,
      limit: query.limit,
    });

    handleServiceResponse(
      paginatedResponse(
        result.items,
        result.total,
        query.page,
        query.limit,
        'Inspections retrieved successfully'
      ),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/inspections/:inspId
   */
  getInspectionDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, inspId } = req.params as {
      organizationId: string;
      hotelId: string;
      inspId: string;
    };

    const inspection = await housekeepingService.getInspectionDetail(
      organizationId,
      hotelId,
      inspId
    );

    handleServiceResponse(
      ServiceResponse.success({ inspection }, 'Inspection detail retrieved'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/inspections
   */
  getTaskInspections = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, taskId } = req.params as {
      organizationId: string;
      hotelId: string;
      taskId: string;
    };

    const inspections = await housekeepingService.getTaskInspections(
      organizationId,
      hotelId,
      taskId
    );

    handleServiceResponse(
      ServiceResponse.success({ inspections }, 'Task inspections retrieved successfully'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/staff/:staffId/scores
   */
  getStaffScores = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, staffId } = req.params as {
      organizationId: string;
      hotelId: string;
      staffId: string;
    };
    const query = req.query as unknown as StaffScoreQueryInput;

    const report = await housekeepingService.getStaffQualityHistory(
      organizationId,
      hotelId,
      staffId,
      query.from,
      query.to
    );

    handleServiceResponse(ServiceResponse.success(report, 'Staff quality history retrieved'), res);
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/rooms/:roomId/inspections
   */
  getRoomInspections = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, roomId } = req.params as {
      organizationId: string;
      hotelId: string;
      roomId: string;
    };

    const inspections = await housekeepingService.getRoomInspectionHistory(
      organizationId,
      hotelId,
      roomId
    );

    handleServiceResponse(
      ServiceResponse.success({ inspections }, 'Room inspection history retrieved'),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/shifts
   */
  createShift = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateShiftInput;

    const shift = await housekeepingService.createShift(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success({ shift }, 'Shift created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/shifts
   */
  listShifts = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ShiftListQueryInput;

    const filters = {
      ...(query.date ? { date: query.date } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const result = await housekeepingService.listShifts(organizationId, hotelId, filters, {
      page: query.page,
      limit: query.limit,
    });

    handleServiceResponse(
      paginatedResponse(result.items, result.total, query.page, query.limit, 'Shifts retrieved'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId
   */
  getShiftDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, shiftId } = req.params as {
      organizationId: string;
      hotelId: string;
      shiftId: string;
    };

    const shift = await housekeepingService.getShiftDetail(organizationId, hotelId, shiftId);

    handleServiceResponse(ServiceResponse.success({ shift }, 'Shift retrieved successfully'), res);
  });

  /**
   * PATCH /organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId
   */
  updateShift = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, shiftId } = req.params as {
      organizationId: string;
      hotelId: string;
      shiftId: string;
    };
    const input = req.body as UpdateShiftInput;

    const shift = await housekeepingService.updateShift(organizationId, hotelId, shiftId, input);

    handleServiceResponse(ServiceResponse.success({ shift }, 'Shift updated successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId/assign-staff
   */
  assignShiftStaff = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, shiftId } = req.params as {
      organizationId: string;
      hotelId: string;
      shiftId: string;
    };
    const input = req.body as AssignShiftStaffInput;

    const shift = await housekeepingService.assignStaffToShift(
      organizationId,
      hotelId,
      shiftId,
      input
    );

    handleServiceResponse(
      ServiceResponse.success({ shift }, 'Shift staff assigned successfully'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/staff/workload
   */
  getStaffWorkload = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as StaffWorkloadQueryInput;

    const workload = await housekeepingService.getStaffWorkload(
      organizationId,
      hotelId,
      query.date
    );

    handleServiceResponse(
      ServiceResponse.success({ workload }, 'Staff workload retrieved successfully'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/dashboard
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as DashboardQueryInput;

    const dashboard = await housekeepingService.getDashboard(organizationId, hotelId, query.date);

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Housekeeping dashboard retrieved successfully'),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found
   */
  createLostFoundItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateLostFoundItemInput;

    const item = await housekeepingService.createLostFoundItem(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ item }, 'Lost and found item created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found
   */
  listLostFoundItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as LostFoundListQueryInput;

    const filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    };

    const result = await housekeepingService.listLostFoundItems(organizationId, hotelId, filters, {
      page: query.page,
      limit: query.limit,
    });

    handleServiceResponse(
      paginatedResponse(
        result.items,
        result.total,
        query.page,
        query.limit,
        'Lost and found items retrieved'
      ),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId
   */
  getLostFoundItemDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };

    const item = await housekeepingService.getLostFoundItemDetail(organizationId, hotelId, itemId);

    handleServiceResponse(ServiceResponse.success({ item }, 'Lost and found item retrieved'), res);
  });

  /**
   * PATCH /organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId
   */
  updateLostFoundItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };
    const input = req.body as UpdateLostFoundItemInput;

    const item = await housekeepingService.updateLostFoundItem(
      organizationId,
      hotelId,
      itemId,
      input
    );

    handleServiceResponse(ServiceResponse.success({ item }, 'Lost and found item updated'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId/notify
   */
  notifyLostFoundOwner = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };
    const input = req.body as NotifyLostFoundInput;

    const notification = await housekeepingService.notifyLostFoundOwner(
      organizationId,
      hotelId,
      itemId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ notification }, 'Lost and found owner notified'),
      res
    );
  });
}

export const housekeepingController = new HousekeepingController();
