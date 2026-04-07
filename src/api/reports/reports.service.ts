// ============================================================================
// REPORTS MODULE - SERVICE LAYER
// ============================================================================

import { NotFoundError } from '../../core/errors';
import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
import { type ReportsRepository, reportsRepository } from './reports.repository';
import type {
  ADRReportResponse,
  ArrivalsDeporturesResponse,
  BaseReportFilters,
  DashboardFilters,
  FolioSummaryResponse,
  GroupByPeriod,
  GuestStatisticsResponse,
  HousekeepingReportResponse,
  InHouseReportResponse,
  MaintenanceReportResponse,
  ManagerDashboardResponse,
  NoShowReportResponse,
  OccupancyReportResponse,
  OperationsDashboardResponse,
  RepeatGuestsFilters,
  RepeatGuestsResponse,
  RevPARReportResponse,
  RevenueDashboardResponse,
  RevenueReportResponse,
  SourceAnalysisResponse,
} from './reports.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/**
 * Divides two decimal values while guarding against division-by-zero.
 *
 * Used by report and dashboard aggregations to keep derived ratios stable even when
 * there is no denominator data (for example, zero room nights or zero rooms sold).
 * This helper is pure and does not perform any logging or database access.
 *
 * @param numerator - Decimal value to divide.
 * @param divisor - Decimal or numeric denominator.
 * @returns A decimal quotient, or `0` when the divisor resolves to zero.
 *
 * @remarks Complexity: O(1) constant-time decimal arithmetic.
 */
