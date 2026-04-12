// ============================================================================
// REPORTS MODULE - DTOs
// ============================================================================

// Re-export types for API consumers
export type {
  // Enums
  GroupByPeriod,
  AlertType,
  AlertEntityType,
  // Base types
  DateRange,
  ReportQueryParams,
  PaginationParams,
  // Occupancy
  OccupancyReportRow,
  OccupancyReportSummary,
  OccupancyReportResponse,
  // Revenue
  RevenueReportRow,
  RevenueReportSummary,
  RevenueReportResponse,
  // ADR
  ADRReportRow,
  ADRReportSummary,
  ADRReportResponse,
  // RevPAR
  RevPARReportRow,
  RevPARReportSummary,
  RevPARReportResponse,
  // Folio Summary
  FolioDepartmentSummary,
  FolioRevenueCodeSummary,
  FolioItemTypeSummary,
  FolioSummaryResponse,
  // Arrivals/Departures
  ArrivalsDeparturesRow,
  ArrivalsDeparturesSummary,
  ArrivalsDeparturesResponse,
  // In-House
  InHouseGuestRow,
  InHouseReportResponse,
  // No-Show
  NoShowRow,
  NoShowBySource,
  NoShowByRoomType,
  NoShowByDayOfWeek,
  NoShowReportResponse,
  // Guest Statistics
  VIPBreakdown,
  NationalityCount,
  GuestTypeBreakdown,
  GuestStatisticsResponse,
  // Source Analysis
  SourceAnalysisRow,
  ChannelDistribution,
  SourceAnalysisResponse,
  // Repeat Guests
  RepeatGuestRow,
  RepeatGuestsResponse,
  // Housekeeping
  HousekeepingReportRow,
  StaffProductivity,
  HousekeepingReportResponse,
  // Maintenance
  MaintenancePriorityCount,
  MaintenanceCategorySummary,
  MaintenanceReportResponse,
  // Manager Dashboard
  DashboardAlert,
  RoomStatusCounts,
  PendingActions,
  RevenueByHour,
  ManagerDashboardResponse,
  // Revenue Dashboard
  RevenuePeriodData,
  KPIData,
  RevenueTrendRow,
  TopRatePlan,
  SourceBreakdown,
  RevenueDashboardResponse,
  // Operations Dashboard
  HousekeepingDashboardData,
  MaintenanceDashboardData,
  InventoryDashboardData,
  POSDashboardData,
  OperationsDashboardResponse,
  // Filters
  BaseReportFilters,
  RepeatGuestsFilters,
  DashboardFilters,
} from './reports.types';

// Re-export schemas and their inferred types
export {
  // Base schemas
  GroupByPeriodSchema,
  OrganizationIdParamSchema,
  HotelIdParamSchema,
  OrgHotelParamsSchema,
  BaseReportQuerySchema,
  // Report query schemas
  OccupancyReportQuerySchema,
  RevenueReportQuerySchema,
  ADRReportQuerySchema,
  RevPARReportQuerySchema,
  FolioSummaryQuerySchema,
  ArrivalsDeparturesQuerySchema,
  InHouseReportQuerySchema,
  NoShowsQuerySchema,
  GuestStatisticsQuerySchema,
  SourceAnalysisQuerySchema,
  RepeatGuestsQuerySchema,
  HousekeepingReportQuerySchema,
  MaintenanceReportQuerySchema,
  // Dashboard query schemas
  ManagerDashboardQuerySchema,
  RevenueDashboardQuerySchema,
  OperationsDashboardQuerySchema,
} from './reports.schema';

export type {
  BaseReportQueryInput,
  OccupancyReportQueryInput,
  RevenueReportQueryInput,
  ADRReportQueryInput,
  RevPARReportQueryInput,
  FolioSummaryQueryInput,
  ArrivalsDeparturesQueryInput,
  InHouseReportQueryInput,
  NoShowsQueryInput,
  GuestStatisticsQueryInput,
  SourceAnalysisQueryInput,
  RepeatGuestsQueryInput,
  HousekeepingReportQueryInput,
  MaintenanceReportQueryInput,
  ManagerDashboardQueryInput,
  RevenueDashboardQueryInput,
  OperationsDashboardQueryInput,
} from './reports.schema';
