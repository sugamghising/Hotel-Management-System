import { AuditRollbackNotAllowedError } from '../../core/errors';
import type { NightAudit, NightAuditStatus } from '../../generated/prisma';

const ELIGIBLE_ROLLBACK_STATUSES: ReadonlySet<NightAuditStatus> = new Set(['COMPLETED', 'FAILED']);

/**
 * Normalizes a timestamp to the UTC business-date boundary (`00:00:00.000`).
 *
 * This helper keeps rollback eligibility checks stable across time zones by comparing
 * only date components and ignoring wall-clock time.
 *
 * @param value - Source timestamp to normalize.
 * @returns Date-only UTC value used for deterministic rollback-window comparisons.
 */
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Adds a UTC day offset to a business date and returns a normalized date-only value.
 *
 * Rollback rules allow execution when the hotel's current business date matches either
 * the audit date or the next day, so this helper computes the "audit + 1 day" boundary.
 *
 * @param value - Base business date.
 * @param days - Number of UTC calendar days to add (positive, zero, or negative).
 * @returns Shifted date normalized to UTC date-only precision.
 */
const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return asDateOnly(next);
};

/**
 * Aggregated counters returned after a successful rollback transaction.
 *
 * Each property represents a persisted state transition performed in the rollback flow:
 * voided folio charges, reservation status reversals, and cancelled operational tasks.
 */
export interface NightAuditRollbackSummary {
  voidedRoomCharges: number;
  revertedNoShows: number;
  cancelledStayoverTasks: number;
  cancelledPreventiveRequests: number;
}

/**
 * Validates whether a night audit can be rolled back under domain safety rules.
 *
 * The caller must already have scoped `targetAudit` and `latestAudit` to the same
 * organization/hotel pair. This guard enforces that only terminal audits
 * (`COMPLETED`/`FAILED`) are eligible, only the latest hotel audit can be reversed,
 * and rollback can happen only while the hotel's current business date is either the
 * audit date or the immediate next business date.
 *
 * @param targetAudit - Audit record requested for rollback.
 * @param latestAudit - Latest audit currently stored for the same hotel scope.
 * @param currentBusinessDate - Hotel's current business date used for rollback window checks.
 * @throws {AuditRollbackNotAllowedError} When status, recency, or business-date window rules fail.
 */
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
