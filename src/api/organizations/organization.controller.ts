import type { Request, Response } from 'express';
import { handleServiceResponse, paginatedResponse } from '../../common';
import { asyncHandler } from '../../core';
import { organizationService } from './organization.service';

export class OrganizationController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, status, type } = req.query as Record<string, string>;

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 10;

    const result = await organizationService.findAll({
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      ...(search && { search }),
      ...(status && { status }),
      ...(type && { type }),
    });

    const serviceResponse = paginatedResponse(
      result.data,
      result.total,
      pageNum,
      limitNum,
      'Organizations retrieved successfully'
    );

    handleServiceResponse(serviceResponse, res);
  });
}
