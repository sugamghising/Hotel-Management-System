// ============================================================================
// REPORTS MODULE - TYPE DEFINITIONS
// ============================================================================

import type { Prisma } from '../../generated/prisma';

type Decimal = Prisma.Decimal;

// ============================================================================
// ENUMS
// ============================================================================

export type GroupByPeriod = 'DAY' | 'WEEK' | 'MONTH';

export type AlertType = 'WARNING' | 'CRITICAL' | 'INFO';

export type AlertEntityType =
  | 'RESERVATION'
  | 'FOLIO'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'INVENTORY'
  | 'GUEST';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

export interface ReportQueryParams extends DateRange {
  groupBy?: GroupByPeriod;
  roomTypeId?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// ============================================================================
// OCCUPANCY REPORT
// ============================================================================

export interface OccupancyReportRow {
  date: Date;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  oooRooms: number;
  occupancyRate: Decimal;
  arrivalsCount: number;
  departuresCount: number;
}

export interface OccupancyReportSummary {
  avgOccupancyRate: Decimal;
  totalArrivals: number;
  totalDepartures: number;
  avgOccupiedRooms: Decimal;
  peakOccupancyDate: Date | null;
  peakOccupancyRate: Decimal;
}

export interface OccupancyReportResponse {
  rows: OccupancyReportRow[];
  summary: OccupancyReportSummary;
}

// ============================================================================
// REVENUE REPORT
// ============================================================================

export interface RevenueReportRow {
  date: Date;
  roomRevenue: Decimal;
  fnbRevenue: Decimal;
  spaRevenue: Decimal;
  laundryRevenue: Decimal;
  otherRevenue: Decimal;
  taxCollected: Decimal;
  discounts: Decimal;
  totalRevenue: Decimal;
  paymentsReceived: Decimal;
}

export interface RevenueReportSummary {
  totalRoomRevenue: Decimal;
  totalFnbRevenue: Decimal;
  totalSpaRevenue: Decimal;
  totalLaundryRevenue: Decimal;
  totalOtherRevenue: Decimal;
  totalTaxCollected: Decimal;
  totalDiscounts: Decimal;
  grandTotalRevenue: Decimal;
  totalPaymentsReceived: Decimal;
}

export interface RevenueReportResponse {
  rows: RevenueReportRow[];
  summary: RevenueReportSummary;
}

// ============================================================================
// ADR REPORT (Average Daily Rate)
// ============================================================================

export interface ADRReportRow {
  date: Date;
  roomRevenue: Decimal;
  roomsSold: number;
  adr: Decimal;
  rollingAvg7Day: Decimal | null;
}

export interface ADRReportSummary {
  totalRoomRevenue: Decimal;
  totalRoomsSold: number;
  periodADR: Decimal;
}

export interface ADRReportResponse {
  rows: ADRReportRow[];
  summary: ADRReportSummary;
}

// ============================================================================
// REVPAR REPORT (Revenue Per Available Room)
// ============================================================================

export interface RevPARReportRow {
  date: Date;
  roomRevenue: Decimal;
  availableRooms: number;
  revPar: Decimal;
  occupancyRate: Decimal;
  adr: Decimal;
}

export interface RevPARReportSummary {
  totalRoomRevenue: Decimal;
  avgAvailableRooms: Decimal;
  periodRevPar: Decimal;
  periodOccupancyRate: Decimal;
  periodADR: Decimal;
}

export interface RevPARReportResponse {
  rows: RevPARReportRow[];
  summary: RevPARReportSummary;
}

// ============================================================================
// FOLIO SUMMARY REPORT
// ============================================================================

export interface FolioDepartmentSummary {
  department: string;
  totalAmount: Decimal;
  totalTax: Decimal;
  transactionCount: number;
}

export interface FolioRevenueCodeSummary {
  revenueCode: string;
  totalAmount: Decimal;
  totalTax: Decimal;
  transactionCount: number;
}

export interface FolioItemTypeSummary {
  itemType: string;
  totalAmount: Decimal;
  totalTax: Decimal;
  transactionCount: number;
}

export interface FolioSummaryResponse {
  byDepartment: FolioDepartmentSummary[];
  byRevenueCode: FolioRevenueCodeSummary[];
  byItemType: FolioItemTypeSummary[];
  grandTotal: {
    totalAmount: Decimal;
    totalTax: Decimal;
    transactionCount: number;
  };
}

// ============================================================================
// ARRIVALS/DEPARTURES REPORT
// ============================================================================

export interface ArrivalsDeparturesRow {
  date: Date;
  arrivals: number;
  departures: number;
  noShows: number;
  walkins: number;
  stayovers: number;
}

export interface ArrivalsDeparturesSummary {
  totalArrivals: number;
  totalDepartures: number;
  totalNoShows: number;
  totalWalkins: number;
  avgDailyArrivals: Decimal;
  avgDailyDepartures: Decimal;
}

export interface ArrivalsDeparturesResponse {
  rows: ArrivalsDeparturesRow[];
  summary: ArrivalsDeparturesSummary;
}

// ============================================================================
// IN-HOUSE REPORT
// ============================================================================

export interface InHouseGuestRow {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  balance: Decimal;
  vipStatus: string;
  roomType: string;
  ratePlanName: string;
}

export interface InHouseReportResponse {
  guests: InHouseGuestRow[];
  summary: {
    totalGuests: number;
    totalRooms: number;
    totalBalance: Decimal;
    vipCount: number;
  };
}

// ============================================================================
// NO-SHOW REPORT
// ============================================================================

export interface NoShowRow {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  roomType: string;
  checkInDate: Date;
  totalAmount: Decimal;
  cancellationFee: Decimal;
  source: string;
}

export interface NoShowBySource {
  source: string;
  count: number;
  totalAmount: Decimal;
}

export interface NoShowByRoomType {
  roomType: string;
  count: number;
}

export interface NoShowByDayOfWeek {
  dayOfWeek: number;
  dayName: string;
  count: number;
}

export interface NoShowReportResponse {
  rows: NoShowRow[];
  bySource: NoShowBySource[];
  byRoomType: NoShowByRoomType[];
  byDayOfWeek: NoShowByDayOfWeek[];
  summary: {
    totalNoShows: number;
    totalExpectedArrivals: number;
    noShowRate: Decimal;
    totalLostRevenue: Decimal;
    totalCancellationFees: Decimal;
  };
}

// ============================================================================
// GUEST STATISTICS REPORT
// ============================================================================

export interface VIPBreakdown {
  status: string;
  count: number;
}

export interface NationalityCount {
  nationality: string;
  countryName: string;
  count: number;
}

export interface GuestTypeBreakdown {
  guestType: string;
  count: number;
}

export interface GuestStatisticsResponse {
  newGuests: number;
  repeatGuests: number;
  totalGuests: number;
  vipBreakdown: VIPBreakdown[];
  nationalityTop5: NationalityCount[];
  avgLengthOfStay: Decimal;
  avgDailyRate: Decimal;
  guestTypeBreakdown: GuestTypeBreakdown[];
}

// ============================================================================
// SOURCE ANALYSIS REPORT
// ============================================================================

export interface SourceAnalysisRow {
  source: string;
  reservationCount: number;
  roomNights: number;
  totalRevenue: Decimal;
  avgADR: Decimal;
  noShowCount: number;
  noShowRate: Decimal;
  cancellationCount: number;
  cancellationRate: Decimal;
}

export interface ChannelDistribution {
  channel: string;
  reservationCount: number;
  revenue: Decimal;
  percentage: Decimal;
}

export interface SourceAnalysisResponse {
  rows: SourceAnalysisRow[];
  channelDistribution: ChannelDistribution[];
  summary: {
    totalReservations: number;
    totalRoomNights: number;
    totalRevenue: Decimal;
    overallADR: Decimal;
    overallNoShowRate: Decimal;
    overallCancellationRate: Decimal;
  };
}

// ============================================================================
// REPEAT GUESTS REPORT
// ============================================================================

export interface RepeatGuestRow {
  guestId: string;
  guestName: string;
  email: string | null;
  vipStatus: string;
  totalStays: number;
  totalNights: number;
  totalRevenue: Decimal;
  lastStayDate: Date | null;
  firstStayDate: Date;
}

export interface RepeatGuestsResponse {
  guests: RepeatGuestRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalRepeatGuests: number;
    avgStaysPerGuest: Decimal;
    avgRevenuePerGuest: Decimal;
  };
}

