import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { nightAuditController } from './nightAudit.controller';
import {
  HotelIdParamSchema,
  NightAuditDateQuerySchema,
  NightAuditHistoryQuerySchema,
  NightAuditReportQuerySchema,
  OrganizationIdParamSchema,
  RollbackNightAuditSchema,
  RunNightAuditSchema,
} from './nightAudit.schema';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);

router.get(
  '/night-audit/pre-check',
  requirePermission('NIGHT_AUDIT.PRE_CHECK'),
  validate({ params: OrgHotelParams, query: NightAuditDateQuerySchema }),
  nightAuditController.preCheck
);

router.post(
  '/night-audit/run',
  requirePermission('NIGHT_AUDIT.RUN'),
  validate({ params: OrgHotelParams, body: RunNightAuditSchema }),
  nightAuditController.runAudit
);

router.get(
  '/night-audit/status',
  requirePermission('NIGHT_AUDIT.VIEW_STATUS'),
  validate({ params: OrgHotelParams }),
  nightAuditController.getStatus
);

router.get(
  '/night-audit/history',
  requirePermission('NIGHT_AUDIT.VIEW_HISTORY'),
  validate({ params: OrgHotelParams, query: NightAuditHistoryQuerySchema }),
  nightAuditController.getHistory
);

router.get(
  '/night-audit/report',
  requirePermission('NIGHT_AUDIT.VIEW_REPORT'),
  validate({ params: OrgHotelParams, query: NightAuditReportQuerySchema }),
  nightAuditController.getReport
);

router.post(
  '/night-audit/rollback',
  requirePermission('NIGHT_AUDIT.ROLLBACK'),
  validate({ params: OrgHotelParams, body: RollbackNightAuditSchema }),
  nightAuditController.rollback
);

export default router;
