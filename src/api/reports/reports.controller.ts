// ============================================================================
// REPORTS MODULE - CONTROLLER
// ============================================================================

import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { type ReportsService, reportsService } from './reports.service';
import type { GroupByPeriod } from './reports.types';

/**
 * Controller transport handlers for reports and dashboards.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId.
 */
export class ReportsController {
  /**
   * Creates a reports controller wired to a reports service implementation.
   *
   * @param service - Service used to execute organizationId/hotelId-scoped report reads.
   */
  constructor(private service: ReportsService = reportsService) {}

  // ==========================================================================
  // OCCUPANCY REPORT
  // ==========================================================================

  /**
   * Handles get occupancy report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/occupancy
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy, roomTypeId } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
      roomTypeId?: string;
    };

    const report = await this.service.getOccupancyReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy,
      roomTypeId
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Occupancy report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // REVENUE REPORT
  // ==========================================================================

  /**
   * Handles get revenue report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/revenue
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRevenueReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy, roomTypeId } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
      roomTypeId?: string;
    };

    const report = await this.service.getRevenueReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy,
      roomTypeId
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Revenue report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // ADR REPORT
  // ==========================================================================

  /**
   * Handles get adr report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/adr
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getADRReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy, roomTypeId } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
      roomTypeId?: string;
    };

    const report = await this.service.getADRReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy,
      roomTypeId
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'ADR report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // REVPAR REPORT
  // ==========================================================================

  /**
   * Handles get rev par report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/revpar
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRevPARReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy, roomTypeId } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
      roomTypeId?: string;
    };

    const report = await this.service.getRevPARReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy,
      roomTypeId
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'RevPAR report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // FOLIO SUMMARY REPORT
  // ==========================================================================

  /**
   * Handles get folio summary requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/folio-summary
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getFolioSummary = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo } = req.query as {
      dateFrom: string;
      dateTo: string;
    };

    const report = await this.service.getFolioSummary(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo)
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Folio summary retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // ARRIVALS/DEPARTURES REPORT
  // ==========================================================================

  /**
   * Handles get arrivals departures report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/arrivals-departures
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getArrivalsDeparturesReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
    };

    const report = await this.service.getArrivalsDeparturesReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Arrivals/Departures report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // IN-HOUSE REPORT
  // ==========================================================================

  /**
   * Handles get in house report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/in-house
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getInHouseReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { date, roomTypeId } = req.query as {
      date?: string;
      roomTypeId?: string;
    };

    const report = await this.service.getInHouseReport(
      organizationId,
      hotelId,
      date ? new Date(date) : undefined,
      roomTypeId
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'In-house report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // NO-SHOW REPORT
  // ==========================================================================

  /**
   * Handles get no show report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/no-shows
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getNoShowReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
    };

    const report = await this.service.getNoShowReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'No-show report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // GUEST STATISTICS REPORT
  // ==========================================================================

  /**
   * Handles get guest statistics requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/guest-statistics
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getGuestStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo } = req.query as {
      dateFrom: string;
      dateTo: string;
    };

    const report = await this.service.getGuestStatistics(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo)
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Guest statistics retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // SOURCE ANALYSIS REPORT
  // ==========================================================================

  /**
   * Handles get source analysis requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/source-analysis
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getSourceAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo } = req.query as {
      dateFrom: string;
      dateTo: string;
    };

    const report = await this.service.getSourceAnalysis(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo)
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Source analysis retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // REPEAT GUESTS REPORT
  // ==========================================================================

  /**
   * Handles get repeat guests requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/repeat-guests
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRepeatGuests = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, page, limit, minStays } = req.query as {
      dateFrom: string;
      dateTo: string;
      page?: string;
      limit?: string;
      minStays?: string;
    };

    const report = await this.service.getRepeatGuests(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      page ? Number.parseInt(page, 10) : undefined,
      limit ? Number.parseInt(limit, 10) : undefined,
      minStays ? Number.parseInt(minStays, 10) : undefined
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Repeat guests report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // HOUSEKEEPING REPORT
  // ==========================================================================

  /**
   * Handles get housekeeping report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/housekeeping
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getHousekeepingReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
    };

    const report = await this.service.getHousekeepingReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo),
      groupBy
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Housekeeping report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // MAINTENANCE REPORT
  // ==========================================================================

  /**
   * Handles get maintenance report requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reports/maintenance
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getMaintenanceReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo } = req.query as {
      dateFrom: string;
      dateTo: string;
    };

    const report = await this.service.getMaintenanceReport(
      organizationId,
      hotelId,
      new Date(dateFrom),
      new Date(dateTo)
    );

    handleServiceResponse(
      ServiceResponse.success({ report }, 'Maintenance report retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // MANAGER DASHBOARD
  // ==========================================================================

  /**
   * Handles get manager dashboard requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/dashboard/manager
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getManagerDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { date } = req.query as { date?: string };

    const dashboard = await this.service.getManagerDashboard(
      organizationId,
      hotelId,
      date ? new Date(date) : undefined
    );

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Manager dashboard retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // REVENUE DASHBOARD
  // ==========================================================================

  /**
   * Handles get revenue dashboard requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/dashboard/revenue
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRevenueDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { date } = req.query as { date?: string };

    const dashboard = await this.service.getRevenueDashboard(
      organizationId,
      hotelId,
      date ? new Date(date) : undefined
    );

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Revenue dashboard retrieved successfully'),
      res
    );
  });

  // ==========================================================================
  // OPERATIONS DASHBOARD
  // ==========================================================================

  /**
   * Handles get operations dashboard requests for reports and dashboards.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/dashboard/operations
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getOperationsDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { date } = req.query as { date?: string };

    const dashboard = await this.service.getOperationsDashboard(
      organizationId,
      hotelId,
      date ? new Date(date) : undefined
    );

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Operations dashboard retrieved successfully'),
      res
    );
  });
}

export const reportsController = new ReportsController();
