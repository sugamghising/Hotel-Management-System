// src/features/organizations/organization.controller.ts
import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse, paginatedResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  OrganizationCreateInput,
  OrganizationQueryInput,
  OrganizationUpdateInput,
  SubscriptionUpdateInput,
} from './organization.dto';
import { organizationService } from './organization.service';

export class OrganizationController {
  /**
   * GET /organizations
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as OrganizationQueryInput;

    const result = await organizationService.findAll({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      ...(query.search && { search: query.search }),
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
    });

    const serviceResponse = paginatedResponse(
      result.data,
      result.total,
      query.page,
      query.limit,
      'Organizations retrieved successfully'
    );

    handleServiceResponse(serviceResponse, res);
  });

  /**
   * GET /organizations/:id
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const org = await organizationService.findById(id);

    const response = ServiceResponse.success(org, 'Organization retrieved successfully');
    handleServiceResponse(response, res);
  });

  /**
   * POST /organizations
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as OrganizationCreateInput;
    const org = await organizationService.create(data);

    const response = ServiceResponse.success(org, 'Organization created successfully', 201);
    handleServiceResponse(response, res);
  });

  /**
   * PATCH /organizations/:id
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const data = req.body as OrganizationUpdateInput;
    const org = await organizationService.update(id, data);

    const response = ServiceResponse.success(org, 'Organization updated successfully');
    handleServiceResponse(response, res);
  });

  /**
   * POST /organizations/:id/subscription
   */
  updateSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const { tier, customLimits } = req.body as SubscriptionUpdateInput;

    const org = await organizationService.updateSubscription(id, tier, customLimits);

    const response = ServiceResponse.success(org, 'Subscription updated successfully');
    handleServiceResponse(response, res);
  });

  /**
   * GET /organizations/:id/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const stats = await organizationService.getStats(id);

    const response = ServiceResponse.success(stats, 'Organization stats retrieved successfully');
    handleServiceResponse(response, res);
  });

  /**
   * GET /organizations/:id/limits
   */
  checkLimits = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const { resource, count } = req.query as {
      resource: 'hotel' | 'user' | 'room';
      count?: string;
    };

    const result = await organizationService.validateLimits(
      id,
      resource,
      count ? Number.parseInt(count, 10) : 1
    );

    const response = ServiceResponse.success(result, 'Limit check completed');
    handleServiceResponse(response, res);
  });

  /**
   * DELETE /organizations/:id
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw new Error('Organization ID is required');
    }
    const result = await organizationService.delete(id);

    const response = ServiceResponse.success(result, 'Organization deleted successfully', 204);
    handleServiceResponse(response, res);
  });
}
