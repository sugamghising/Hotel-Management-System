import type { NextFunction, Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse, paginatedResponse } from '../../common';
import { BadRequestError, asyncHandler } from '../../core';
import type { AssignRoleInput, CreateUserInput, UserQueryInput } from './user.schema';
import { userService } from './user.service';
import type { UpdateUserInput } from './user.types';

export class UserController {
  /**
   * Get All Users
   * GET /users
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
   * Get By Id
   * GET /users/:id
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
   * Get user profiles
   * GET /users/:id/profile
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
   * Create User
   * POST /users
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
   * Update user
   * PATCH /users/:id
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
   * Delete User
   * DELETE /users/:id
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
   * Assign Role
   * POST /users/:id/roles
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
   * Remove Role
   * DELETE /users/:id/roles/:roleAssignmentId
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
   * Get User Departments
   * GET /users/departments
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
   * Get user job titles
   * GET /users/job-titles
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
