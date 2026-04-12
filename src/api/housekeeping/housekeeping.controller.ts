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

/**
 * Controller transport handlers for housekeeping operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping.
 */
export class HousekeepingController {
  /**
   * Handles create task requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles list tasks requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get task detail requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles update task requests for housekeeping operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles assign task requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/assign
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles start task requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/start
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles complete task requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/complete
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles mark dnd requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/dnd
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles cancel task requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/cancel
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles auto generate tasks requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/auto-generate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles bulk assign requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/bulk-assign
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  bulkAssign = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as BulkAssignInput;

    const result = await housekeepingService.bulkAutoAssign(organizationId, hotelId, input);

    handleServiceResponse(ServiceResponse.success(result, 'Tasks bulk-assigned successfully'), res);
  });

  /**
   * Handles submit inspection requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/inspections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles list inspections requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/inspections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get inspection detail requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/inspections/:inspId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get task inspections requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/tasks/:taskId/inspections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get staff scores requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/staff/:staffId/scores
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get room inspections requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/rooms/:roomId/inspections
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles create shift requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/shifts
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles list shifts requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/shifts
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get shift detail requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles update shift requests for housekeeping operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles assign shift staff requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/shifts/:shiftId/assign-staff
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get staff workload requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/staff/workload
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get dashboard requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles create lost found item requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles list lost found items requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get lost found item detail requests for housekeeping operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles update lost found item requests for housekeeping operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles notify lost found owner requests for housekeeping operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping/lost-found/:itemId/notify
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
