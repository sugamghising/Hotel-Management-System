import { z } from 'zod';

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const AuditIdParamSchema = z.object({
  auditId: z.string().uuid(),
});

export const NightAuditDateQuerySchema = z.object({
  businessDate: z.coerce.date().optional(),
});

export const RunNightAuditSchema = z.object({
  businessDate: z.coerce.date().optional(),
  notes: z.string().max(4000).optional(),
});

export const NightAuditHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const NightAuditReportQuerySchema = z.object({
  auditId: z.string().uuid().optional(),
  businessDate: z.coerce.date().optional(),
});

export const RollbackNightAuditSchema = z.object({
  auditId: z.string().uuid().optional(),
  reason: z.string().min(3).max(2000).optional(),
});

export type NightAuditDateQueryInput = z.infer<typeof NightAuditDateQuerySchema>;
export type RunNightAuditInput = z.infer<typeof RunNightAuditSchema>;
export type NightAuditHistoryQueryInput = z.infer<typeof NightAuditHistoryQuerySchema>;
export type NightAuditReportQueryInput = z.infer<typeof NightAuditReportQuerySchema>;
export type RollbackNightAuditInput = z.infer<typeof RollbackNightAuditSchema>;
