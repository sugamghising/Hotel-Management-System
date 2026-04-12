import type { NextFunction, Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse, paginatedResponse } from '../../common';
import { BadRequestError, asyncHandler } from '../../core';
import type { AssignRoleInput, CreateUserInput, UserQueryInput } from './user.schema';
import { userService } from './user.service';
import type { UpdateUserInput } from './user.types';

/**
 * Controller transport handlers for user administration.
 *
 * Module base route: /api/v1/users.
 */
export class UserController {
  /**
   * Handles get all requests for user administration.
   *
   * Route: GET /api/v1/users
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const query = req.query as unknown as UserQueryInput;
    const organizationId = req.user?.org.id;

    if (!organizationId) {
      throw new BadRequestError('Organization ID not found in request');
    }

    const result = await userService.findAll(organizationId, {
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      ...(query.search && { search: query.search }),
      ...(query.status && { status: query.status }),
      ...(query.department && { department: query.department }),
      ...(query.jobTitle && { jobTitle: query.jobTitle }),
      ...(query.managerId && { managerId: query.managerId }),
    });

    const serviceResponse = paginatedResponse(
      result.data,
      result.total,
      query.page,
      query.limit,
      'Users retrieved successfully'
    );

    handleServiceResponse(serviceResponse, res);
  });

  /**
   * Handles get by id requests for user administration.
   *
   * Route: GET /api/v1/users/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('User ID is required');
    }
    const user = await userService.findById(id);

    const response = ServiceResponse.success(user, 'User retrieved successfully.');
    handleServiceResponse(response, res);
  });

  /**
   * Handles get profile requests for user administration.
   *
   * Route: GET /api/v1/users/:id/profile
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getProfile = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('User ID is required');
    }

    const result = await userService.getUserProfile(id);
    const response = ServiceResponse.success(result, 'User Profile fetched successfully');
    handleServiceResponse(response, res);
  });

  /**
   * Handles create requests for user administration.
   *
   * Route: POST /api/v1/users
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const input: CreateUserInput = req.body as CreateUserInput;
    const organizationId = req.user?.org.id;
    const createdBy = req.user?.user.id;

    if (!organizationId || !createdBy) {
      throw new BadRequestError('Organization ID and User ID are required');
    }

    const result = await userService.createUser(organizationId, createdBy, input);
    const response = ServiceResponse.success(result, 'User created Successfully.');
    handleServiceResponse(response, res);
  });

  /**
   * Handles update requests for user administration.
   *
   * Route: PATCH /api/v1/users/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const organizationId = req.user?.org.id;
    const input = req.body as UpdateUserInput;

    if (!organizationId || !id) {
      throw new BadRequestError('Organization ID and userId are required');
    }

    const result = await userService.updateUser(id, organizationId, input);
    const response = ServiceResponse.success(result, 'User updated Successfully.');
    handleServiceResponse(response, res);
  });

  /**
   * Handles delete requests for user administration.
   *
   * Route: DELETE /api/v1/users/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  delete = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const organizationId = req.user?.org.id;

    if (!id || !organizationId) {
      throw new BadRequestError('User id and organization id is required.');
    }
    const result = await userService.deleteUser(id, organizationId);
    const response = ServiceResponse.success(result, 'User deleted successfully');
    handleServiceResponse(response, res);
  });

  /**
   * Handles assign role requests for user administration.
   *
   * Route: POST /api/v1/users/:id/roles
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  assignRole = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const organizationId = req.user?.org.id;
    const assignedBy = req.user?.user.id;

    if (!id || !organizationId || !assignedBy) {
      throw new BadRequestError('User id, organization id, and assigned by user id are required.');
    }
    const input = req.body as AssignRoleInput;
    const result = await userService.assignRole(id, organizationId, assignedBy, input);
    const response = ServiceResponse.success(result, 'Role Assigned Successfully.');
    handleServiceResponse(response, res);
  });

  /**
   * Handles remove role requests for user administration.
   *
   * Route: DELETE /api/v1/users/:id/roles/:roleAssignmentId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  removeRole = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { roleAssignmentId } = req.params;
    const organizationId = req.user?.org.id;
    if (!roleAssignmentId || !organizationId) {
      throw new BadRequestError('Role assignment ID and organization ID are required');
    }
    const result = await userService.removeRole(roleAssignmentId, organizationId);
    const response = ServiceResponse.success(result, 'Role Removed Successfully');
    handleServiceResponse(response, res);
  });

  /**
   * Handles get departments requests for user administration.
   *
   * Route: GET /api/v1/users/departments
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDepartments = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const organizationId = req.user?.org.id;
    if (!organizationId) {
      throw new BadRequestError('Organization ID is required');
    }
    const result = await userService.getDepartments(organizationId);
    const response = ServiceResponse.success(result, 'Departments Retrived.');
    handleServiceResponse(response, res);
  });

  /**
   * Handles get job titles requests for user administration.
   *
   * Route: GET /api/v1/users/job-titles
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getJobTitles = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const organizationId = req.user?.org.id;
    if (!organizationId) {
      throw new BadRequestError('Organization ID is required');
    }

    const result = await userService.getJobTitles(organizationId);
    const response = ServiceResponse.success(result, 'Job Titles fetched successfully');
    handleServiceResponse(response, res);
  });
}

export const userController = new UserController();
