import type { NextFunction, Request, Response } from 'express';
import { handleServiceResponse, paginatedResponse } from '../../common';
import { asyncHandler } from '../../core';
import type { UserQueryInput } from './user.schema';
import { userService } from './user.service';

export class UserController {
  getAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const query = req.query as unknown as UserQueryInput;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new Error('Organization ID not found in request');
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
}

export const userController = new UserController();
