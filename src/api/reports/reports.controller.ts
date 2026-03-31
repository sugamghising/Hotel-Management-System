// ============================================================================
// REPORTS MODULE - CONTROLLER
// ============================================================================

import type { Request, Response } from 'express';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { type ReportsService, reportsService } from './reports.service';
import type { GroupByPeriod } from './reports.types';

export class ReportsController {
  constructor(private service: ReportsService = reportsService) {}

  // ==========================================================================
  // OCCUPANCY REPORT
  // ==========================================================================

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
