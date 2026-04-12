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

/**
 * Controller transport handlers for organization management.
 *
 * Module base route: /api/v1/organizations.
 */
export class OrganizationController {
  /**
   * Handles get all requests for organization management.
   *
   * Route: GET /api/v1/organizations
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get by id requests for organization management.
   *
   * Route: GET /api/v1/organizations/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles create requests for organization management.
   *
   * Route: POST /api/v1/organizations
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as OrganizationCreateInput;
    const org = await organizationService.create(data);

    const response = ServiceResponse.success(org, 'Organization created successfully', 201);
    handleServiceResponse(response, res);
  });

  /**
   * Handles update requests for organization management.
   *
   * Route: PATCH /api/v1/organizations/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles update subscription requests for organization management.
   *
   * Route: POST /api/v1/organizations/:id/subscription
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles get stats requests for organization management.
   *
   * Route: GET /api/v1/organizations/:id/stats
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles check limits requests for organization management.
   *
   * Route: GET /api/v1/organizations/:id/limits
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles delete requests for organization management.
   *
   * Route: DELETE /api/v1/organizations/:id
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
