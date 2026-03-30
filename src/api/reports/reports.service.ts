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
 * Safe division that returns 0 when divisor is 0
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
  constructor(private repo: ReportsRepository = reportsRepository) {}

  // ==========================================================================
  // HOTEL VALIDATION
  // ==========================================================================

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
