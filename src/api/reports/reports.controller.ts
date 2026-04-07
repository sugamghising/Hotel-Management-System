// ============================================================================
// REPORTS MODULE - CONTROLLER
// ============================================================================

import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { type ReportsService, reportsService } from './reports.service';
import type { GroupByPeriod } from './reports.types';

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
   * Handles occupancy report requests for a single organization and hotel scope.
   *
   * Parses route/query parameters, converts date values, and delegates to the service layer.
   * This wrapper does not log or access the database directly.
   *
   * @param req - Express request containing `organizationId`, `hotelId`, and report filters.
   * @param res - Express response receiving a standardized service response payload.
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
   * Handles revenue report requests for a single organization and hotel scope.
   *
   * Converts query string values to typed arguments and forwards to the service aggregation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and revenue report filters.
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
   * Handles ADR report requests for a validated organization/hotel context.
   *
   * Extracts date and grouping parameters, then delegates to service-level read/aggregation logic.
   * No database or logger calls occur in the controller.
   *
   * @param req - Express request with scoped params and ADR query options.
   * @param res - Express response populated with ADR report data.
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
   * Handles RevPAR report requests for a single hotel within an organization.
   *
   * Normalizes query inputs and delegates all scoped DB-read computation to the service/repository.
   * This method itself performs no logging and no persistence operations.
   *
   * @param req - Express request carrying scope and RevPAR filters.
   * @param res - Express response receiving the RevPAR payload.
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
   * Handles folio summary report requests for an organization/hotel date range.
   *
   * Converts `dateFrom`/`dateTo` query values to `Date` objects and delegates to the service.
   * The controller remains side-effect free aside from writing the HTTP response.
   *
   * @param req - Express request with route scope and folio date filters.
   * @param res - Express response for the summary payload.
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
   * Handles arrivals/departures report requests in organization/hotel scope.
   *
   * Reads period and grouping options from query parameters, then calls the service aggregation.
   * No direct query execution or application logging is done here.
   *
   * @param req - Express request containing scoped route params and report filters.
   * @param res - Express response for arrivals/departures metrics.
   */
  getArrivalsDeporturesReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as {
      organizationId: string;
      hotelId: string;
    };
    const { dateFrom, dateTo, groupBy } = req.query as {
      dateFrom: string;
      dateTo: string;
      groupBy?: GroupByPeriod;
    };

    const report = await this.service.getArrivalsDeporturesReport(
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
   * Handles in-house guest report requests for a scoped hotel.
   *
   * Applies optional date and room-type query parsing before delegating to service read logic.
   * This endpoint wrapper does not perform direct DB I/O or logging.
   *
   * @param req - Express request with organization/hotel scope and optional filters.
   * @param res - Express response containing in-house guest details.
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
   * Handles no-show report requests for a scoped organization and hotel.
   *
   * Converts range/grouping query values and delegates all database-read work to the service layer.
   * The controller only orchestrates HTTP input/output.
   *
   * @param req - Express request with route scope and no-show filters.
   * @param res - Express response carrying no-show analytics.
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
   * Handles guest statistics report requests for a single hotel scope.
   *
   * Parses required date range query params and forwards to service methods that run scoped reads.
   * No logging or direct data access occurs in this controller method.
   *
   * @param req - Express request with organization/hotel route params and date range.
   * @param res - Express response containing guest statistics.
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
   * Handles source analysis report requests for an organization/hotel scope.
   *
   * Translates query input to typed arguments and delegates to service/repository SQL reads.
   * This wrapper has no side effects beyond HTTP response emission.
   *
   * @param req - Express request with scoped params and source-analysis date range.
   * @param res - Express response populated with source/channel metrics.
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
   * Handles paginated repeat-guest report requests for a scoped hotel.
   *
   * Converts numeric query strings (`page`, `limit`, `minStays`) and date filters before delegation.
   * No direct DB calls or logging occur in the controller.
   *
   * @param req - Express request with scope, date range, and pagination filters.
   * @param res - Express response containing repeat guest analytics.
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
   * Handles housekeeping report requests for organization/hotel-scoped operations data.
   *
   * Parses date and grouping filters and forwards to service-layer DB-read aggregations.
   * The controller stays read/write neutral except for response serialization.
   *
   * @param req - Express request with scope and housekeeping filters.
   * @param res - Express response containing housekeeping KPIs.
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
   * Handles maintenance report requests for a single hotel in an organization.
   *
   * Converts date range query parameters and delegates to service methods for scoped read queries.
   * This method performs no direct logging or persistence.
   *
   * @param req - Express request carrying route scope and date filters.
   * @param res - Express response with maintenance metrics.
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
   * Handles manager dashboard requests within organization/hotel scope.
   *
   * Accepts an optional reference date and delegates to service logic that composes dashboard reads.
   * No database reads are performed directly in this controller.
   *
   * @param req - Express request with scoped params and optional dashboard date.
   * @param res - Express response containing manager dashboard data.
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
   * Handles revenue dashboard requests for a scoped organization/hotel pair.
   *
   * Parses optional dashboard date and delegates to service-level revenue KPI aggregation.
   * This wrapper does not log or execute SQL directly.
   *
   * @param req - Express request containing scope and optional date.
   * @param res - Express response with revenue dashboard sections.
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
   * Handles operations dashboard requests for a scoped organization/hotel pair.
   *
   * Converts optional date filters and delegates to service methods that query operational metrics.
   * Side effects are limited to producing an HTTP response.
   *
   * @param req - Express request with scoped params and optional operations date.
   * @param res - Express response containing operations dashboard data.
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