// ============================================================================
// HOUSEKEEPING REPORT
// ============================================================================

export interface HousekeepingReportRow {
  date: Date;
  tasksCreated: number;
  tasksCompleted: number;
  tasksCancelled: number;
  avgCompletionMinutes: Decimal | null;
  avgInspectionScore: Decimal | null;
  issuesReported: number;
}

export interface StaffProductivity {
  staffId: string;
  staffName: string;
  tasksCompleted: number;
  avgCompletionMinutes: Decimal;
  avgInspectionScore: Decimal | null;
}

export interface HousekeepingReportResponse {
  rows: HousekeepingReportRow[];
  staffProductivity: StaffProductivity[];
  summary: {
    totalTasksCreated: number;
    totalTasksCompleted: number;
    totalTasksCancelled: number;
    overallAvgCompletionMinutes: Decimal | null;
    overallAvgInspectionScore: Decimal | null;
    totalIssuesReported: number;
    completionRate: Decimal;
  };
}

// ============================================================================
// MAINTENANCE REPORT
// ============================================================================

export interface MaintenancePriorityCount {
  priority: string;
  count: number;
}

export interface MaintenanceCategorySummary {
  category: string;
  count: number;
  avgCost: Decimal;
  totalCost: Decimal;
}

export interface MaintenanceReportResponse {
  requestsCreated: number;
  requestsCompleted: number;
  requestsCancelled: number;
  avgResolutionHours: Decimal | null;
  byPriority: MaintenancePriorityCount[];
  byCategory: MaintenanceCategorySummary[];
  costs: {
    totalLaborCost: Decimal;
    totalPartsCost: Decimal;
    totalMaintenanceCost: Decimal;
  };
  slaBreaches: number;
  oooImpact: {
    roomsAffected: number;
    totalOOODays: number;
  };
}

