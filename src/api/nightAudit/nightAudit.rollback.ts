import { AuditRollbackNotAllowedError } from '../../core/errors';
import type { NightAudit, NightAuditStatus } from '../../generated/prisma';

const ELIGIBLE_ROLLBACK_STATUSES: ReadonlySet<NightAuditStatus> = new Set(['COMPLETED', 'FAILED']);

const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return asDateOnly(next);
};

export interface NightAuditRollbackSummary {
  voidedRoomCharges: number;
  revertedNoShows: number;
  cancelledStayoverTasks: number;
  cancelledPreventiveRequests: number;
}

export const assertRollbackAllowed = (
  targetAudit: NightAudit,
  latestAudit: NightAudit,
  currentBusinessDate: Date
): void => {
  if (!ELIGIBLE_ROLLBACK_STATUSES.has(targetAudit.status)) {
    throw new AuditRollbackNotAllowedError('Only completed or failed audits can be rolled back');
  }

  if (targetAudit.id !== latestAudit.id) {
    throw new AuditRollbackNotAllowedError(
      'Can only rollback the latest night audit for this hotel'
    );
  }

  const current = asDateOnly(currentBusinessDate).getTime();
  const target = asDateOnly(targetAudit.businessDate).getTime();
  const targetPlusOne = addDays(targetAudit.businessDate, 1).getTime();

  if (current !== target && current !== targetPlusOne) {
    throw new AuditRollbackNotAllowedError(
      "Can only rollback the most recent audit for today's business date"
    );
  }
};
