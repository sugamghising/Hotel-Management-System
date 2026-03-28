export type MaintenanceCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'HVAC'
  | 'FURNITURE'
  | 'APPLIANCE'
  | 'STRUCTURAL'
  | 'PAINTING'
  | 'CLEANING'
  | 'SAFETY'
  | 'IT_EQUIPMENT'
  | 'OTHER';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'EMERGENCY';

export type MaintenanceRequestStatus =
  | 'REPORTED'
  | 'ACKNOWLEDGED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PENDING_PARTS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'CANCELLED';

export type RecurrenceFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'CUSTOM';

export interface MaintenanceDashboardResponse {
  openCount: number;
  overdueCount: number;
  unassignedCount: number;
  emergencyOpenCount: number;
  completedTodayCount: number;
  averageResolutionHours: number;
  byPriority: Array<{
    priority: MaintenancePriority;
    count: number;
  }>;
  byStatus: Array<{
    status: MaintenanceRequestStatus;
    count: number;
  }>;
}

export interface AssetEvaluationResult {
  recommendation: 'MAINTAIN' | 'MONITOR' | 'REPLACE';
  signals: {
    highRepairCost: boolean;
    frequentFailures: boolean;
    nearEndOfLife: boolean;
  };
  metrics: {
    completedRequestsLast12Months: number;
    totalRepairCostLast12Months: number;
    ageMonths: number | null;
    lifeUtilizationRatio: number | null;
  };
}