// ============================================================================
// MANAGER DASHBOARD
// ============================================================================

export interface DashboardAlert {
  type: AlertType;
  message: string;
  count: number;
  entityType: AlertEntityType;
}

export interface RoomStatusCounts {
  vacantClean: number;
  vacantDirty: number;
  occupied: number;
  outOfOrder: number;
  reserved: number;
}

export interface PendingActions {
  checkInsToday: number;
  checkOutsToday: number;
  unbalancedFolios: number;
  lowStockAlerts: number;
  openMaintenance: number;
}

export interface RevenueByHour {
  hour: number;
  revenue: Decimal;
}

export interface ManagerDashboardResponse {
  date: Date;
  occupancy: {
    rate: Decimal;
    occupiedRooms: number;
    totalRooms: number;
    arrivals: number;
    departures: number;
    inHouse: number;
  };
  revenue: {
    today: Decimal;
    mtd: Decimal;
    ytd: Decimal;
    vsLastYear: Decimal | null;
  };
  alerts: DashboardAlert[];
  roomStatus: RoomStatusCounts;
  pendingActions: PendingActions;
  revenueByHour: RevenueByHour[];
}

// ============================================================================
// REVENUE DASHBOARD
// ============================================================================

export interface RevenuePeriodData {
  room: Decimal;
  fnb: Decimal;
  spa: Decimal;
  other: Decimal;
  total: Decimal;
  paymentsReceived: Decimal;
}

export interface KPIData {
  today: Decimal;
  mtd: Decimal;
  ytd: Decimal;
}

export interface RevenueTrendRow {
  date: Date;
  totalRevenue: Decimal;
  occupancyRate: Decimal;
}

export interface TopRatePlan {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  reservations: number;
  revenue: Decimal;
}

export interface SourceBreakdown {
  source: string;
  reservations: number;
  revenue: Decimal;
  percentage: Decimal;
}

export interface RevenueDashboardResponse {
  today: RevenuePeriodData;
  mtd: RevenuePeriodData;
  ytd: RevenuePeriodData;
  adr: KPIData;
  revPar: KPIData;
  occupancyRate: KPIData;
  revenueTrend: RevenueTrendRow[];
  topRatePlans: TopRatePlan[];
  sourceBreakdown: SourceBreakdown[];
}

// ============================================================================
// OPERATIONS DASHBOARD
// ============================================================================

export interface HousekeepingDashboardData {
  pendingTasks: number;
  inProgressTasks: number;
  completedToday: number;
  avgCompletionMinutes: Decimal | null;
  inspectionPassRate: Decimal | null;
  dirtyRooms: number;
  cleanRooms: number;
}

export interface MaintenanceDashboardData {
  openRequests: number;
  urgentOpen: number;
  completedToday: number;
  avgResolutionHours: Decimal | null;
  slaBreachCount: number;
}

export interface InventoryDashboardData {
  lowStockCount: number;
  outOfStockCount: number;
  pendingPOs: number;
}

export interface POSDashboardData {
  openOrders: number;
  revenueToday: Decimal;
  roomChargesPosted: number;
}

export interface OperationsDashboardResponse {
  date: Date;
  housekeeping: HousekeepingDashboardData;
  maintenance: MaintenanceDashboardData;
  inventory: InventoryDashboardData;
  pos: POSDashboardData;
  staffOnShift: number;
}

// ============================================================================
// QUERY FILTER TYPES
// ============================================================================

export interface BaseReportFilters {
  organizationId: string;
  hotelId: string;
  dateFrom: Date;
  dateTo: Date;
  groupBy?: GroupByPeriod;
  roomTypeId?: string | undefined;
}

export interface RepeatGuestsFilters extends BaseReportFilters {
  page: number;
  limit: number;
  minStays?: number | undefined;
}

export interface DashboardFilters {
  organizationId: string;
  hotelId: string;
  date: Date;
}
