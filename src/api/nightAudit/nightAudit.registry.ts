import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  HotelIdParamSchema,
  NightAuditDateQuerySchema,
  NightAuditHistoryQuerySchema,
  NightAuditReportQuerySchema,
  OrganizationIdParamSchema,
  RollbackNightAuditSchema,
  RunNightAuditSchema,
} from './nightAudit.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);

const NightAuditStepSchema = z.object({
  step: z.number().int(),
  code: z.string(),
  status: z.enum(['SUCCESS', 'FAILED']),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

const NightAuditReportSchema = z.object({
  id: z.string().uuid(),
  hotelId: z.string().uuid(),
  businessDate: z.string(),
  status: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  performedBy: z.string().uuid().nullable(),
  checks: z.object({
    unbalancedFolios: z.number().int(),
    uncheckedOutRes: z.number().int(),
    pendingCharges: z.number().int(),
    roomDiscrepancies: z.number().int(),
  }),
  financial: z.object({
    roomRevenue: z.number(),
    otherRevenue: z.number(),
    paymentsReceived: z.number(),
  }),
  actions: z.object({
    autoPostedCharges: z.number().int(),
    noShowsMarked: z.number().int(),
    stayoverTasksGenerated: z.number().int(),
    preventiveTasksGenerated: z.number().int(),
    escalationsProcessed: z.number().int(),
  }),
  notes: z.string().nullable(),
  steps: z.array(NightAuditStepSchema),
  warningCount: z.number().int(),
});

const PreCheckSchema = z.object({
  businessDate: z.string(),
  unbalancedFolios: z.number().int(),
  uncheckedOutRes: z.number().int(),
  pendingCharges: z.number().int(),
  roomDiscrepancies: z.number().int(),
  uncheckedOutReservationIds: z.array(z.string().uuid()),
  blockers: z.array(z.string()),
  canRun: z.boolean(),
});

export const nightAuditRegistry = new OpenAPIRegistry();

nightAuditRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/pre-check',
  tags: ['NightAudit'],
  summary: 'Run night audit pre-check',
  request: {
    params: OrgHotelParams,
    query: NightAuditDateQuerySchema,
  },
  responses: createApiResponse(z.object({ preCheck: PreCheckSchema }), 'Pre-check completed'),
});

nightAuditRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/run',
  tags: ['NightAudit'],
  summary: 'Run night audit',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: RunNightAuditSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({
      result: z.object({
        audit: NightAuditReportSchema,
        preCheck: PreCheckSchema,
        nextBusinessDate: z.string(),
      }),
    }),
    'Night audit completed'
  ),
});

nightAuditRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/status',
  tags: ['NightAudit'],
  summary: 'Get latest night audit status',
  request: {
    params: OrgHotelParams,
  },
  responses: createApiResponse(
    z.object({
      status: z.object({
        currentBusinessDate: z.string(),
        latestAudit: NightAuditReportSchema.nullable(),
      }),
    }),
    'Night audit status retrieved'
  ),
});

nightAuditRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/history',
  tags: ['NightAudit'],
  summary: 'Get night audit history',
  request: {
    params: OrgHotelParams,
    query: NightAuditHistoryQuerySchema,
  },
  responses: createApiResponse(
    z.object({
      history: z.object({
        items: z.array(NightAuditReportSchema),
        meta: z.object({
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
    }),
    'Night audit history retrieved'
  ),
});

nightAuditRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/report',
  tags: ['NightAudit'],
  summary: 'Get night audit report by latest, date, or id',
  request: {
    params: OrgHotelParams,
    query: NightAuditReportQuerySchema,
  },
  responses: createApiResponse(
    z.object({ report: NightAuditReportSchema }),
    'Night audit report retrieved'
  ),
});

nightAuditRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/rollback',
  tags: ['NightAudit'],
  summary: 'Rollback latest night audit',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: RollbackNightAuditSchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({
      result: z.object({
        auditId: z.string().uuid(),
        businessDate: z.string(),
        status: z.string(),
        rollback: z.object({
          voidedRoomCharges: z.number().int(),
          revertedNoShows: z.number().int(),
          cancelledStayoverTasks: z.number().int(),
          cancelledPreventiveRequests: z.number().int(),
        }),
      }),
    }),
    'Night audit rollback completed'
  ),
});
