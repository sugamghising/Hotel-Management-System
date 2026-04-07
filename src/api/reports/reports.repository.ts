// ============================================================================
// REPORTS MODULE - REPOSITORY (Database Layer)
// ============================================================================

import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
import type {
  AlertEntityType,
  BaseReportFilters,
  DashboardFilters,
  GroupByPeriod,
  RepeatGuestsFilters,
} from './reports.types';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolves the SQL date-expression fragment used for report grouping.
 *
 * @param groupBy - Requested report period (`'DAY'`, `'WEEK'`, or `'MONTH'`).
 * @returns SQL expression string used inside raw-query `SELECT/GROUP BY` clauses.
 */
function getDateTruncExpression(groupBy: GroupByPeriod): string {
  switch (groupBy) {
    case 'WEEK':
      return `DATE_TRUNC('week', business_date)`;
    case 'MONTH':
      return `DATE_TRUNC('month', business_date)`;
    default:
      return 'business_date';
  }
}

/**
 * Divides decimals while guarding against divide-by-zero outcomes.
 *
 * @param numerator - Decimal numerator value.
 * @param divisor - Decimal or numeric denominator value.
 * @returns `numerator / divisor`, or `0` when the divisor is zero.
 */
function safeDivide(numerator: Decimal, divisor: Decimal | number): Decimal {
  const divisorDecimal = typeof divisor === 'number' ? new Decimal(divisor) : divisor;
  if (divisorDecimal.isZero()) {
    return new Decimal(0);
  }
  return numerator.div(divisorDecimal);
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class ReportsRepository {
  // ==========================================================================
  // OCCUPANCY REPORT
  // ==========================================================================

  /**
   * Aggregates occupancy metrics across a date range with optional room-type scoping.
   *
   * Builds a generated date series, joins reservations and room inventory, then
   * rolls daily results into requested period buckets (`DAY`, `WEEK`, `MONTH`)
   * including arrivals, departures, and out-of-order room impact.
   *
   * @param filters - Hotel/date filters with optional grouping and room type.
   * @returns Occupancy rows containing room counts, rate, arrivals, and departures.
   * @remarks Complexity: O(d + r) in database execution where `d` is day count in range and `r` is joined reservation-room rows.
   */
  async getOccupancyReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY', roomTypeId } = filters;
    const dateExpr = getDateTruncExpression(groupBy);

    const roomTypeFilter = roomTypeId ? Prisma.sql`AND rt.id = ${roomTypeId}::uuid` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        total_rooms: bigint;
        occupied_rooms: bigint;
        ooo_rooms: bigint;
        arrivals_count: bigint;
        departures_count: bigint;
      }>
    >`
      WITH date_series AS (
        SELECT generate_series(
          ${dateFrom}::date,
          ${dateTo}::date,
          '1 day'::interval
        )::date AS date
      ),
      room_counts AS (
        SELECT 
          COUNT(*) AS total_rooms,
          COUNT(*) FILTER (WHERE r.is_out_of_order = true) AS ooo_rooms
        FROM rooms r
        JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.hotel_id = ${hotelId}::uuid
          AND r.deleted_at IS NULL
          ${roomTypeFilter}
      ),
      daily_occupancy AS (
        SELECT 
          ds.date,
          rc.total_rooms,
          rc.ooo_rooms,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date <= ds.date 
              AND res.check_out_date > ds.date
              AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          ) AS occupied_rooms,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date = ds.date
              AND res.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
          ) AS arrivals_count,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_out_date = ds.date
              AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          ) AS departures_count
        FROM date_series ds
        CROSS JOIN room_counts rc
        LEFT JOIN reservations res ON res.hotel_id = ${hotelId}::uuid
          AND res.deleted_at IS NULL
        LEFT JOIN reservation_rooms rr ON rr.reservation_id = res.id
        LEFT JOIN room_types rt ON rr.room_type_id = rt.id
        WHERE 1=1 ${roomTypeFilter}
        GROUP BY ds.date, rc.total_rooms, rc.ooo_rooms
      )
      SELECT 
        ${Prisma.raw(dateExpr)} AS date,
        SUM(total_rooms)::bigint AS total_rooms,
        SUM(occupied_rooms)::bigint AS occupied_rooms,
        SUM(ooo_rooms)::bigint AS ooo_rooms,
        SUM(arrivals_count)::bigint AS arrivals_count,
        SUM(departures_count)::bigint AS departures_count
      FROM daily_occupancy
      GROUP BY ${Prisma.raw(dateExpr)}
      ORDER BY date
    `;

    return rows.map((row) => {
      const totalRooms = Number(row.total_rooms);
      const occupiedRooms = Number(row.occupied_rooms);
      const oooRooms = Number(row.ooo_rooms);
      const availableRooms = totalRooms - oooRooms;

      return {
        date: row.date,
        totalRooms,
        occupiedRooms,
        availableRooms,
        oooRooms,
        occupancyRate: safeDivide(new Decimal(occupiedRooms * 100), totalRooms),
        arrivalsCount: Number(row.arrivals_count),
        departuresCount: Number(row.departures_count),
      };
    });
  }

  // ==========================================================================
  // REVENUE REPORT
  // ==========================================================================

  /**
   * Produces departmental revenue aggregates and captured-payment totals.
   *
   * Uses CTEs to aggregate folio revenue categories and payment captures, then
   * full-joins both streams by date bucket so periods with only one source are
   * still represented in the result set.
   *
   * @param filters - Hotel/date filters with optional period grouping.
   * @returns Revenue rows with room/F&B/spa/laundry/other components and totals.
   * @remarks Complexity: O(f + p) in database scans where `f` is matching folio items and `p` is matching payments.
   */
  async getRevenueReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY' } = filters;
    const dateExpr = getDateTruncExpression(groupBy);

    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        room_revenue: Decimal;
        fnb_revenue: Decimal;
        spa_revenue: Decimal;
        laundry_revenue: Decimal;
        other_revenue: Decimal;
        tax_collected: Decimal;
        discounts: Decimal;
        payments_received: Decimal;
      }>
    >`
      WITH folio_data AS (
        SELECT 
          ${Prisma.raw(dateExpr)} AS date,
          SUM(amount) FILTER (WHERE item_type = 'ROOM_CHARGE') AS room_revenue,
          SUM(amount) FILTER (WHERE item_type = 'POS_CHARGE') AS fnb_revenue,
          SUM(amount) FILTER (WHERE item_type = 'SPA') AS spa_revenue,
          SUM(amount) FILTER (WHERE item_type = 'LAUNDRY') AS laundry_revenue,
          SUM(amount) FILTER (
            WHERE item_type NOT IN ('ROOM_CHARGE', 'POS_CHARGE', 'SPA', 'LAUNDRY', 'TAX', 'DISCOUNT', 'PAYMENT', 'REFUND')
          ) AS other_revenue,
          SUM(amount) FILTER (WHERE item_type = 'TAX') AS tax_collected,
          ABS(SUM(amount) FILTER (WHERE item_type = 'DISCOUNT')) AS discounts
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date >= ${dateFrom}::date
          AND business_date <= ${dateTo}::date
          AND is_voided = false
        GROUP BY ${Prisma.raw(dateExpr)}
      ),
      payment_data AS (
        SELECT 
          ${Prisma.raw(`DATE_TRUNC('${groupBy === 'DAY' ? 'day' : groupBy.toLowerCase()}', processed_at)`)} AS date,
          SUM(amount) AS payments_received
        FROM payments
        WHERE hotel_id = ${hotelId}::uuid
          AND processed_at >= ${dateFrom}::date
          AND processed_at <= ${dateTo}::date + interval '1 day'
          AND status = 'CAPTURED'
          AND is_refund = false
        GROUP BY 1
      )
      SELECT 
        COALESCE(f.date, p.date) AS date,
        COALESCE(f.room_revenue, 0) AS room_revenue,
        COALESCE(f.fnb_revenue, 0) AS fnb_revenue,
        COALESCE(f.spa_revenue, 0) AS spa_revenue,
        COALESCE(f.laundry_revenue, 0) AS laundry_revenue,
        COALESCE(f.other_revenue, 0) AS other_revenue,
        COALESCE(f.tax_collected, 0) AS tax_collected,
        COALESCE(f.discounts, 0) AS discounts,
        COALESCE(p.payments_received, 0) AS payments_received
      FROM folio_data f
      FULL OUTER JOIN payment_data p ON f.date = p.date
      ORDER BY date
    `;

    return rows.map((row) => ({
      date: row.date,
      roomRevenue: new Decimal(row.room_revenue ?? 0),
      fnbRevenue: new Decimal(row.fnb_revenue ?? 0),
      spaRevenue: new Decimal(row.spa_revenue ?? 0),
      laundryRevenue: new Decimal(row.laundry_revenue ?? 0),
      otherRevenue: new Decimal(row.other_revenue ?? 0),
      taxCollected: new Decimal(row.tax_collected ?? 0),
      discounts: new Decimal(row.discounts ?? 0),
      totalRevenue: new Decimal(row.room_revenue ?? 0)
        .plus(row.fnb_revenue ?? 0)
        .plus(row.spa_revenue ?? 0)
        .plus(row.laundry_revenue ?? 0)
        .plus(row.other_revenue ?? 0),
      paymentsReceived: new Decimal(row.payments_received ?? 0),
    }));
  }

  // ==========================================================================
  // ADR REPORT
  // ==========================================================================

  /**
   * Calculates ADR (average daily rate) trends for sold rooms.
   *
   * Aggregates room-charge revenue and sold-room counts per period, computes ADR,
   * and when grouped by day also calculates a 7-day rolling ADR average.
   *
   * @param filters - Hotel/date filters with optional grouping period.
   * @returns ADR rows including optional 7-day rolling average for daily mode.
   * @remarks Complexity: O(n) post-query mapping where `n` is grouped period row count.
   */
  async getADRReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY' } = filters;
    const dateExpr = getDateTruncExpression(groupBy);

    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        room_revenue: Decimal;
        rooms_sold: bigint;
      }>
    >`
      WITH daily_data AS (
        SELECT 
          ${Prisma.raw(dateExpr)} AS date,
          SUM(fi.amount) AS room_revenue,
          COUNT(DISTINCT res.id) AS rooms_sold
        FROM folio_items fi
        JOIN reservations res ON fi.reservation_id = res.id
        WHERE fi.hotel_id = ${hotelId}::uuid
          AND fi.business_date >= ${dateFrom}::date
          AND fi.business_date <= ${dateTo}::date
          AND fi.item_type = 'ROOM_CHARGE'
          AND fi.is_voided = false
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
        GROUP BY ${Prisma.raw(dateExpr)}
        ORDER BY date
      )
      SELECT 
        date,
        COALESCE(room_revenue, 0) AS room_revenue,
        COALESCE(rooms_sold, 0) AS rooms_sold
      FROM daily_data
    `;

    return rows.map((row, index, arr) => {
      const roomRevenue = new Decimal(row.room_revenue ?? 0);
      const roomsSold = Number(row.rooms_sold);
      const adr = safeDivide(roomRevenue, roomsSold);

      // Calculate 7-day rolling average
      let rollingAvg7Day: Decimal | null = null;
      if (groupBy === 'DAY' && index >= 6) {
        const last7 = arr.slice(index - 6, index + 1);
        const totalRevenue = last7.reduce(
          (sum, r) => sum.plus(r.room_revenue ?? 0),
          new Decimal(0)
        );
        const totalSold = last7.reduce((sum, r) => sum + Number(r.rooms_sold), 0);
        rollingAvg7Day = safeDivide(totalRevenue, totalSold);
      }

      return {
        date: row.date,
        roomRevenue,
        roomsSold,
        adr,
        rollingAvg7Day,
      };
    });
  }

  // ==========================================================================
  // REVPAR REPORT
  // ==========================================================================

  /**
   * Computes RevPAR, ADR, and occupancy using revenue plus room availability.
   *
   * Combines room-charge revenue, sold-room counts, and available room inventory
   * (optionally scoped by room type) to derive RevPAR and related KPIs per period.
   *
   * @param filters - Hotel/date filters, grouping period, and optional room type.
   * @returns RevPAR rows with room revenue, availability, ADR, and occupancy rate.
   * @remarks Complexity: O(d + r) in database execution where `d` is grouped dates and `r` is joined folio/reservation rows.
   */
  async getRevPARReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY', roomTypeId } = filters;
    const dateExpr = getDateTruncExpression(groupBy);

    const roomTypeFilter = roomTypeId ? Prisma.sql`AND rt.id = ${roomTypeId}::uuid` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        room_revenue: Decimal;
        rooms_sold: bigint;
        available_rooms: bigint;
      }>
    >`
      WITH date_series AS (
        SELECT generate_series(
          ${dateFrom}::date,
          ${dateTo}::date,
          '1 day'::interval
        )::date AS date
      ),
      room_counts AS (
        SELECT 
          COUNT(*) FILTER (WHERE r.is_out_of_order = false) AS available_rooms
        FROM rooms r
        JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.hotel_id = ${hotelId}::uuid
          AND r.deleted_at IS NULL
          ${roomTypeFilter}
      ),
      daily_revenue AS (
        SELECT 
          ${Prisma.raw(dateExpr)} AS date,
          SUM(fi.amount) AS room_revenue,
          COUNT(DISTINCT res.id) AS rooms_sold
        FROM folio_items fi
        JOIN reservations res ON fi.reservation_id = res.id
        LEFT JOIN reservation_rooms rr ON rr.reservation_id = res.id
        LEFT JOIN room_types rt ON rr.room_type_id = rt.id
        WHERE fi.hotel_id = ${hotelId}::uuid
          AND fi.business_date >= ${dateFrom}::date
          AND fi.business_date <= ${dateTo}::date
          AND fi.item_type = 'ROOM_CHARGE'
          AND fi.is_voided = false
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          ${roomTypeFilter}
        GROUP BY ${Prisma.raw(dateExpr)}
      )
      SELECT 
        dr.date,
        COALESCE(dr.room_revenue, 0) AS room_revenue,
        COALESCE(dr.rooms_sold, 0) AS rooms_sold,
        rc.available_rooms
      FROM daily_revenue dr
      CROSS JOIN room_counts rc
      ORDER BY dr.date
    `;

    return rows.map((row) => {
      const roomRevenue = new Decimal(row.room_revenue ?? 0);
      const roomsSold = Number(row.rooms_sold);
      const availableRooms = Number(row.available_rooms);

      const revPar = safeDivide(roomRevenue, availableRooms);
      const adr = safeDivide(roomRevenue, roomsSold);
      const occupancyRate = safeDivide(new Decimal(roomsSold * 100), availableRooms);

      return {
        date: row.date,
        roomRevenue,
        availableRooms,
        revPar,
        occupancyRate,
        adr,
      };
    });
  }

  // ==========================================================================
  // FOLIO SUMMARY REPORT
  // ==========================================================================

  /**
   * Summarizes non-payment folio activity across three accounting dimensions.
   *
   * Executes department, revenue-code, and item-type aggregates in parallel and
   * returns Decimal-safe totals plus transaction counts for each breakdown.
   *
   * @param filters - Hotel/date filters defining the business-date window.
   * @returns Grouped folio summaries by department, revenue code, and item type.
   * @remarks Complexity: O(gd + gr + gi) where each term is grouped row count from the three aggregate queries.
   */
  async getFolioSummary(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo } = filters;

    const [byDepartment, byRevenueCode, byItemType] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          department: string;
          total_amount: Decimal;
          total_tax: Decimal;
          transaction_count: bigint;
        }>
      >`
        SELECT 
          department,
          SUM(amount) AS total_amount,
          SUM(tax_amount) AS total_tax,
          COUNT(*) AS transaction_count
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date >= ${dateFrom}::date
          AND business_date <= ${dateTo}::date
          AND is_voided = false
          AND item_type NOT IN ('PAYMENT', 'REFUND')
        GROUP BY department
        ORDER BY total_amount DESC
      `,

      prisma.$queryRaw<
        Array<{
          revenue_code: string;
          total_amount: Decimal;
          total_tax: Decimal;
          transaction_count: bigint;
        }>
      >`
        SELECT 
          revenue_code,
          SUM(amount) AS total_amount,
          SUM(tax_amount) AS total_tax,
          COUNT(*) AS transaction_count
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date >= ${dateFrom}::date
          AND business_date <= ${dateTo}::date
          AND is_voided = false
          AND item_type NOT IN ('PAYMENT', 'REFUND')
        GROUP BY revenue_code
        ORDER BY total_amount DESC
      `,

      prisma.$queryRaw<
        Array<{
          item_type: string;
          total_amount: Decimal;
          total_tax: Decimal;
          transaction_count: bigint;
        }>
      >`
        SELECT 
          item_type,
          SUM(amount) AS total_amount,
          SUM(tax_amount) AS total_tax,
          COUNT(*) AS transaction_count
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date >= ${dateFrom}::date
          AND business_date <= ${dateTo}::date
          AND is_voided = false
          AND item_type NOT IN ('PAYMENT', 'REFUND')
        GROUP BY item_type
        ORDER BY total_amount DESC
      `,
    ]);

    return {
      byDepartment: byDepartment.map((row) => ({
        department: row.department,
        totalAmount: new Decimal(row.total_amount),
        totalTax: new Decimal(row.total_tax),
        transactionCount: Number(row.transaction_count),
      })),
      byRevenueCode: byRevenueCode.map((row) => ({
        revenueCode: row.revenue_code,
        totalAmount: new Decimal(row.total_amount),
        totalTax: new Decimal(row.total_tax),
        transactionCount: Number(row.transaction_count),
      })),
      byItemType: byItemType.map((row) => ({
        itemType: row.item_type,
        totalAmount: new Decimal(row.total_amount),
        totalTax: new Decimal(row.total_tax),
        transactionCount: Number(row.transaction_count),
      })),
    };
  }

  // ==========================================================================
  // ARRIVALS/DEPARTURES REPORT
  // ==========================================================================

  /**
   * Aggregates arrivals/departures movement metrics across a date range.
   *
   * Generates a daily series, computes arrivals, departures, no-shows, walk-ins,
   * and stayovers per day, then rolls those values into the requested period.
   *
   * @param filters - Hotel/date filters with optional period grouping.
   * @returns Movement rows for arrivals, departures, no-shows, walk-ins, and stayovers.
   * @remarks Complexity: O(d + r) in database execution where `d` is date-series length and `r` is joined reservation rows.
   */
  async getArrivalsDeporturesReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY' } = filters;
    const dateExpr = groupBy === 'DAY' ? 'date' : `DATE_TRUNC('${groupBy.toLowerCase()}', date)`;

    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        arrivals: bigint;
        departures: bigint;
        no_shows: bigint;
        walkins: bigint;
        stayovers: bigint;
      }>
    >`
      WITH date_series AS (
        SELECT generate_series(
          ${dateFrom}::date,
          ${dateTo}::date,
          '1 day'::interval
        )::date AS date
      ),
      daily_stats AS (
        SELECT 
          ds.date,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date = ds.date 
              AND res.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
          ) AS arrivals,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_out_date = ds.date 
              AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          ) AS departures,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date = ds.date 
              AND res.status = 'NO_SHOW'
          ) AS no_shows,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date = ds.date 
              AND res.source = 'DIRECT_WALKIN'
              AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          ) AS walkins,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date < ds.date 
              AND res.check_out_date > ds.date
              AND res.status = 'CHECKED_IN'
          ) AS stayovers
        FROM date_series ds
        LEFT JOIN reservations res ON res.hotel_id = ${hotelId}::uuid
          AND res.deleted_at IS NULL
        GROUP BY ds.date
      )
      SELECT 
        ${Prisma.raw(dateExpr)} AS date,
        SUM(arrivals)::bigint AS arrivals,
        SUM(departures)::bigint AS departures,
        SUM(no_shows)::bigint AS no_shows,
        SUM(walkins)::bigint AS walkins,
        SUM(stayovers)::bigint AS stayovers
      FROM daily_stats
      GROUP BY ${Prisma.raw(dateExpr)}
      ORDER BY date
    `;

    return rows.map((row) => ({
      date: row.date,
      arrivals: Number(row.arrivals),
      departures: Number(row.departures),
      noShows: Number(row.no_shows),
      walkins: Number(row.walkins),
      stayovers: Number(row.stayovers),
    }));
  }

  // ==========================================================================
  // IN-HOUSE REPORT
  // ==========================================================================

  /**
   * Lists in-house guest stays for an operational snapshot date.
   *
   * Joins reservations, guests, room assignments, room types, and rate plans to
   * return currently in-house guests with stay and balance context.
   *
   * @param filters - Hotel/date filters with optional room-type scoping.
   * @returns In-house guest rows with room, stay, and profile attributes.
   * @remarks Complexity: O(n) where `n` is in-house reservation row count returned by the query.
   */
  async getInHouseGuests(filters: DashboardFilters & { roomTypeId?: string | undefined }) {
    const { hotelId, date, roomTypeId } = filters;

    const roomTypeFilter = roomTypeId ? Prisma.sql`AND rt.id = ${roomTypeId}::uuid` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        reservation_id: string;
        guest_name: string;
        room_number: string;
        check_in_date: Date;
        check_out_date: Date;
        nights: number;
        balance: Decimal;
        vip_status: string;
        room_type_name: string;
        rate_plan_name: string;
      }>
    >`
      SELECT 
        res.id AS reservation_id,
        CONCAT(g.first_name, ' ', g.last_name) AS guest_name,
        r.room_number,
        res.check_in_date,
        res.check_out_date,
        res.nights,
        res.balance,
        g.vip_status,
        rt.name AS room_type_name,
        rp.name AS rate_plan_name
      FROM reservations res
      JOIN guests g ON res.guest_id = g.id
      LEFT JOIN reservation_rooms rr ON rr.reservation_id = res.id
      LEFT JOIN rooms r ON rr.room_id = r.id
      LEFT JOIN room_types rt ON rr.room_type_id = rt.id
      LEFT JOIN rate_plans rp ON res.rate_plan_id = rp.id
      WHERE res.hotel_id = ${hotelId}::uuid
        AND res.status = 'CHECKED_IN'
        AND res.check_in_date <= ${date}::date
        AND res.check_out_date > ${date}::date
        AND res.deleted_at IS NULL
        ${roomTypeFilter}
      ORDER BY r.room_number
    `;

    return rows.map((row) => ({
      reservationId: row.reservation_id,
      guestName: row.guest_name,
      roomNumber: row.room_number,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      nights: row.nights,
      balance: new Decimal(row.balance),
      vipStatus: row.vip_status,
      roomType: row.room_type_name,
      ratePlanName: row.rate_plan_name,
    }));
  }

  // ==========================================================================
  // NO-SHOW REPORT
  // ==========================================================================

  /**
   * Produces no-show detail and distribution analytics for a date window.
   *
   * Runs five aggregate/detail queries in parallel (rows, source mix, room-type
   * mix, day-of-week distribution, and summary totals) and combines them into one
   * structured no-show analytics payload.
   *
   * @param filters - Hotel/date filters bounding check-in dates.
   * @returns No-show detail rows, breakdowns, and summary KPIs.
   * @remarks Complexity: O(r + s + t + w) where terms are result sizes of detail, source, room-type, and weekday aggregates.
   */
  async getNoShowReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo } = filters;

    const [rows, bySource, byRoomType, byDayOfWeek, summary] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          reservation_id: string;
          confirmation_number: string;
          guest_name: string;
          room_type_name: string;
          check_in_date: Date;
          total_amount: Decimal;
          cancellation_fee: Decimal;
          source: string;
        }>
      >`
        SELECT 
          res.id AS reservation_id,
          res.confirmation_number,
          CONCAT(g.first_name, ' ', g.last_name) AS guest_name,
          rt.name AS room_type_name,
          res.check_in_date,
          res.total_amount,
          COALESCE(res.cancellation_fee, 0) AS cancellation_fee,
          res.source::text
        FROM reservations res
        JOIN guests g ON res.guest_id = g.id
        LEFT JOIN reservation_rooms rr ON rr.reservation_id = res.id
        LEFT JOIN room_types rt ON rr.room_type_id = rt.id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status = 'NO_SHOW'
          AND res.deleted_at IS NULL
        ORDER BY res.check_in_date DESC
      `,

      prisma.$queryRaw<Array<{ source: string; count: bigint; total_amount: Decimal }>>`
        SELECT 
          source::text,
          COUNT(*) AS count,
          SUM(total_amount) AS total_amount
        FROM reservations
        WHERE hotel_id = ${hotelId}::uuid
          AND check_in_date >= ${dateFrom}::date
          AND check_in_date <= ${dateTo}::date
          AND status = 'NO_SHOW'
          AND deleted_at IS NULL
        GROUP BY source
        ORDER BY count DESC
      `,

      prisma.$queryRaw<Array<{ room_type_name: string; count: bigint }>>`
        SELECT 
          rt.name AS room_type_name,
          COUNT(*) AS count
        FROM reservations res
        LEFT JOIN reservation_rooms rr ON rr.reservation_id = res.id
        LEFT JOIN room_types rt ON rr.room_type_id = rt.id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status = 'NO_SHOW'
          AND res.deleted_at IS NULL
        GROUP BY rt.name
        ORDER BY count DESC
      `,

      prisma.$queryRaw<Array<{ day_of_week: number; count: bigint }>>`
        SELECT 
          EXTRACT(DOW FROM check_in_date)::int AS day_of_week,
          COUNT(*) AS count
        FROM reservations
        WHERE hotel_id = ${hotelId}::uuid
          AND check_in_date >= ${dateFrom}::date
          AND check_in_date <= ${dateTo}::date
          AND status = 'NO_SHOW'
          AND deleted_at IS NULL
        GROUP BY EXTRACT(DOW FROM check_in_date)
        ORDER BY day_of_week
      `,

      prisma.$queryRaw<
        Array<{
          total_no_shows: bigint;
          total_expected_arrivals: bigint;
          total_lost_revenue: Decimal;
          total_cancellation_fees: Decimal;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'NO_SHOW') AS total_no_shows,
          COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW')) AS total_expected_arrivals,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'NO_SHOW'), 0) AS total_lost_revenue,
          COALESCE(SUM(cancellation_fee) FILTER (WHERE status = 'NO_SHOW'), 0) AS total_cancellation_fees
        FROM reservations
        WHERE hotel_id = ${hotelId}::uuid
          AND check_in_date >= ${dateFrom}::date
          AND check_in_date <= ${dateTo}::date
          AND deleted_at IS NULL
      `,
    ]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const summaryData = summary[0];
    const totalNoShows = Number(summaryData?.total_no_shows ?? 0);
    const totalExpected = Number(summaryData?.total_expected_arrivals ?? 0);

    return {
      rows: rows.map((row) => ({
        reservationId: row.reservation_id,
        confirmationNumber: row.confirmation_number,
        guestName: row.guest_name,
        roomType: row.room_type_name,
        checkInDate: row.check_in_date,
        totalAmount: new Decimal(row.total_amount),
        cancellationFee: new Decimal(row.cancellation_fee),
        source: row.source,
      })),
      bySource: bySource.map((row) => ({
        source: row.source,
        count: Number(row.count),
        totalAmount: new Decimal(row.total_amount),
      })),
      byRoomType: byRoomType.map((row) => ({
        roomType: row.room_type_name,
        count: Number(row.count),
      })),
      byDayOfWeek: byDayOfWeek.map((row) => ({
        dayOfWeek: row.day_of_week,
        dayName: dayNames[row.day_of_week] ?? 'Unknown',
        count: Number(row.count),
      })),
      summary: {
        totalNoShows,
        totalExpectedArrivals: totalExpected,
        noShowRate: safeDivide(new Decimal(totalNoShows * 100), totalExpected),
        totalLostRevenue: new Decimal(summaryData?.total_lost_revenue ?? 0),
        totalCancellationFees: new Decimal(summaryData?.total_cancellation_fees ?? 0),
      },
    };
  }

  // ==========================================================================
  // GUEST STATISTICS REPORT
  // ==========================================================================

  /**
   * Aggregates guest-behavior statistics for completed and in-house stays.
   *
   * Executes parallel queries for new/repeat totals, VIP mix, nationality mix,
   * and guest-type mix, then maps SQL aggregates into dashboard-friendly shapes.
   *
   * @param filters - Hotel/date filters for stay-based analytics.
   * @returns Guest statistics including volume, profile breakdowns, and stay KPIs.
   * @remarks Complexity: O(g + v + n + t) where terms are grouped row counts from each aggregate query.
   */
  async getGuestStatistics(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo } = filters;

    const [stats, vipBreakdown, nationalityTop5, guestTypeBreakdown] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          new_guests: bigint;
          repeat_guests: bigint;
          total_guests: bigint;
          avg_length_of_stay: Decimal;
          avg_daily_rate: Decimal;
        }>
      >`
        WITH guest_stays AS (
          SELECT 
            g.id AS guest_id,
            g.total_stays,
            g.created_at,
            res.nights,
            res.average_rate
          FROM guests g
          JOIN reservations res ON g.id = res.guest_id
          WHERE res.hotel_id = ${hotelId}::uuid
            AND res.check_in_date >= ${dateFrom}::date
            AND res.check_in_date <= ${dateTo}::date
            AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
            AND res.deleted_at IS NULL
        )
        SELECT 
          COUNT(DISTINCT guest_id) FILTER (WHERE created_at >= ${dateFrom}::date) AS new_guests,
          COUNT(DISTINCT guest_id) FILTER (WHERE total_stays > 1) AS repeat_guests,
          COUNT(DISTINCT guest_id) AS total_guests,
          COALESCE(AVG(nights), 0) AS avg_length_of_stay,
          COALESCE(AVG(average_rate), 0) AS avg_daily_rate
        FROM guest_stays
      `,

      prisma.$queryRaw<Array<{ vip_status: string; count: bigint }>>`
        SELECT 
          g.vip_status::text,
          COUNT(DISTINCT g.id) AS count
        FROM guests g
        JOIN reservations res ON g.id = res.guest_id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
        GROUP BY g.vip_status
        ORDER BY count DESC
      `,

      prisma.$queryRaw<Array<{ nationality: string; count: bigint }>>`
        SELECT 
          COALESCE(g.nationality, 'Unknown') AS nationality,
          COUNT(DISTINCT g.id) AS count
        FROM guests g
        JOIN reservations res ON g.id = res.guest_id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
        GROUP BY g.nationality
        ORDER BY count DESC
        LIMIT 5
      `,

      prisma.$queryRaw<Array<{ guest_type: string; count: bigint }>>`
        SELECT 
          g.guest_type::text,
          COUNT(DISTINCT g.id) AS count
        FROM guests g
        JOIN reservations res ON g.id = res.guest_id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
        GROUP BY g.guest_type
        ORDER BY count DESC
      `,
    ]);

    const statsData = stats[0];

    return {
      newGuests: Number(statsData?.new_guests ?? 0),
      repeatGuests: Number(statsData?.repeat_guests ?? 0),
      totalGuests: Number(statsData?.total_guests ?? 0),
      vipBreakdown: vipBreakdown.map((row) => ({
        status: row.vip_status,
        count: Number(row.count),
      })),
      nationalityTop5: nationalityTop5.map((row) => ({
        nationality: row.nationality,
        countryName: row.nationality,
        count: Number(row.count),
      })),
      avgLengthOfStay: new Decimal(statsData?.avg_length_of_stay ?? 0),
      avgDailyRate: new Decimal(statsData?.avg_daily_rate ?? 0),
      guestTypeBreakdown: guestTypeBreakdown.map((row) => ({
        guestType: row.guest_type,
        count: Number(row.count),
      })),
    };
  }

  // ==========================================================================
  // SOURCE ANALYSIS REPORT
  // ==========================================================================

  /**
   * Analyzes reservation and revenue contribution by booking source/channel.
   *
   * Aggregates source-level reservation metrics plus a direct-vs-OTA channel split,
   * then derives ADR, no-show rate, cancellation rate, and revenue percentage share.
   *
   * @param filters - Hotel/date filters for reservation-source analysis.
   * @returns Source-level analytics rows and channel distribution summary.
   * @remarks Complexity: O(s + c) where `s` is source-group row count and `c` is channel-group row count.
   */
  async getSourceAnalysis(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo } = filters;

    const [rows, channelDistribution] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          source: string;
          reservation_count: bigint;
          room_nights: bigint;
          total_revenue: Decimal;
          no_show_count: bigint;
          cancellation_count: bigint;
        }>
      >`
        SELECT 
          source::text,
          COUNT(*) AS reservation_count,
          SUM(nights) AS room_nights,
          COALESCE(SUM(total_amount), 0) AS total_revenue,
          COUNT(*) FILTER (WHERE status = 'NO_SHOW') AS no_show_count,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancellation_count
        FROM reservations
        WHERE hotel_id = ${hotelId}::uuid
          AND check_in_date >= ${dateFrom}::date
          AND check_in_date <= ${dateTo}::date
          AND deleted_at IS NULL
        GROUP BY source
        ORDER BY total_revenue DESC
      `,

      prisma.$queryRaw<
        Array<{
          channel: string;
          reservation_count: bigint;
          revenue: Decimal;
        }>
      >`
        SELECT 
          CASE 
            WHEN source IN ('DIRECT_WEB', 'DIRECT_PHONE', 'DIRECT_WALKIN') THEN 'DIRECT'
            ELSE 'OTA'
          END AS channel,
          COUNT(*) AS reservation_count,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM reservations
        WHERE hotel_id = ${hotelId}::uuid
          AND check_in_date >= ${dateFrom}::date
          AND check_in_date <= ${dateTo}::date
          AND deleted_at IS NULL
        GROUP BY channel
        ORDER BY revenue DESC
      `,
    ]);

    const totalRevenue = rows.reduce(
      (sum, row) => sum.plus(row.total_revenue ?? 0),
      new Decimal(0)
    );

    return {
      rows: rows.map((row) => {
        const count = Number(row.reservation_count);
        const noShowCount = Number(row.no_show_count);
        const cancellationCount = Number(row.cancellation_count);
        const roomNights = Number(row.room_nights);
        const revenue = new Decimal(row.total_revenue ?? 0);

        return {
          source: row.source,
          reservationCount: count,
          roomNights,
          totalRevenue: revenue,
          avgADR: safeDivide(revenue, roomNights),
          noShowCount,
          noShowRate: safeDivide(new Decimal(noShowCount * 100), count),
          cancellationCount,
          cancellationRate: safeDivide(new Decimal(cancellationCount * 100), count),
        };
      }),
      channelDistribution: channelDistribution.map((row) => {
        const revenue = new Decimal(row.revenue ?? 0);
        return {
          channel: row.channel,
          reservationCount: Number(row.reservation_count),
          revenue,
          percentage: safeDivide(revenue.mul(100), totalRevenue),
        };
      }),
    };
  }

  // ==========================================================================
  // REPEAT GUESTS REPORT
  // ==========================================================================

  /**
   * Returns paginated repeat-guest performance ranked by stay revenue.
   *
   * Applies minimum-stay qualification, returns paged guest aggregates, and runs
   * a companion distinct-count query to produce pagination metadata.
   *
   * @param filters - Repeat-guest criteria including page/limit and minimum stays.
   * @returns Paged repeat-guest rows with total-count pagination metadata.
   * @remarks Complexity: O(p) mapping for page size `p` plus one aggregate count query.
   */
  async getRepeatGuests(filters: RepeatGuestsFilters) {
    const { hotelId, dateFrom, dateTo, page, limit, minStays = 2 } = filters;
    const offset = (page - 1) * limit;

    const [guests, countResult] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          guest_id: string;
          guest_name: string;
          email: string | null;
          vip_status: string;
          total_stays: number;
          total_nights: bigint;
          total_revenue: Decimal;
          last_stay_date: Date | null;
          first_stay_date: Date;
        }>
      >`
        SELECT 
          g.id AS guest_id,
          CONCAT(g.first_name, ' ', g.last_name) AS guest_name,
          g.email,
          g.vip_status::text,
          g.total_stays,
          COALESCE(SUM(res.nights), 0) AS total_nights,
          COALESCE(SUM(res.total_amount), 0) AS total_revenue,
          g.last_stay_date,
          MIN(res.check_in_date) AS first_stay_date
        FROM guests g
        JOIN reservations res ON g.id = res.guest_id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
          AND g.total_stays >= ${minStays}
        GROUP BY g.id, g.first_name, g.last_name, g.email, g.vip_status, g.total_stays, g.last_stay_date
        ORDER BY total_revenue DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,

      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT g.id) AS count
        FROM guests g
        JOIN reservations res ON g.id = res.guest_id
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
          AND g.total_stays >= ${minStays}
      `,
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      guests: guests.map((row) => ({
        guestId: row.guest_id,
        guestName: row.guest_name,
        email: row.email,
        vipStatus: row.vip_status,
        totalStays: row.total_stays,
        totalNights: Number(row.total_nights),
        totalRevenue: new Decimal(row.total_revenue),
        lastStayDate: row.last_stay_date,
        firstStayDate: row.first_stay_date,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================================================
  // HOUSEKEEPING REPORT
  // ==========================================================================

  /**
   * Aggregates housekeeping throughput and staff productivity metrics.
   *
   * Runs period-based task summary and staff productivity queries in parallel, then
   * maps operational KPIs such as completion pace and inspection scores.
   *
   * @param filters - Hotel/date filters with optional period grouping.
   * @returns Housekeeping KPI rows and staff productivity breakdown.
   * @remarks Complexity: O(h + s) where `h` is grouped housekeeping period rows and `s` is grouped staff rows.
   */
  async getHousekeepingReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo, groupBy = 'DAY' } = filters;
    const dateExpr =
      groupBy === 'DAY' ? 'scheduled_for' : `DATE_TRUNC('${groupBy.toLowerCase()}', scheduled_for)`;

    const [rows, staffProductivity] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          date: Date;
          tasks_created: bigint;
          tasks_completed: bigint;
          tasks_cancelled: bigint;
          avg_completion_minutes: Decimal | null;
          avg_inspection_score: Decimal | null;
          issues_reported: bigint;
        }>
      >`
        SELECT 
          ${Prisma.raw(dateExpr)} AS date,
          COUNT(*) AS tasks_created,
          COUNT(*) FILTER (WHERE status = 'COMPLETED' OR status = 'VERIFIED') AS tasks_completed,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS tasks_cancelled,
          AVG(
            EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
          ) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL) AS avg_completion_minutes,
          AVG(inspection_score) FILTER (WHERE inspection_score IS NOT NULL) AS avg_inspection_score,
          COUNT(*) FILTER (WHERE issues_found IS NOT NULL) AS issues_reported
        FROM housekeeping_tasks
        WHERE hotel_id = ${hotelId}::uuid
          AND scheduled_for >= ${dateFrom}::date
          AND scheduled_for <= ${dateTo}::date
        GROUP BY ${Prisma.raw(dateExpr)}
        ORDER BY date
      `,

      prisma.$queryRaw<
        Array<{
          staff_id: string;
          staff_name: string;
          tasks_completed: bigint;
          avg_completion_minutes: Decimal;
          avg_inspection_score: Decimal | null;
        }>
      >`
        SELECT 
          ht.assigned_to AS staff_id,
          CONCAT(u.first_name, ' ', u.last_name) AS staff_name,
          COUNT(*) AS tasks_completed,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (ht.completed_at - ht.started_at)) / 60
          ), 0) AS avg_completion_minutes,
          AVG(ht.inspection_score) AS avg_inspection_score
        FROM housekeeping_tasks ht
        JOIN users u ON ht.assigned_to = u.id
        WHERE ht.hotel_id = ${hotelId}::uuid
          AND ht.scheduled_for >= ${dateFrom}::date
          AND ht.scheduled_for <= ${dateTo}::date
          AND ht.status IN ('COMPLETED', 'VERIFIED')
          AND ht.assigned_to IS NOT NULL
        GROUP BY ht.assigned_to, u.first_name, u.last_name
        ORDER BY tasks_completed DESC
      `,
    ]);

    return {
      rows: rows.map((row) => ({
        date: row.date,
        tasksCreated: Number(row.tasks_created),
        tasksCompleted: Number(row.tasks_completed),
        tasksCancelled: Number(row.tasks_cancelled),
        avgCompletionMinutes: row.avg_completion_minutes
          ? new Decimal(row.avg_completion_minutes)
          : null,
        avgInspectionScore: row.avg_inspection_score ? new Decimal(row.avg_inspection_score) : null,
        issuesReported: Number(row.issues_reported),
      })),
      staffProductivity: staffProductivity.map((row) => ({
        staffId: row.staff_id,
        staffName: row.staff_name,
        tasksCompleted: Number(row.tasks_completed),
        avgCompletionMinutes: new Decimal(row.avg_completion_minutes),
        avgInspectionScore: row.avg_inspection_score ? new Decimal(row.avg_inspection_score) : null,
      })),
    };
  }

  // ==========================================================================
  // MAINTENANCE REPORT
  // ==========================================================================

  /**
   * Produces maintenance demand, cost, and SLA impact analytics.
   *
   * Executes five parallel aggregates for request counts, priority mix, category
   * costs, cost totals, and SLA/out-of-order impact indicators.
   *
   * @param filters - Hotel/date filters for maintenance reporting.
   * @returns Maintenance KPI payload including counts, cost analytics, and OOO impact.
   * @remarks Complexity: O(p + c) post-query mapping where `p` is priority groups and `c` is category groups.
   */
  async getMaintenanceReport(filters: BaseReportFilters) {
    const { hotelId, dateFrom, dateTo } = filters;

    const [counts, byPriority, byCategory, costs, slaOoo] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          requests_created: bigint;
          requests_completed: bigint;
          requests_cancelled: bigint;
          avg_resolution_hours: Decimal | null;
        }>
      >`
        SELECT 
          COUNT(*) AS requests_created,
          COUNT(*) FILTER (WHERE status = 'COMPLETED' OR status = 'VERIFIED') AS requests_completed,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS requests_cancelled,
          AVG(
            EXTRACT(EPOCH FROM (completed_at - reported_at)) / 3600
          ) FILTER (WHERE completed_at IS NOT NULL) AS avg_resolution_hours
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
          AND reported_at >= ${dateFrom}::date
          AND reported_at <= ${dateTo}::date + interval '1 day'
      `,

      prisma.$queryRaw<Array<{ priority: string; count: bigint }>>`
        SELECT 
          priority::text,
          COUNT(*) AS count
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
          AND reported_at >= ${dateFrom}::date
          AND reported_at <= ${dateTo}::date + interval '1 day'
        GROUP BY priority
        ORDER BY count DESC
      `,

      prisma.$queryRaw<
        Array<{
          category: string;
          count: bigint;
          avg_cost: Decimal;
          total_cost: Decimal;
        }>
      >`
        SELECT 
          category::text,
          COUNT(*) AS count,
          COALESCE(AVG(total_cost), 0) AS avg_cost,
          COALESCE(SUM(total_cost), 0) AS total_cost
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
          AND reported_at >= ${dateFrom}::date
          AND reported_at <= ${dateTo}::date + interval '1 day'
        GROUP BY category
        ORDER BY count DESC
      `,

      prisma.$queryRaw<
        Array<{
          total_labor_cost: Decimal;
          total_parts_cost: Decimal;
          total_maintenance_cost: Decimal;
        }>
      >`
        SELECT 
          COALESCE(SUM(labor_cost), 0) AS total_labor_cost,
          COALESCE(SUM(parts_cost), 0) AS total_parts_cost,
          COALESCE(SUM(total_cost), 0) AS total_maintenance_cost
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
          AND reported_at >= ${dateFrom}::date
          AND reported_at <= ${dateTo}::date + interval '1 day'
      `,

      prisma.$queryRaw<
        Array<{
          sla_breaches: bigint;
          rooms_affected: bigint;
          total_ooo_days: bigint;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (
            WHERE completed_at IS NOT NULL 
              AND target_completion_at IS NOT NULL 
              AND completed_at > target_completion_at
          ) AS sla_breaches,
          COUNT(DISTINCT room_id) FILTER (WHERE room_out_of_order = true) AS rooms_affected,
          COALESCE(SUM(
            CASE 
              WHEN room_out_of_order = true AND ooo_until IS NOT NULL 
              THEN (ooo_until - reported_at::date)
              ELSE 0 
            END
          ), 0) AS total_ooo_days
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
          AND reported_at >= ${dateFrom}::date
          AND reported_at <= ${dateTo}::date + interval '1 day'
      `,
    ]);

    const countsData = counts[0];
    const costsData = costs[0];
    const slaOooData = slaOoo[0];

    return {
      requestsCreated: Number(countsData?.requests_created ?? 0),
      requestsCompleted: Number(countsData?.requests_completed ?? 0),
      requestsCancelled: Number(countsData?.requests_cancelled ?? 0),
      avgResolutionHours: countsData?.avg_resolution_hours
        ? new Decimal(countsData.avg_resolution_hours)
        : null,
      byPriority: byPriority.map((row) => ({
        priority: row.priority,
        count: Number(row.count),
      })),
      byCategory: byCategory.map((row) => ({
        category: row.category,
        count: Number(row.count),
        avgCost: new Decimal(row.avg_cost),
        totalCost: new Decimal(row.total_cost),
      })),
      costs: {
        totalLaborCost: new Decimal(costsData?.total_labor_cost ?? 0),
        totalPartsCost: new Decimal(costsData?.total_parts_cost ?? 0),
        totalMaintenanceCost: new Decimal(costsData?.total_maintenance_cost ?? 0),
      },
      slaBreaches: Number(slaOooData?.sla_breaches ?? 0),
      oooImpact: {
        roomsAffected: Number(slaOooData?.rooms_affected ?? 0),
        totalOOODays: Number(slaOooData?.total_ooo_days ?? 0),
      },
    };
  }

  // ==========================================================================
  // MANAGER DASHBOARD
  // ==========================================================================

  /**
   * Builds the manager dashboard combining occupancy, revenue, and alert signals.
   *
   * Derives MTD/YTD comparison windows, executes operational and revenue queries in
   * parallel, and composes occupancy, room-status, pending-actions, and alert data
   * into one management-facing dashboard payload.
   *
   * @param filters - Hotel/date context for dashboard generation.
   * @returns Manager dashboard snapshot for the requested date.
   * @remarks Complexity: O(a + h + q) where terms reflect returned alert rows, revenue-by-hour points, and fixed aggregate query outputs.
   */
  async getManagerDashboard(filters: DashboardFilters) {
    const { hotelId, date = new Date() } = filters;

    // Calculate MTD and YTD date ranges
    const mtdStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const ytdStart = new Date(date.getFullYear(), 0, 1);
    const lastYearDate = new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());

    const [
      occupancy,
      revenueToday,
      revenueMtd,
      revenueYtd,
      revenueLastYear,
      roomStatus,
      pendingActions,
      revenueByHour,
      alerts,
    ] = await Promise.all([
      // Occupancy snapshot
      prisma.$queryRaw<
        Array<{
          total_rooms: bigint;
          occupied_rooms: bigint;
          arrivals: bigint;
          departures: bigint;
          in_house: bigint;
        }>
      >`
        SELECT 
          (SELECT COUNT(*) FROM rooms WHERE hotel_id = ${hotelId}::uuid AND deleted_at IS NULL) AS total_rooms,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date <= ${date}::date 
              AND res.check_out_date > ${date}::date
              AND res.status = 'CHECKED_IN'
          ) AS occupied_rooms,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_in_date = ${date}::date
              AND res.status IN ('CONFIRMED', 'CHECKED_IN')
          ) AS arrivals,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.check_out_date = ${date}::date
              AND res.status = 'CHECKED_IN'
          ) AS departures,
          COUNT(DISTINCT res.id) FILTER (
            WHERE res.status = 'CHECKED_IN'
          ) AS in_house
        FROM reservations res
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.deleted_at IS NULL
      `,

      // Today's revenue
      this.getRevenueForPeriod(hotelId, date, date),

      // MTD revenue
      this.getRevenueForPeriod(hotelId, mtdStart, date),

      // YTD revenue
      this.getRevenueForPeriod(hotelId, ytdStart, date),

      // Last year same day revenue (for comparison)
      this.getRevenueForPeriod(hotelId, lastYearDate, lastYearDate),

      // Room status counts
      prisma.$queryRaw<
        Array<{
          vacant_clean: bigint;
          vacant_dirty: bigint;
          occupied: bigint;
          out_of_order: bigint;
          reserved: bigint;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'VACANT' AND housekeeping_status = 'CLEAN') AS vacant_clean,
          COUNT(*) FILTER (WHERE status = 'VACANT' AND housekeeping_status IN ('DIRTY', 'INSPECTED')) AS vacant_dirty,
          COUNT(*) FILTER (WHERE status = 'OCCUPIED') AS occupied,
          COUNT(*) FILTER (WHERE is_out_of_order = true) AS out_of_order,
          COUNT(*) FILTER (WHERE status = 'RESERVED') AS reserved
        FROM rooms
        WHERE hotel_id = ${hotelId}::uuid
          AND deleted_at IS NULL
      `,

      // Pending actions
      this.getPendingActions(hotelId, date),

      // Revenue by hour (last 12 hours)
      prisma.$queryRaw<Array<{ hour: number; revenue: Decimal }>>`
        SELECT 
          EXTRACT(HOUR FROM posted_at)::int AS hour,
          COALESCE(SUM(amount), 0) AS revenue
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date = ${date}::date
          AND is_voided = false
          AND item_type NOT IN ('PAYMENT', 'REFUND', 'TAX')
          AND posted_at >= NOW() - interval '12 hours'
        GROUP BY EXTRACT(HOUR FROM posted_at)
        ORDER BY hour
      `,

      // Alerts
      this.getAlerts(hotelId, date),
    ]);

    const occupancyData = occupancy[0];
    const roomStatusData = roomStatus[0];
    const totalRooms = Number(occupancyData?.total_rooms ?? 0);
    const occupiedRooms = Number(occupancyData?.occupied_rooms ?? 0);

    return {
      date,
      occupancy: {
        rate: safeDivide(new Decimal(occupiedRooms * 100), totalRooms),
        occupiedRooms,
        totalRooms,
        arrivals: Number(occupancyData?.arrivals ?? 0),
        departures: Number(occupancyData?.departures ?? 0),
        inHouse: Number(occupancyData?.in_house ?? 0),
      },
      revenue: {
        today: revenueToday,
        mtd: revenueMtd,
        ytd: revenueYtd,
        vsLastYear: revenueLastYear.isZero()
          ? null
          : safeDivide(revenueToday.minus(revenueLastYear).mul(100), revenueLastYear),
      },
      alerts,
      roomStatus: {
        vacantClean: Number(roomStatusData?.vacant_clean ?? 0),
        vacantDirty: Number(roomStatusData?.vacant_dirty ?? 0),
        occupied: Number(roomStatusData?.occupied ?? 0),
        outOfOrder: Number(roomStatusData?.out_of_order ?? 0),
        reserved: Number(roomStatusData?.reserved ?? 0),
      },
      pendingActions,
      revenueByHour: revenueByHour.map((row) => ({
        hour: Number(row.hour),
        revenue: new Decimal(row.revenue),
      })),
    };
  }

  // ==========================================================================
  // REVENUE DASHBOARD
  // ==========================================================================

  /**
   * Builds the revenue dashboard with today/MTD/YTD comparisons.
   *
   * Calculates comparison windows and executes period totals, KPI metrics, trend,
   * top-rate-plan, and source-breakdown helpers in parallel.
   *
   * @param filters - Hotel/date context for dashboard generation.
   * @returns Revenue dashboard sections for period totals, KPI rates, trends, and mix.
   * @remarks Complexity: O(t + r + s) where `t` is trend row count, `r` is top-rate-plan rows, and `s` is source rows.
   */
  async getRevenueDashboard(filters: DashboardFilters) {
    const { hotelId, date = new Date() } = filters;

    const mtdStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const ytdStart = new Date(date.getFullYear(), 0, 1);
    const last30DaysStart = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayData,
      mtdData,
      ytdData,
      kpiToday,
      kpiMtd,
      kpiYtd,
      revenueTrend,
      topRatePlans,
      sourceBreakdown,
    ] = await Promise.all([
      this.getRevenuePeriodData(hotelId, date, date),
      this.getRevenuePeriodData(hotelId, mtdStart, date),
      this.getRevenuePeriodData(hotelId, ytdStart, date),
      this.getKPIData(hotelId, date, date),
      this.getKPIData(hotelId, mtdStart, date),
      this.getKPIData(hotelId, ytdStart, date),
      this.getRevenueTrend(hotelId, last30DaysStart, date),
      this.getTopRatePlans(hotelId, mtdStart, date),
      this.getSourceBreakdownForDashboard(hotelId, mtdStart, date),
    ]);

    return {
      today: todayData,
      mtd: mtdData,
      ytd: ytdData,
      adr: {
        today: kpiToday.adr,
        mtd: kpiMtd.adr,
        ytd: kpiYtd.adr,
      },
      revPar: {
        today: kpiToday.revPar,
        mtd: kpiMtd.revPar,
        ytd: kpiYtd.revPar,
      },
      occupancyRate: {
        today: kpiToday.occupancyRate,
        mtd: kpiMtd.occupancyRate,
        ytd: kpiYtd.occupancyRate,
      },
      revenueTrend,
      topRatePlans,
      sourceBreakdown,
    };
  }

  // ==========================================================================
  // OPERATIONS DASHBOARD
  // ==========================================================================

  /**
   * Builds the operations dashboard spanning housekeeping, maintenance, inventory, and POS.
   *
   * Executes fixed aggregate SQL queries in parallel for each operational domain
   * and combines those results with active staff session counts.
   *
   * @param filters - Hotel/date context for dashboard generation.
   * @returns Operations dashboard with domain-specific operational KPIs.
   * @remarks Complexity: O(1) application-side work with a fixed query set; runtime is dominated by underlying aggregate scans.
   */
  async getOperationsDashboard(filters: DashboardFilters) {
    const { hotelId, date = new Date() } = filters;

    const [housekeeping, maintenance, inventory, pos, staffOnShift] = await Promise.all([
      // Housekeeping data
      prisma.$queryRaw<
        Array<{
          pending_tasks: bigint;
          in_progress_tasks: bigint;
          completed_today: bigint;
          avg_completion_minutes: Decimal | null;
          inspection_pass_rate: Decimal | null;
          dirty_rooms: bigint;
          clean_rooms: bigint;
        }>
      >`
        SELECT 
          (SELECT COUNT(*) FROM housekeeping_tasks 
           WHERE hotel_id = ${hotelId}::uuid AND status = 'PENDING' AND scheduled_for = ${date}::date) AS pending_tasks,
          (SELECT COUNT(*) FROM housekeeping_tasks 
           WHERE hotel_id = ${hotelId}::uuid AND status = 'IN_PROGRESS') AS in_progress_tasks,
          (SELECT COUNT(*) FROM housekeeping_tasks 
           WHERE hotel_id = ${hotelId}::uuid AND status IN ('COMPLETED', 'VERIFIED') AND scheduled_for = ${date}::date) AS completed_today,
          (SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) 
           FROM housekeeping_tasks 
           WHERE hotel_id = ${hotelId}::uuid AND completed_at IS NOT NULL AND started_at IS NOT NULL 
             AND scheduled_for = ${date}::date) AS avg_completion_minutes,
          (SELECT (COUNT(*) FILTER (WHERE inspection_score >= 80) * 100.0 / NULLIF(COUNT(*), 0))
           FROM housekeeping_tasks 
           WHERE hotel_id = ${hotelId}::uuid AND inspection_score IS NOT NULL 
             AND scheduled_for = ${date}::date) AS inspection_pass_rate,
          (SELECT COUNT(*) FROM rooms 
           WHERE hotel_id = ${hotelId}::uuid AND housekeeping_status IN ('DIRTY', 'INSPECTED') AND deleted_at IS NULL) AS dirty_rooms,
          (SELECT COUNT(*) FROM rooms 
           WHERE hotel_id = ${hotelId}::uuid AND housekeeping_status = 'CLEAN' AND deleted_at IS NULL) AS clean_rooms
      `,

      // Maintenance data
      prisma.$queryRaw<
        Array<{
          open_requests: bigint;
          urgent_open: bigint;
          completed_today: bigint;
          avg_resolution_hours: Decimal | null;
          sla_breach_count: bigint;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'VERIFIED', 'CANCELLED')) AS open_requests,
          COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'VERIFIED', 'CANCELLED') AND priority IN ('URGENT', 'EMERGENCY')) AS urgent_open,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'VERIFIED') AND completed_at::date = ${date}::date) AS completed_today,
          AVG(EXTRACT(EPOCH FROM (completed_at - reported_at)) / 3600) FILTER (WHERE completed_at IS NOT NULL) AS avg_resolution_hours,
          COUNT(*) FILTER (WHERE completed_at > target_completion_at AND target_completion_at IS NOT NULL) AS sla_breach_count
        FROM maintenance_requests
        WHERE hotel_id = ${hotelId}::uuid
      `,

      // Inventory data
      prisma.$queryRaw<
        Array<{
          low_stock_count: bigint;
          out_of_stock_count: bigint;
          pending_pos: bigint;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (WHERE current_quantity <= reorder_point AND current_quantity > 0) AS low_stock_count,
          COUNT(*) FILTER (WHERE current_quantity = 0) AS out_of_stock_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE hotel_id = ${hotelId}::uuid AND status IN ('DRAFT', 'SUBMITTED', 'APPROVED')) AS pending_pos
        FROM inventory_items
        WHERE hotel_id = ${hotelId}::uuid
          AND is_active = true
      `,

      // POS data
      prisma.$queryRaw<
        Array<{
          open_orders: bigint;
          revenue_today: Decimal;
          room_charges_posted: bigint;
        }>
      >`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'OPEN') AS open_orders,
          COALESCE(SUM(total) FILTER (WHERE status = 'CLOSED' AND closed_at::date = ${date}::date), 0) AS revenue_today,
          COUNT(*) FILTER (WHERE room_charge_posted = true AND closed_at::date = ${date}::date) AS room_charges_posted
        FROM pos_orders
        WHERE hotel_id = ${hotelId}::uuid
      `,

      // Staff on shift
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM user_sessions
        WHERE expires_at > NOW()
          AND created_at > NOW() - interval '8 hours'
      `,
    ]);

    const hkData = housekeeping[0];
    const maintData = maintenance[0];
    const invData = inventory[0];
    const posData = pos[0];

    return {
      date,
      housekeeping: {
        pendingTasks: Number(hkData?.pending_tasks ?? 0),
        inProgressTasks: Number(hkData?.in_progress_tasks ?? 0),
        completedToday: Number(hkData?.completed_today ?? 0),
        avgCompletionMinutes: hkData?.avg_completion_minutes
          ? new Decimal(hkData.avg_completion_minutes)
          : null,
        inspectionPassRate: hkData?.inspection_pass_rate
          ? new Decimal(hkData.inspection_pass_rate)
          : null,
        dirtyRooms: Number(hkData?.dirty_rooms ?? 0),
        cleanRooms: Number(hkData?.clean_rooms ?? 0),
      },
      maintenance: {
        openRequests: Number(maintData?.open_requests ?? 0),
        urgentOpen: Number(maintData?.urgent_open ?? 0),
        completedToday: Number(maintData?.completed_today ?? 0),
        avgResolutionHours: maintData?.avg_resolution_hours
          ? new Decimal(maintData.avg_resolution_hours)
          : null,
        slaBreachCount: Number(maintData?.sla_breach_count ?? 0),
      },
      inventory: {
        lowStockCount: Number(invData?.low_stock_count ?? 0),
        outOfStockCount: Number(invData?.out_of_stock_count ?? 0),
        pendingPOs: Number(invData?.pending_pos ?? 0),
      },
      pos: {
        openOrders: Number(posData?.open_orders ?? 0),
        revenueToday: new Decimal(posData?.revenue_today ?? 0),
        roomChargesPosted: Number(posData?.room_charges_posted ?? 0),
      },
      staffOnShift: Number(staffOnShift[0]?.count ?? 0),
    };
  }

  // ==========================================================================
  // HELPER METHODS FOR DASHBOARDS
  // ==========================================================================

  /**
   * Computes non-payment folio revenue for a date-bounded period.
   *
   * @param hotelId - Hotel UUID whose folio revenue is aggregated.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @returns Decimal total for non-voided non-payment folio items.
   * @remarks Complexity: O(f) in matching folio-item rows scanned by the aggregate query.
   */
  private async getRevenueForPeriod(
    hotelId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Decimal> {
    const result = await prisma.$queryRaw<Array<{ total: Decimal }>>`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM folio_items
      WHERE hotel_id = ${hotelId}::uuid
        AND business_date >= ${dateFrom}::date
        AND business_date <= ${dateTo}::date
        AND is_voided = false
        AND item_type NOT IN ('PAYMENT', 'REFUND', 'TAX', 'DISCOUNT')
    `;
    return new Decimal(result[0]?.total ?? 0);
  }

  /**
   * Aggregates actionable operational counts for manager dashboard cards.
   *
   * @param hotelId - Hotel UUID used for all sub-queries.
   * @param date - Business date used for check-in/check-out scoped counts.
   * @returns Pending-action counters for arrivals, departures, folios, inventory, and maintenance.
   * @remarks Complexity: O(1) application work with fixed scalar subqueries.
   */
  private async getPendingActions(hotelId: string, date: Date) {
    const result = await prisma.$queryRaw<
      Array<{
        check_ins_today: bigint;
        check_outs_today: bigint;
        unbalanced_folios: bigint;
        low_stock_alerts: bigint;
        open_maintenance: bigint;
      }>
    >`
      SELECT 
        (SELECT COUNT(*) FROM reservations 
         WHERE hotel_id = ${hotelId}::uuid AND check_in_date = ${date}::date 
           AND status = 'CONFIRMED' AND deleted_at IS NULL) AS check_ins_today,
        (SELECT COUNT(*) FROM reservations 
         WHERE hotel_id = ${hotelId}::uuid AND check_out_date = ${date}::date 
           AND status = 'CHECKED_IN' AND deleted_at IS NULL) AS check_outs_today,
        (SELECT COUNT(*) FROM reservations 
         WHERE hotel_id = ${hotelId}::uuid AND status = 'CHECKED_IN' 
           AND balance > 0 AND deleted_at IS NULL) AS unbalanced_folios,
        (SELECT COUNT(*) FROM inventory_items 
         WHERE hotel_id = ${hotelId}::uuid AND current_quantity <= reorder_point 
           AND is_active = true) AS low_stock_alerts,
        (SELECT COUNT(*) FROM maintenance_requests 
         WHERE hotel_id = ${hotelId}::uuid 
           AND status NOT IN ('COMPLETED', 'VERIFIED', 'CANCELLED')
           AND priority IN ('URGENT', 'EMERGENCY')) AS open_maintenance
    `;

    const data = result[0];
    return {
      checkInsToday: Number(data?.check_ins_today ?? 0),
      checkOutsToday: Number(data?.check_outs_today ?? 0),
      unbalancedFolios: Number(data?.unbalanced_folios ?? 0),
      lowStockAlerts: Number(data?.low_stock_alerts ?? 0),
      openMaintenance: Number(data?.open_maintenance ?? 0),
    };
  }

  /**
   * Derives alert entities from maintenance, inventory, folio, and arrival signals.
   *
   * Executes targeted counts and emits typed alert rows only when thresholds are
   * non-zero, preserving lightweight dashboard payloads.
   *
   * @param hotelId - Hotel UUID used for alert-source queries.
   * @param date - Business date used for pending-arrival checks.
   * @returns Alert rows ordered by detection sequence.
   * @remarks Complexity: O(1) application work with four independent count queries.
   */
  private async getAlerts(hotelId: string, date: Date) {
    const alerts: Array<{
      type: 'WARNING' | 'CRITICAL' | 'INFO';
      message: string;
      count: number;
      entityType: AlertEntityType;
    }> = [];

    // Check for urgent maintenance
    const urgentMaint = await prisma.maintenanceRequest.count({
      where: {
        hotelId,
        status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] },
        priority: { in: ['URGENT', 'EMERGENCY'] },
      },
    });
    if (urgentMaint > 0) {
      alerts.push({
        type: 'CRITICAL',
        message: 'Urgent maintenance requests require attention',
        count: urgentMaint,
        entityType: 'MAINTENANCE',
      });
    }

    // Check for low inventory (comparing currentQuantity to reorderPoint)
    const lowStockResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM inventory_items
      WHERE hotel_id = ${hotelId}::uuid
        AND is_active = true
        AND deleted_at IS NULL
        AND current_quantity <= reorder_point
    `;
    const lowStock = Number(lowStockResult[0]?.count ?? 0);
    if (lowStock > 0) {
      alerts.push({
        type: 'WARNING',
        message: 'Inventory items below reorder point',
        count: lowStock,
        entityType: 'INVENTORY',
      });
    }

    // Check for unbalanced folios
    const unbalanced = await prisma.reservation.count({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        balance: { gt: 0 },
        deletedAt: null,
      },
    });
    if (unbalanced > 0) {
      alerts.push({
        type: 'WARNING',
        message: 'In-house guests with outstanding balances',
        count: unbalanced,
        entityType: 'FOLIO',
      });
    }

    // Pending check-ins info
    const pendingCheckIns = await prisma.reservation.count({
      where: {
        hotelId,
        checkInDate: date,
        status: 'CONFIRMED',
        deletedAt: null,
      },
    });
    if (pendingCheckIns > 0) {
      alerts.push({
        type: 'INFO',
        message: 'Expected arrivals today',
        count: pendingCheckIns,
        entityType: 'RESERVATION',
      });
    }

    return alerts;
  }

  /**
   * Computes period revenue composition and captured-payment totals.
   *
   * @param hotelId - Hotel UUID whose revenue composition is requested.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @returns Revenue component totals (`room`, `fnb`, `spa`, `other`) and payment receipts.
   * @remarks Complexity: O(f + p) where `f` is matching folio rows and `p` is matching payment rows.
   */
  private async getRevenuePeriodData(hotelId: string, dateFrom: Date, dateTo: Date) {
    const result = await prisma.$queryRaw<
      Array<{
        room: Decimal;
        fnb: Decimal;
        spa: Decimal;
        other: Decimal;
        payments_received: Decimal;
      }>
    >`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE item_type = 'ROOM_CHARGE'), 0) AS room,
        COALESCE(SUM(amount) FILTER (WHERE item_type = 'POS_CHARGE'), 0) AS fnb,
        COALESCE(SUM(amount) FILTER (WHERE item_type = 'SPA'), 0) AS spa,
        COALESCE(SUM(amount) FILTER (
          WHERE item_type NOT IN ('ROOM_CHARGE', 'POS_CHARGE', 'SPA', 'PAYMENT', 'REFUND', 'TAX', 'DISCOUNT')
        ), 0) AS other,
        (SELECT COALESCE(SUM(amount), 0) FROM payments 
         WHERE hotel_id = ${hotelId}::uuid 
           AND processed_at >= ${dateFrom}::date 
           AND processed_at <= ${dateTo}::date + interval '1 day'
           AND status = 'CAPTURED' AND is_refund = false) AS payments_received
      FROM folio_items
      WHERE hotel_id = ${hotelId}::uuid
        AND business_date >= ${dateFrom}::date
        AND business_date <= ${dateTo}::date
        AND is_voided = false
    `;

    const data = result[0];
    const room = new Decimal(data?.room ?? 0);
    const fnb = new Decimal(data?.fnb ?? 0);
    const spa = new Decimal(data?.spa ?? 0);
    const other = new Decimal(data?.other ?? 0);

    return {
      room,
      fnb,
      spa,
      other,
      total: room.plus(fnb).plus(spa).plus(other),
      paymentsReceived: new Decimal(data?.payments_received ?? 0),
    };
  }

  /**
   * Calculates KPI rates (ADR, RevPAR, occupancy) for a period.
   *
   * Uses room-charge revenue and sold-room counts plus scaled room inventory days
   * to derive KPI denominators over multi-day windows.
   *
   * @param hotelId - Hotel UUID whose KPI metrics are requested.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @returns KPI decimals for ADR, RevPAR, and occupancy rate.
   * @remarks Complexity: O(f + r) in DB execution where `f` is relevant folio rows and `r` is room inventory rows.
   */
  private async getKPIData(hotelId: string, dateFrom: Date, dateTo: Date) {
    const result = await prisma.$queryRaw<
      Array<{
        room_revenue: Decimal;
        rooms_sold: bigint;
        available_rooms: bigint;
        total_rooms: bigint;
      }>
    >`
      WITH metrics AS (
        SELECT 
          COALESCE(SUM(fi.amount), 0) AS room_revenue,
          COUNT(DISTINCT res.id) AS rooms_sold
        FROM folio_items fi
        JOIN reservations res ON fi.reservation_id = res.id
        WHERE fi.hotel_id = ${hotelId}::uuid
          AND fi.business_date >= ${dateFrom}::date
          AND fi.business_date <= ${dateTo}::date
          AND fi.item_type = 'ROOM_CHARGE'
          AND fi.is_voided = false
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
      ),
      room_counts AS (
        SELECT 
          COUNT(*) AS total_rooms,
          COUNT(*) FILTER (WHERE is_out_of_order = false) AS available_rooms
        FROM rooms
        WHERE hotel_id = ${hotelId}::uuid AND deleted_at IS NULL
      )
      SELECT 
        m.room_revenue,
        m.rooms_sold,
        rc.available_rooms * (${dateTo}::date - ${dateFrom}::date + 1) AS available_rooms,
        rc.total_rooms * (${dateTo}::date - ${dateFrom}::date + 1) AS total_rooms
      FROM metrics m, room_counts rc
    `;

    const data = result[0];
    const roomRevenue = new Decimal(data?.room_revenue ?? 0);
    const roomsSold = Number(data?.rooms_sold ?? 0);
    const availableRooms = Number(data?.available_rooms ?? 0);
    const totalRooms = Number(data?.total_rooms ?? 0);

    return {
      adr: safeDivide(roomRevenue, roomsSold),
      revPar: safeDivide(roomRevenue, availableRooms),
      occupancyRate: safeDivide(new Decimal(roomsSold * 100), totalRooms),
    };
  }

  /**
   * Builds daily revenue-trend points with occupancy rate context.
   *
   * Aggregates daily folio revenue and daily sold-room counts in CTEs, full-joins
   * both series, then computes occupancy rate per day.
   *
   * @param hotelId - Hotel UUID whose trend is requested.
   * @param dateFrom - Inclusive trend start date.
   * @param dateTo - Inclusive trend end date.
   * @returns Daily revenue points enriched with occupancy percentage.
   * @remarks Complexity: O(d + f + r) where `d` is day buckets and `f`/`r` are matching folio/reservation rows.
   */
  private async getRevenueTrend(hotelId: string, dateFrom: Date, dateTo: Date) {
    const rows = await prisma.$queryRaw<
      Array<{
        date: Date;
        total_revenue: Decimal;
        rooms_sold: bigint;
        total_rooms: bigint;
      }>
    >`
      WITH daily_revenue AS (
        SELECT 
          business_date AS date,
          SUM(amount) FILTER (WHERE item_type NOT IN ('PAYMENT', 'REFUND', 'TAX', 'DISCOUNT')) AS total_revenue
        FROM folio_items
        WHERE hotel_id = ${hotelId}::uuid
          AND business_date >= ${dateFrom}::date
          AND business_date <= ${dateTo}::date
          AND is_voided = false
        GROUP BY business_date
      ),
      daily_occupancy AS (
        SELECT 
          res.check_in_date AS date,
          COUNT(DISTINCT res.id) AS rooms_sold,
          (SELECT COUNT(*) FROM rooms WHERE hotel_id = ${hotelId}::uuid AND deleted_at IS NULL) AS total_rooms
        FROM reservations res
        WHERE res.hotel_id = ${hotelId}::uuid
          AND res.check_in_date >= ${dateFrom}::date
          AND res.check_in_date <= ${dateTo}::date
          AND res.status IN ('CHECKED_IN', 'CHECKED_OUT')
          AND res.deleted_at IS NULL
        GROUP BY res.check_in_date
      )
      SELECT 
        COALESCE(dr.date, do.date) AS date,
        COALESCE(dr.total_revenue, 0) AS total_revenue,
        COALESCE(do.rooms_sold, 0) AS rooms_sold,
        COALESCE(do.total_rooms, 0) AS total_rooms
      FROM daily_revenue dr
      FULL OUTER JOIN daily_occupancy do ON dr.date = do.date
      ORDER BY date
    `;

    return rows.map((row) => ({
      date: row.date,
      totalRevenue: new Decimal(row.total_revenue),
      occupancyRate: safeDivide(new Decimal(Number(row.rooms_sold) * 100), Number(row.total_rooms)),
    }));
  }

  /**
   * Returns top-performing rate plans ranked by realized reservation revenue.
   *
   * @param hotelId - Hotel UUID whose rate-plan performance is requested.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @returns Up to five rate plans with reservation counts and revenue totals.
   * @remarks Complexity: O(g) where `g` is grouped rate-plan rows before the top-5 limit.
   */
  private async getTopRatePlans(hotelId: string, dateFrom: Date, dateTo: Date) {
    const rows = await prisma.$queryRaw<
      Array<{
        rate_plan_id: string;
        rate_plan_code: string;
        rate_plan_name: string;
        reservations: bigint;
        revenue: Decimal;
      }>
    >`
      SELECT 
        rp.id AS rate_plan_id,
        rp.code AS rate_plan_code,
        rp.name AS rate_plan_name,
        COUNT(DISTINCT res.id) AS reservations,
        COALESCE(SUM(res.total_amount), 0) AS revenue
      FROM reservations res
      JOIN rate_plans rp ON res.rate_plan_id = rp.id
      WHERE res.hotel_id = ${hotelId}::uuid
        AND res.check_in_date >= ${dateFrom}::date
        AND res.check_in_date <= ${dateTo}::date
        AND res.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        AND res.deleted_at IS NULL
      GROUP BY rp.id, rp.code, rp.name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    return rows.map((row) => ({
      ratePlanId: row.rate_plan_id,
      ratePlanCode: row.rate_plan_code,
      ratePlanName: row.rate_plan_name,
      reservations: Number(row.reservations),
      revenue: new Decimal(row.revenue),
    }));
  }

  /**
   * Computes revenue contribution percentages by reservation source.
   *
   * @param hotelId - Hotel UUID whose source mix is requested.
   * @param dateFrom - Inclusive period start date.
   * @param dateTo - Inclusive period end date.
   * @returns Source rows with reservation counts, revenue totals, and share percentage.
   * @remarks Complexity: O(s) where `s` is grouped source row count.
   */
  private async getSourceBreakdownForDashboard(hotelId: string, dateFrom: Date, dateTo: Date) {
    const rows = await prisma.$queryRaw<
      Array<{
        source: string;
        reservations: bigint;
        revenue: Decimal;
      }>
    >`
      SELECT 
        source::text,
        COUNT(*) AS reservations,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM reservations
      WHERE hotel_id = ${hotelId}::uuid
        AND check_in_date >= ${dateFrom}::date
        AND check_in_date <= ${dateTo}::date
        AND status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        AND deleted_at IS NULL
      GROUP BY source
      ORDER BY revenue DESC
    `;

    const totalRevenue = rows.reduce((sum, row) => sum.plus(row.revenue ?? 0), new Decimal(0));

    return rows.map((row) => {
      const revenue = new Decimal(row.revenue);
      return {
        source: row.source,
        reservations: Number(row.reservations),
        revenue,
        percentage: safeDivide(revenue.mul(100), totalRevenue),
      };
    });
  }
}

export const reportsRepository = new ReportsRepository();