function safeDivide(numerator: Decimal, divisor: Decimal | number): Decimal {
  const divisorDecimal = typeof divisor === 'number' ? new Decimal(divisor) : divisor;
  if (divisorDecimal.isZero()) {
    return new Decimal(0);
  }
  return numerator.div(divisorDecimal);
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ReportsService {
  /**
   * Creates the reports service with an injectable repository dependency.
   *
   * @param repo - Repository used for read-only report/dashboard queries.
   */
  constructor(private repo: ReportsRepository = reportsRepository) {}

  // ==========================================================================
  // HOTEL VALIDATION
  // ==========================================================================

  /**
   * Validates that a hotel belongs to the provided organization scope.
   *
   * Performs a read-only lookup on `hotel` using both `organizationId` and `hotelId`
   * to enforce tenant scoping before any report query runs. No logging is emitted.
   *
   * @param organizationId - Organization scope for multi-tenant isolation.
   * @param hotelId - Hotel identifier that must belong to `organizationId`.
   * @returns The hotel's timezone when the scoped hotel exists.
   * @throws {NotFoundError} When the hotel is missing, deleted, or out of scope.
   *
   * @remarks Complexity: O(1) at application level with one indexed database read.
   */
  private async validateHotel(organizationId: string, hotelId: string): Promise<string> {
    const hotel = await prisma.hotel.findFirst({
      where: {
        id: hotelId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, timezone: true },
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    return hotel.timezone;
  }

  // ==========================================================================
  // OCCUPANCY REPORT
  // ==========================================================================

  /**
   * Builds the occupancy report and high-level occupancy summary metrics.
   *
   * The method first validates organization/hotel scope, then executes a read-only
   * repository query and performs in-memory reductions for totals, weighted occupancy,
   * and peak occupancy detection. It does not write to the database or log.
   *
   * @param organizationId - Tenant organization scope for hotel validation.
   * @param hotelId - Hotel scope used by repository reads after validation.
   * @param dateFrom - Inclusive start date for the reporting window.
   * @param dateTo - Inclusive end date for the reporting window.
   * @param groupBy - Time bucket granularity for the occupancy series.
   * @param roomTypeId - Optional room-type filter applied downstream.
   * @returns Occupancy rows plus aggregate occupancy summary values.
   *
   * @remarks Complexity: O(n) for linear reductions across `n` returned rows.
   */
  async getOccupancyReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY',
    roomTypeId?: string
  ): Promise<OccupancyReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
      roomTypeId,
    };

    const rows = await this.repo.getOccupancyReport(filters);

    // Calculate summary
    const totalArrivals = rows.reduce((sum, row) => sum + row.arrivalsCount, 0);
    const totalDepartures = rows.reduce((sum, row) => sum + row.departuresCount, 0);
    const totalOccupied = rows.reduce((sum, row) => sum + row.occupiedRooms, 0);
    const rowCount = rows.length;

    // Find peak occupancy
    let peakOccupancyDate: Date | null = null;
    let peakOccupancyRate = new Decimal(0);
    for (const row of rows) {
      if (row.occupancyRate.greaterThan(peakOccupancyRate)) {
        peakOccupancyRate = row.occupancyRate;
        peakOccupancyDate = row.date;
      }
    }

    // Calculate average occupancy rate (weighted by total rooms)
    const totalRoomNights = rows.reduce((sum, row) => sum + row.totalRooms, 0);
    const totalOccupiedNights = rows.reduce((sum, row) => sum + row.occupiedRooms, 0);
    const avgOccupancyRate = safeDivide(new Decimal(totalOccupiedNights * 100), totalRoomNights);

    return {
      rows,
      summary: {
        avgOccupancyRate,
        totalArrivals,
        totalDepartures,
        avgOccupiedRooms: safeDivide(new Decimal(totalOccupied), rowCount),
        peakOccupancyDate,
        peakOccupancyRate,
      },
    };
  }

  // ==========================================================================
  // REVENUE REPORT
  // ==========================================================================

  /**
   * Builds a revenue report with per-period rows and consolidated totals.
   *
   * After organization/hotel validation, this method fetches scoped read-only data
   * from the repository and aggregates each revenue component with decimal-safe math.
   * No persistence operations or logging are performed.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope for revenue reads.
   * @param dateFrom - Inclusive start date for aggregation.
   * @param dateTo - Inclusive end date for aggregation.
   * @param groupBy - Period grouping (`DAY`, `WEEK`, `MONTH`).
   * @param roomTypeId - Optional room type filter for room-linked figures.
   * @returns Revenue rows and totalized summary fields.
   *
   * @remarks Complexity: O(n) for linear reductions across `n` report rows.
   */
  async getRevenueReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY',
    roomTypeId?: string
  ): Promise<RevenueReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
      roomTypeId,
    };

    const rows = await this.repo.getRevenueReport(filters);

    // Calculate summary totals
    const summary = {
      totalRoomRevenue: rows.reduce((sum, row) => sum.plus(row.roomRevenue), new Decimal(0)),
      totalFnbRevenue: rows.reduce((sum, row) => sum.plus(row.fnbRevenue), new Decimal(0)),
      totalSpaRevenue: rows.reduce((sum, row) => sum.plus(row.spaRevenue), new Decimal(0)),
      totalLaundryRevenue: rows.reduce((sum, row) => sum.plus(row.laundryRevenue), new Decimal(0)),
      totalOtherRevenue: rows.reduce((sum, row) => sum.plus(row.otherRevenue), new Decimal(0)),
      totalTaxCollected: rows.reduce((sum, row) => sum.plus(row.taxCollected), new Decimal(0)),
      totalDiscounts: rows.reduce((sum, row) => sum.plus(row.discounts), new Decimal(0)),
      grandTotalRevenue: rows.reduce((sum, row) => sum.plus(row.totalRevenue), new Decimal(0)),
      totalPaymentsReceived: rows.reduce(
        (sum, row) => sum.plus(row.paymentsReceived),
        new Decimal(0)
      ),
    };

    return { rows, summary };
  }

  // ==========================================================================
  // ADR REPORT
  // ==========================================================================

  /**
   * Builds the ADR (Average Daily Rate) report and period-level ADR summary.
   *
   * Validates organization/hotel scoping, reads ADR input rows through the repository,
   * then derives total room revenue, total rooms sold, and overall ADR in memory.
   * The method is read-only and emits no logs.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used by repository queries.
   * @param dateFrom - Inclusive ADR period start.
   * @param dateTo - Inclusive ADR period end.
   * @param groupBy - Bucket granularity for returned ADR rows.
   * @param roomTypeId - Optional room-type constraint.
   * @returns ADR rows plus period summary totals.
   *
   * @remarks Complexity: O(n) for linear reductions across `n` ADR rows.
   */
  async getADRReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY',
    roomTypeId?: string
  ): Promise<ADRReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
      roomTypeId,
    };

    const rows = await this.repo.getADRReport(filters);

    // Calculate summary
    const totalRoomRevenue = rows.reduce((sum, row) => sum.plus(row.roomRevenue), new Decimal(0));
    const totalRoomsSold = rows.reduce((sum, row) => sum + row.roomsSold, 0);
    const periodADR = safeDivide(totalRoomRevenue, totalRoomsSold);

    return {
      rows,
      summary: {
        totalRoomRevenue,
        totalRoomsSold,
        periodADR,
      },
    };
  }

  // ==========================================================================
  // REVPAR REPORT
  // ==========================================================================

  /**
   * Builds the RevPAR report and derived occupancy/ADR period metrics.
   *
   * Performs scoped hotel validation, fetches RevPAR source rows, and computes
   * aggregate KPIs (RevPAR, occupancy, ADR, average availability) from the returned
   * dataset. This path is read-only and does not perform application logging.
   *
   * @param organizationId - Organization scope used for hotel validation.
   * @param hotelId - Hotel scope used for report retrieval.
   * @param dateFrom - Inclusive start date for RevPAR metrics.
   * @param dateTo - Inclusive end date for RevPAR metrics.
   * @param groupBy - Requested grouping period for rows.
   * @param roomTypeId - Optional room-type filter.
   * @returns RevPAR rows and period summary values.
   *
   * @remarks Complexity: O(n) with multiple linear passes across `n` rows.
   */
  async getRevPARReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY',
    roomTypeId?: string
  ): Promise<RevPARReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
      roomTypeId,
    };

    const rows = await this.repo.getRevPARReport(filters);

    // Calculate summary
    const totalRoomRevenue = rows.reduce((sum, row) => sum.plus(row.roomRevenue), new Decimal(0));
    const totalAvailableRooms = rows.reduce((sum, row) => sum + row.availableRooms, 0);
    const rowCount = rows.length;

    // Sum up for occupancy and ADR calculation
    const totalOccupied = rows.reduce(
      (sum, row) => sum + Math.round(row.occupancyRate.mul(row.availableRooms).div(100).toNumber()),
      0
    );

    const avgAvailableRooms = safeDivide(new Decimal(totalAvailableRooms), rowCount);
    const periodRevPar = safeDivide(totalRoomRevenue, totalAvailableRooms);
    const periodOccupancyRate = safeDivide(new Decimal(totalOccupied * 100), totalAvailableRooms);
    const periodADR = safeDivide(totalRoomRevenue, totalOccupied);

    return {
      rows,
      summary: {
        totalRoomRevenue,
        avgAvailableRooms,
        periodRevPar,
        periodOccupancyRate,
        periodADR,
      },
    };
  }

  // ==========================================================================
  // FOLIO SUMMARY REPORT
  // ==========================================================================

  /**
   * Builds folio summary sections and computes cross-section grand totals.
   *
   * After scoped hotel validation, the method loads departmental/revenue-code/item-type
   * aggregates from the repository and derives total amount, tax, and transaction
   * counts by folding the department series.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for folio aggregation.
   * @param dateTo - Inclusive end date for folio aggregation.
   * @returns Folio summary breakdowns plus grand totals.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(d) where `d` is `byDepartment.length`; other sections are pass-through from repository output.
   */
  async getFolioSummary(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<FolioSummaryResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
    };

    const data = await this.repo.getFolioSummary(filters);

    // Calculate grand totals
    const grandTotal = {
      totalAmount: data.byDepartment.reduce((sum, d) => sum.plus(d.totalAmount), new Decimal(0)),
      totalTax: data.byDepartment.reduce((sum, d) => sum.plus(d.totalTax), new Decimal(0)),
      transactionCount: data.byDepartment.reduce((sum, d) => sum + d.transactionCount, 0),
    };

    return {
      byDepartment: data.byDepartment,
      byRevenueCode: data.byRevenueCode,
      byItemType: data.byItemType,
      grandTotal,
    };
  }

  // ==========================================================================
  // ARRIVALS/DEPARTURES REPORT
  // ==========================================================================

  /**
   * Builds arrivals/departures summary metrics from period rows.
   *
   * Validates organization/hotel scope, fetches movement rows grouped by the requested
   * period, then derives totals and average daily arrivals/departures.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @param groupBy - Grouping granularity for returned movement rows.
   * @returns Arrivals/departures rows plus aggregate summary metrics.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(n) reductions over `n` movement rows.
   */
  async getArrivalsDeporturesReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY'
  ): Promise<ArrivalsDeporturesResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
    };

    const rows = await this.repo.getArrivalsDeporturesReport(filters);

    // Calculate summary
    const totalArrivals = rows.reduce((sum, row) => sum + row.arrivals, 0);
    const totalDepartures = rows.reduce((sum, row) => sum + row.departures, 0);
    const totalNoShows = rows.reduce((sum, row) => sum + row.noShows, 0);
    const totalWalkins = rows.reduce((sum, row) => sum + row.walkins, 0);
    const rowCount = rows.length;

    return {
      rows,
      summary: {
        totalArrivals,
        totalDepartures,
        totalNoShows,
        totalWalkins,
        avgDailyArrivals: safeDivide(new Decimal(totalArrivals), rowCount),
        avgDailyDepartures: safeDivide(new Decimal(totalDepartures), rowCount),
      },
    };
  }

  // ==========================================================================
  // IN-HOUSE REPORT
  // ==========================================================================

  /**
   * Builds the in-house guest operational snapshot and summary counters.
   *
   * Resolves the effective snapshot date (defaults to current time), retrieves in-house
   * guest rows from the repository, then computes total balance, VIP guest count, and
   * unique occupied-room count.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param date - Optional snapshot date; defaults to now.
   * @param roomTypeId - Optional room-type filter for in-house rows.
   * @returns In-house guest rows plus high-level summary metrics.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(g) where `g` is guest row count.
   */
  async getInHouseReport(
    organizationId: string,
    hotelId: string,
    date?: Date,
    roomTypeId?: string
  ): Promise<InHouseReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const guests = await this.repo.getInHouseGuests({
      organizationId,
      hotelId,
      date: date ?? new Date(),
      roomTypeId,
    });

    // Calculate summary
    const totalBalance = guests.reduce((sum, g) => sum.plus(g.balance), new Decimal(0));
    const vipCount = guests.filter((g) => g.vipStatus !== 'NONE').length;

    // Count unique rooms
    const uniqueRooms = new Set(guests.map((g) => g.roomNumber));

    return {
      guests,
      summary: {
        totalGuests: guests.length,
        totalRooms: uniqueRooms.size,
        totalBalance,
        vipCount,
      },
    };
  }

  // ==========================================================================
  // NO-SHOW REPORT
  // ==========================================================================

  /**
   * Retrieves the scoped no-show analytics payload.
   *
   * This service path validates hotel scope and forwards the request filters directly
   * to repository-level aggregation logic without additional transformations.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for no-show analysis.
   * @param dateTo - Inclusive end date for no-show analysis.
   * @param groupBy - Grouping hint forwarded to repository analytics.
   * @returns No-show detail rows, breakdowns, and summary from repository.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer work; database complexity is fully in repository execution.
   */
  async getNoShowReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY'
  ): Promise<NoShowReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
    };

    return this.repo.getNoShowReport(filters);
  }

  // ==========================================================================
  // GUEST STATISTICS REPORT
  // ==========================================================================

  /**
   * Retrieves guest statistics for the scoped date window.
   *
   * Performs organization/hotel validation and delegates all guest-statistics
   * aggregation to the repository.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for guest statistics.
   * @param dateTo - Inclusive end date for guest statistics.
   * @returns Guest statistics payload from repository aggregations.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer work; aggregation cost is handled in repository queries.
   */
  async getGuestStatistics(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<GuestStatisticsResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
    };

    return this.repo.getGuestStatistics(filters);
  }

  // ==========================================================================
  // SOURCE ANALYSIS REPORT
  // ==========================================================================

  /**
   * Builds source-analysis summary metrics from repository channel rows.
   *
   * After scope validation, this method retrieves source-level analytics and derives
   * overall reservation, room-night, revenue, no-show, and cancellation rates.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for source analysis.
   * @param dateTo - Inclusive end date for source analysis.
   * @returns Source rows, channel distribution, and overall summary metrics.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(s) reductions over `s` source rows returned by repository analytics.
   */
  async getSourceAnalysis(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<SourceAnalysisResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
    };

    const data = await this.repo.getSourceAnalysis(filters);

    // Calculate summary
    const totalReservations = data.rows.reduce((sum, row) => sum + row.reservationCount, 0);
    const totalRoomNights = data.rows.reduce((sum, row) => sum + row.roomNights, 0);
    const totalRevenue = data.rows.reduce((sum, row) => sum.plus(row.totalRevenue), new Decimal(0));
    const totalNoShows = data.rows.reduce((sum, row) => sum + row.noShowCount, 0);
    const totalCancellations = data.rows.reduce((sum, row) => sum + row.cancellationCount, 0);

    return {
      rows: data.rows,
      channelDistribution: data.channelDistribution,
      summary: {
        totalReservations,
        totalRoomNights,
        totalRevenue,
        overallADR: safeDivide(totalRevenue, totalRoomNights),
        overallNoShowRate: safeDivide(new Decimal(totalNoShows * 100), totalReservations),
        overallCancellationRate: safeDivide(
          new Decimal(totalCancellations * 100),
          totalReservations
        ),
      },
    };
  }

  // ==========================================================================
  // REPEAT GUESTS REPORT
  // ==========================================================================

  /**
   * Builds the repeat-guests response with pagination and aggregate summary.
   *
   * Validates scope, fetches paginated repeat-guest rows, and derives summary metrics
   * for average stays and average revenue per guest on the current page.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for repeat-guest qualification.
   * @param dateTo - Inclusive end date for repeat-guest qualification.
   * @param page - 1-based page index for guest rows.
   * @param limit - Maximum row count per page.
   * @param minStays - Minimum historical stays required to qualify as repeat guest.
   * @returns Paginated repeat guests and summary metrics.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(g) where `g` is the number of guests on the returned page.
   */
  async getRepeatGuests(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    page: number = 1,
    limit: number = 20,
    minStays: number = 2
  ): Promise<RepeatGuestsResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: RepeatGuestsFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      page,
      limit,
      minStays,
    };

    const data = await this.repo.getRepeatGuests(filters);

    // Calculate summary
    const totalRepeatGuests = data.pagination.total;
    const totalStays = data.guests.reduce((sum, g) => sum + g.totalStays, 0);
    const totalRevenue = data.guests.reduce((sum, g) => sum.plus(g.totalRevenue), new Decimal(0));
    const guestCount = data.guests.length;

    return {
      guests: data.guests,
      pagination: data.pagination,
      summary: {
        totalRepeatGuests,
        avgStaysPerGuest: safeDivide(new Decimal(totalStays), guestCount),
        avgRevenuePerGuest: safeDivide(totalRevenue, guestCount),
      },
    };
  }

  // ==========================================================================
  // HOUSEKEEPING REPORT
  // ==========================================================================

  /**
   * Builds housekeeping operational summaries from row-level productivity metrics.
   *
   * After scoped validation, it retrieves housekeeping rows and staff productivity,
   * then computes totals, completion rate, and nullable overall averages for
   * completion minutes and inspection scores.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for housekeeping analytics.
   * @param dateTo - Inclusive end date for housekeeping analytics.
   * @param groupBy - Grouping granularity for returned housekeeping rows.
   * @returns Housekeeping rows, staff productivity rows, and consolidated summary.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(r + s) where `r` is housekeeping-row count and `s` is staff-productivity row count.
   */
  async getHousekeepingReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date,
    groupBy: GroupByPeriod = 'DAY'
  ): Promise<HousekeepingReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
      groupBy,
    };

    const data = await this.repo.getHousekeepingReport(filters);

    // Calculate summary
    const totalTasksCreated = data.rows.reduce((sum, row) => sum + row.tasksCreated, 0);
    const totalTasksCompleted = data.rows.reduce((sum, row) => sum + row.tasksCompleted, 0);
    const totalTasksCancelled = data.rows.reduce((sum, row) => sum + row.tasksCancelled, 0);
    const totalIssuesReported = data.rows.reduce((sum, row) => sum + row.issuesReported, 0);

    // Calculate overall averages
    const completionMinutesSum = data.rows.reduce(
      (sum, row) => (row.avgCompletionMinutes ? sum.plus(row.avgCompletionMinutes) : sum),
      new Decimal(0)
    );
    const completionMinutesCount = data.rows.filter((r) => r.avgCompletionMinutes !== null).length;

    const inspectionScoreSum = data.rows.reduce(
      (sum, row) => (row.avgInspectionScore ? sum.plus(row.avgInspectionScore) : sum),
      new Decimal(0)
    );
    const inspectionScoreCount = data.rows.filter((r) => r.avgInspectionScore !== null).length;

    const completionRate = safeDivide(new Decimal(totalTasksCompleted * 100), totalTasksCreated);

    return {
      rows: data.rows,
      staffProductivity: data.staffProductivity,
      summary: {
        totalTasksCreated,
        totalTasksCompleted,
        totalTasksCancelled,
        overallAvgCompletionMinutes:
          completionMinutesCount > 0
            ? safeDivide(completionMinutesSum, completionMinutesCount)
            : null,
        overallAvgInspectionScore:
          inspectionScoreCount > 0 ? safeDivide(inspectionScoreSum, inspectionScoreCount) : null,
        totalIssuesReported,
        completionRate,
      },
    };
  }

  // ==========================================================================
  // MAINTENANCE REPORT
  // ==========================================================================

  /**
   * Retrieves scoped maintenance analytics.
   *
   * Performs hotel validation and delegates full maintenance aggregation to the
   * repository without additional service-level reshaping.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for report reads.
   * @param dateFrom - Inclusive start date for maintenance analytics.
   * @param dateTo - Inclusive end date for maintenance analytics.
   * @returns Maintenance analytics payload from repository.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer work; query complexity is handled by repository execution.
   */
  async getMaintenanceReport(
    organizationId: string,
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<MaintenanceReportResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: BaseReportFilters = {
      organizationId,
      hotelId,
      dateFrom,
      dateTo,
    };

    return this.repo.getMaintenanceReport(filters);
  }

  // ==========================================================================
  // MANAGER DASHBOARD
  // ==========================================================================

  /**
   * Retrieves the manager dashboard for the requested (or current) date.
   *
   * Validates scoped hotel access, normalizes an optional date fallback, and
   * delegates dashboard composition to repository-level analytics.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for dashboard reads.
   * @param date - Optional dashboard reference date; defaults to now.
   * @returns Manager dashboard payload.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer orchestration; heavy aggregation executes in repository queries.
   */
  async getManagerDashboard(
    organizationId: string,
    hotelId: string,
    date?: Date
  ): Promise<ManagerDashboardResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: DashboardFilters = {
      organizationId,
      hotelId,
      date: date ?? new Date(),
    };

    return this.repo.getManagerDashboard(filters);
  }

  // ==========================================================================
  // REVENUE DASHBOARD
  // ==========================================================================

  /**
   * Retrieves the revenue dashboard for the requested (or current) date.
   *
   * Performs scoped hotel validation, applies default date resolution, and
   * delegates all revenue dashboard aggregation to the repository.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for dashboard reads.
   * @param date - Optional dashboard reference date; defaults to now.
   * @returns Revenue dashboard payload.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer orchestration; report aggregation complexity is in repository helpers.
   */
  async getRevenueDashboard(
    organizationId: string,
    hotelId: string,
    date?: Date
  ): Promise<RevenueDashboardResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: DashboardFilters = {
      organizationId,
      hotelId,
      date: date ?? new Date(),
    };

    return this.repo.getRevenueDashboard(filters);
  }

  // ==========================================================================
  // OPERATIONS DASHBOARD
  // ==========================================================================

  /**
   * Retrieves the operations dashboard for the requested (or current) date.
   *
   * Validates organization/hotel scope, applies default date resolution, and
   * delegates operational KPI aggregation to repository queries.
   *
   * @param organizationId - Tenant organization scope for validation.
   * @param hotelId - Hotel scope used for dashboard reads.
   * @param date - Optional dashboard reference date; defaults to now.
   * @returns Operations dashboard payload.
   * @throws {NotFoundError} When the hotel is missing or outside organization scope.
   * @remarks Complexity: O(1) service-layer orchestration; runtime is dominated by repository SQL aggregates.
   */
  async getOperationsDashboard(
    organizationId: string,
    hotelId: string,
    date?: Date
  ): Promise<OperationsDashboardResponse> {
    await this.validateHotel(organizationId, hotelId);

    const filters: DashboardFilters = {
      organizationId,
      hotelId,
      date: date ?? new Date(),
    };

    return this.repo.getOperationsDashboard(filters);
  }
}

export const reportsService = new ReportsService();
