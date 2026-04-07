import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const GroupByPeriodSchema = z.enum(['DAY', 'WEEK', 'MONTH']);

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const OrgHotelParamsSchema = OrganizationIdParamSchema.merge(HotelIdParamSchema);

// ============================================================================
// BASE REPORT QUERY SCHEMA
// ============================================================================

export const BaseReportQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    groupBy: GroupByPeriodSchema.default('DAY'),
    roomTypeId: z.string().uuid().optional(),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: 'dateTo must be greater than or equal to dateFrom',
    path: ['dateTo'],
  })
  .refine(
    (data) => {
      const diffMs = data.dateTo.getTime() - data.dateFrom.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 366;
    },
    {
      message: 'Date range cannot exceed 366 days',
      path: ['dateTo'],
    }
  )
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return data.dateTo <= today;
    },
    {
      message: 'dateTo cannot be in the future',
      path: ['dateTo'],
    }
  );

// ============================================================================
// REPORT-SPECIFIC QUERY SCHEMAS
// ============================================================================

export const OccupancyReportQuerySchema = BaseReportQuerySchema;

export const RevenueReportQuerySchema = BaseReportQuerySchema;

export const ADRReportQuerySchema = BaseReportQuerySchema;

export const RevPARReportQuerySchema = BaseReportQuerySchema;

export const FolioSummaryQuerySchema = BaseReportQuerySchema;

export const ArrivalsDeparturesQuerySchema = BaseReportQuerySchema;

export const NoShowsQuerySchema = BaseReportQuerySchema;

export const GuestStatisticsQuerySchema = BaseReportQuerySchema;

export const SourceAnalysisQuerySchema = BaseReportQuerySchema;

export const HousekeepingReportQuerySchema = BaseReportQuerySchema;

export const MaintenanceReportQuerySchema = BaseReportQuerySchema;

// ============================================================================
// IN-HOUSE REPORT (point-in-time, no date range)
// ============================================================================

export const InHouseReportQuerySchema = z.object({
  date: z.coerce.date().optional(),
  roomTypeId: z.string().uuid().optional(),
});

// ============================================================================
// REPEAT GUESTS - WITH PAGINATION
// ============================================================================

export const RepeatGuestsQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    minStays: z.coerce.number().int().min(2).default(2),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: 'dateTo must be greater than or equal to dateFrom',
    path: ['dateTo'],
  })
  .refine(
    (data) => {
      const diffMs = data.dateTo.getTime() - data.dateFrom.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 366;
    },
    {
      message: 'Date range cannot exceed 366 days',
      path: ['dateTo'],
    }
  );

// ============================================================================
// DASHBOARD QUERY SCHEMAS
// ============================================================================

export const ManagerDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const RevenueDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const OperationsDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type BaseReportQueryInput = z.infer<typeof BaseReportQuerySchema>;
export type OccupancyReportQueryInput = z.infer<typeof OccupancyReportQuerySchema>;
export type RevenueReportQueryInput = z.infer<typeof RevenueReportQuerySchema>;
export type ADRReportQueryInput = z.infer<typeof ADRReportQuerySchema>;
export type RevPARReportQueryInput = z.infer<typeof RevPARReportQuerySchema>;
export type FolioSummaryQueryInput = z.infer<typeof FolioSummaryQuerySchema>;
export type ArrivalsDeparturesQueryInput = z.infer<typeof ArrivalsDeparturesQuerySchema>;
export type InHouseReportQueryInput = z.infer<typeof InHouseReportQuerySchema>;
export type NoShowsQueryInput = z.infer<typeof NoShowsQuerySchema>;
export type GuestStatisticsQueryInput = z.infer<typeof GuestStatisticsQuerySchema>;
export type SourceAnalysisQueryInput = z.infer<typeof SourceAnalysisQuerySchema>;
export type RepeatGuestsQueryInput = z.infer<typeof RepeatGuestsQuerySchema>;
export type HousekeepingReportQueryInput = z.infer<typeof HousekeepingReportQuerySchema>;
export type MaintenanceReportQueryInput = z.infer<typeof MaintenanceReportQuerySchema>;
export type ManagerDashboardQueryInput = z.infer<typeof ManagerDashboardQuerySchema>;
export type RevenueDashboardQueryInput = z.infer<typeof RevenueDashboardQuerySchema>;
export type OperationsDashboardQueryInput = z.infer<typeof OperationsDashboardQuerySchema>;
