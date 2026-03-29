import type { NightAuditStatus } from '../../generated/prisma';

export type NightAuditStepCode =
  | 'PRE_CHECK_SNAPSHOT'
  | 'PRE_CHECK_BLOCKERS'
  | 'POST_ROOM_CHARGES'
  | 'MARK_NO_SHOWS'
  | 'GENERATE_STAYOVER_TASKS'
  | 'GENERATE_PREVENTIVE_TASKS'
  | 'RUN_ESCALATION_SWEEP'
  | 'ADVANCE_BUSINESS_DATE';

export type NightAuditStepStatus = 'SUCCESS' | 'FAILED';

export interface NightAuditStepResult {
  step: number;
  code: NightAuditStepCode;
  status: NightAuditStepStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface NightAuditPreCheckSnapshot {
  businessDate: Date;
  unbalancedFolios: number;
  uncheckedOutRes: number;
  pendingCharges: number;
  roomDiscrepancies: number;
  uncheckedOutReservationIds: string[];
  blockers: string[];
  canRun: boolean;
}

export interface NightAuditFinancialSummary {
  roomRevenue: number;
  otherRevenue: number;
  paymentsReceived: number;
}

export interface NightAuditActionSummary {
  autoPostedCharges: number;
  noShowsMarked: number;
  stayoverTasksGenerated: number;
  preventiveTasksGenerated: number;
  escalationsProcessed: number;
}

export interface NightAuditReportResponse {
  id: string;
  hotelId: string;
  businessDate: Date;
  status: NightAuditStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  performedBy: string | null;
  checks: {
    unbalancedFolios: number;
    uncheckedOutRes: number;
    pendingCharges: number;
    roomDiscrepancies: number;
  };
  financial: NightAuditFinancialSummary;
  actions: NightAuditActionSummary;
  notes: string | null;
  steps: NightAuditStepResult[];
  warningCount: number;
}

export interface NightAuditRunResponse {
  audit: NightAuditReportResponse;
  preCheck: NightAuditPreCheckSnapshot;
  nextBusinessDate: Date;
}

export interface NightAuditStatusResponse {
  currentBusinessDate: Date;
  latestAudit: NightAuditReportResponse | null;
}

export interface NightAuditHistoryResponse {
  items: NightAuditReportResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface NightAuditRollbackResponse {
  auditId: string;
  businessDate: Date;
  status: NightAuditStatus;
  rollback: {
    voidedRoomCharges: number;
    revertedNoShows: number;
    cancelledStayoverTasks: number;
    cancelledPreventiveRequests: number;
  };
}
