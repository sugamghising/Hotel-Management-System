import { ServiceResponse, paginatedResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { userService } from './user.service';
import type { User } from './user.types';

export const userController = {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query['page']) || 1;
    const limit = Number(req.query['limit']) || 10;
    const { users, total } = await userService.findAll(page, limit);

    const serviceResponse = paginatedResponse<User>(
      users,
      total,
      page,
      limit,
      'Users retrieved successfully'
    );
    handleServiceResponse(serviceResponse, res);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = await userService.findById(req.params['id'] as string);

    const serviceResponse = ServiceResponse.success(user, 'User retrieved successfully');
    handleServiceResponse(serviceResponse, res);
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = await userService.create(req.body);

    const serviceResponse = ServiceResponse.success(
      user,
      'User created successfully',
      StatusCodes.CREATED
    );
    handleServiceResponse(serviceResponse, res);
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = await userService.update(req.params['id'] as string, req.body);

    const serviceResponse = ServiceResponse.success(user, 'User updated successfully');
    handleServiceResponse(serviceResponse, res);
  },

  async delete(req: Request, res: Response): Promise<void> {
    await userService.delete(req.params['id'] as string);

    const serviceResponse = ServiceResponse.success({ deleted: true }, 'User deleted successfully');
    handleServiceResponse(serviceResponse, res);
  },
};
