// ============================================================================
// REPORTS MODULE - ROUTES
// ============================================================================

import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { reportsController } from './reports.controller';
import {
  ADRReportQuerySchema,
  ArrivalsDeparturesQuerySchema,
  FolioSummaryQuerySchema,
  GuestStatisticsQuerySchema,
  HousekeepingReportQuerySchema,
  InHouseReportQuerySchema,
  MaintenanceReportQuerySchema,
  ManagerDashboardQuerySchema,
  NoShowsQuerySchema,
  OccupancyReportQuerySchema,
  OperationsDashboardQuerySchema,
  OrgHotelParamsSchema,
  RepeatGuestsQuerySchema,
  RevPARReportQuerySchema,
  RevenueDashboardQuerySchema,
  RevenueReportQuerySchema,
  SourceAnalysisQuerySchema,
} from './reports.schema';

const router = Router({ mergeParams: true });

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ============================================================================
// OPERATIONAL REPORTS
// ============================================================================

/**
 * GET /reports/occupancy
 * Get occupancy report for date range
 */
router.get(
  '/reports/occupancy',
  requirePermission('REPORT.OCCUPANCY'),
  validate({ params: OrgHotelParamsSchema, query: OccupancyReportQuerySchema }),
  reportsController.getOccupancyReport
);

/**
 * GET /reports/arrivals-departures
 * Get arrivals and departures report
 */
router.get(
  '/reports/arrivals-departures',
  requirePermission('REPORT.OCCUPANCY'),
  validate({ params: OrgHotelParamsSchema, query: ArrivalsDeparturesQuerySchema }),
  reportsController.getArrivalsDeparturesReport
);

/**
 * GET /reports/in-house
 * Get current in-house guests report
 */
router.get(
  '/reports/in-house',
  requirePermission('REPORT.OCCUPANCY'),
  validate({ params: OrgHotelParamsSchema, query: InHouseReportQuerySchema }),
  reportsController.getInHouseReport
);

/**
 * GET /reports/no-shows
 * Get no-show report
 */
router.get(
  '/reports/no-shows',
  requirePermission('REPORT.NO_SHOWS'),
  validate({ params: OrgHotelParamsSchema, query: NoShowsQuerySchema }),
  reportsController.getNoShowReport
);

// ============================================================================
// REVENUE REPORTS
// ============================================================================

/**
 * GET /reports/revenue
 * Get revenue report by category
 */
router.get(
  '/reports/revenue',
  requirePermission('REPORT.REVENUE'),
  validate({ params: OrgHotelParamsSchema, query: RevenueReportQuerySchema }),
  reportsController.getRevenueReport
);

/**
 * GET /reports/adr
 * Get Average Daily Rate report
 */
router.get(
  '/reports/adr',
  requirePermission('REPORT.ADR_REVPAR'),
  validate({ params: OrgHotelParamsSchema, query: ADRReportQuerySchema }),
  reportsController.getADRReport
);

/**
 * GET /reports/revpar
 * Get Revenue Per Available Room report
 */
router.get(
  '/reports/revpar',
  requirePermission('REPORT.ADR_REVPAR'),
  validate({ params: OrgHotelParamsSchema, query: RevPARReportQuerySchema }),
  reportsController.getRevPARReport
);

/**
 * GET /reports/folio-summary
 * Get folio summary by department/revenue code
 */
router.get(
  '/reports/folio-summary',
  requirePermission('REPORT.FOLIO_SUMMARY'),
  validate({ params: OrgHotelParamsSchema, query: FolioSummaryQuerySchema }),
  reportsController.getFolioSummary
);

// ============================================================================
// GUEST REPORTS
// ============================================================================

/**
 * GET /reports/guest-statistics
 * Get guest statistics report
 */
router.get(
  '/reports/guest-statistics',
  requirePermission('REPORT.GUEST_STATS'),
  validate({ params: OrgHotelParamsSchema, query: GuestStatisticsQuerySchema }),
  reportsController.getGuestStatistics
);

/**
 * GET /reports/source-analysis
 * Get booking source analysis report
 */
router.get(
  '/reports/source-analysis',
  requirePermission('REPORT.SOURCE_ANALYSIS'),
  validate({ params: OrgHotelParamsSchema, query: SourceAnalysisQuerySchema }),
  reportsController.getSourceAnalysis
);

/**
 * GET /reports/repeat-guests
 * Get repeat guests report with pagination
 */
router.get(
  '/reports/repeat-guests',
  requirePermission('REPORT.GUEST_STATS'),
  validate({ params: OrgHotelParamsSchema, query: RepeatGuestsQuerySchema }),
  reportsController.getRepeatGuests
);

// ============================================================================
// OPERATIONAL REPORTS (HOUSEKEEPING & MAINTENANCE)
// ============================================================================

/**
 * GET /reports/housekeeping
 * Get housekeeping productivity report
 */
router.get(
  '/reports/housekeeping',
  requirePermission('REPORT.HOUSEKEEPING'),
  validate({ params: OrgHotelParamsSchema, query: HousekeepingReportQuerySchema }),
  reportsController.getHousekeepingReport
);

/**
 * GET /reports/maintenance
 * Get maintenance report
 */
router.get(
  '/reports/maintenance',
  requirePermission('REPORT.MAINTENANCE'),
  validate({ params: OrgHotelParamsSchema, query: MaintenanceReportQuerySchema }),
  reportsController.getMaintenanceReport
);

// ============================================================================
// DASHBOARDS
// ============================================================================

/**
 * GET /dashboard/manager
 * Get manager dashboard with KPIs and alerts
 */
router.get(
  '/dashboard/manager',
  requirePermission('DASHBOARD.MANAGER'),
  validate({ params: OrgHotelParamsSchema, query: ManagerDashboardQuerySchema }),
  reportsController.getManagerDashboard
);

/**
 * GET /dashboard/revenue
 * Get revenue dashboard with trends
 */
router.get(
  '/dashboard/revenue',
  requirePermission('DASHBOARD.REVENUE'),
  validate({ params: OrgHotelParamsSchema, query: RevenueDashboardQuerySchema }),
  reportsController.getRevenueDashboard
);

/**
 * GET /dashboard/operations
 * Get operations dashboard
 */
router.get(
  '/dashboard/operations',
  requirePermission('DASHBOARD.OPERATIONS'),
  validate({ params: OrgHotelParamsSchema, query: OperationsDashboardQuerySchema }),
  reportsController.getOperationsDashboard
);

export default router;
