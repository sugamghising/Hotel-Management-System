import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { userService } from './user.service';
import type { DeleteResponse, UserResponse, UsersResponse } from './user.types';

export const userController = {
  async list(req: Request, res: Response<UsersResponse>): Promise<void> {
    const page = Number(req.query['page']) || 1;
    const limit = Number(req.query['limit']) || 10;
    const { users, total } = await userService.findAll(page, limit);

    res.status(StatusCodes.OK).json({
      success: true,
      data: users,
      meta: {
        total,
        page,
        limit,
      },
    });
  },

  async getById(req: Request, res: Response<UserResponse>): Promise<void> {
    const user = await userService.findById(req.params['id'] as string);

    res.status(StatusCodes.OK).json({
      success: true,
      data: user,
    });
  },

  async create(req: Request, res: Response<UserResponse>): Promise<void> {
    const user = await userService.create(req.body);

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: user,
    });
  },

  async update(req: Request, res: Response<UserResponse>): Promise<void> {
    const user = await userService.update(req.params['id'] as string, req.body);

    res.status(StatusCodes.OK).json({
      success: true,
      data: user,
    });
  },

  async delete(req: Request, res: Response<DeleteResponse>): Promise<void> {
    await userService.delete(req.params['id'] as string);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        message: 'User deleted successfully',
      },
    });
  },
};
