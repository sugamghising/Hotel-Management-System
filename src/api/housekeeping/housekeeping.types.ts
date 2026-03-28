export type HousekeepingTaskType =
  | 'CLEANING_DEPARTURE'
  | 'CLEANING_STAYOVER'
  | 'CLEANING_TOUCHUP'
  | 'DEEP_CLEAN'
  | 'TURNDOWN_SERVICE'
  | 'INSPECTION'
  | 'SPECIAL_REQUEST';

export type HousekeepingTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'ISSUES_REPORTED'
  | 'DND'
  | 'CANCELLED';

export type InspectionOutcome = 'PASSED' | 'FAILED';
export type ShiftStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type LostFoundStatus = 'REPORTED' | 'STORED' | 'CLAIMED' | 'DISPOSED';

export type InspectionIssueSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface InspectionScores {
  bedding: number;
  bathroom: number;
  floors: number;
  amenities: number;
  furniture: number;
  general: number;
}

export interface InspectionFailureItem {
  area: keyof InspectionScores;
  issue: string;
  severity: InspectionIssueSeverity;
}

export interface CreateTaskInput {
  roomId: string;
  taskType: HousekeepingTaskType;
  scheduledFor: Date;
  priority?: number;
  notes?: string;
  guestRequests?: string;
  assignedTo?: string | null;
}

export interface UpdateTaskInput {
  priority?: number;
  notes?: string;
  guestRequests?: string;
  scheduledFor?: Date;
}

export interface AssignTaskInput {
  staffId: string;
}

export interface CompleteTaskInput {
  suppliesUsed?: Array<{ itemId: string; qty: number }>;
  photos?: string[];
  notes?: string;
  actualMinutes?: number;
}

export interface DndTaskInput {
  reason?: string;
}

export interface CancelTaskInput {
  reason: string;
}

export interface AutoGenerateTasksInput {
  date: Date;
}

export interface BulkAssignInput {
  date?: Date;
  taskIds?: string[];
  staffIds: string[];
}

export interface SubmitInspectionInput {
  taskId: string;
  scores: InspectionScores;
  failureItems?: InspectionFailureItem[];
  feedbackToStaff?: string;
  requiresMaintenance?: boolean;
}

export interface CreateShiftInput {
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  supervisorId?: string | null;
  notes?: string;
}

export interface UpdateShiftInput {
  startTime?: Date;
  endTime?: Date;
  status?: ShiftStatus;
  supervisorId?: string | null;
  notes?: string;
}

export interface AssignShiftStaffInput {
  staffIds: string[];
  role?: string;
  replaceExisting?: boolean;
}

export interface CreateLostFoundItemInput {
  roomId?: string;
  itemName: string;
  category: string;
  description?: string;
  locationFound: string;
  foundAt?: Date;
  storageLocation?: string;
  custodyNotes?: string;
  guestId?: string;
}

export interface UpdateLostFoundItemInput {
  status?: LostFoundStatus;
  storageLocation?: string;
  custodyNotes?: string;
  claimedByName?: string;
  claimedAt?: Date;
  disposedAt?: Date;
  disposalMethod?: string;
}

export interface NotifyLostFoundInput {
  message: string;
  channel?: 'SMS' | 'EMAIL' | 'PHONE' | 'IN_PERSON';
}

export interface HousekeepingTaskResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  roomId: string;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  priority: number;
  assignedTo: string | null;
  assignedAt: Date | null;
  scheduledFor: Date;
  estimatedMinutes: number;
  actualMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  completionNotes: string | null;
  completionPhotos: unknown;
  suppliesUsed: unknown;
  inspectionScore: number | null;
  issuesFound: string | null;
  dndAt: Date | null;
  dndBy: string | null;
  dndReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  notes: string | null;
  guestRequests: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface HousekeepingInspectionResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  taskId: string;
  roomId: string;
  staffId: string | null;
  inspectedBy: string;
  scores: InspectionScores;
  overallScore: number;
  outcome: InspectionOutcome;
  autoFailed: boolean;
  failureItems: InspectionFailureItem[];
  feedbackToStaff: string | null;
  requiresMaintenance: boolean;
  maintenanceRequestId: string | null;
  createdAt: Date;
}

export interface HousekeepingShiftAssignmentResponse {
  id: string;
  staffId: string;
  role: string | null;
  createdAt: Date;
}

export interface HousekeepingShiftResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  status: ShiftStatus;
  supervisorId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignments: HousekeepingShiftAssignmentResponse[];
}

export interface LostFoundItemResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  roomId: string | null;
  itemName: string;
  category: string;
  description: string | null;
  locationFound: string;
  foundBy: string;
  foundAt: Date;
  status: LostFoundStatus;
  storageLocation: string | null;
  custodyNotes: string | null;
  guestId: string | null;
  claimedByName: string | null;
  claimedAt: Date | null;
  disposedAt: Date | null;
  disposalMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HousekeepingTaskQueryFilters {
  status?: HousekeepingTaskStatus;
  taskType?: HousekeepingTaskType;
  assignedTo?: string;
  roomId?: string;
  from?: Date;
  to?: Date;
}

export interface HousekeepingInspectionQueryFilters {
  taskId?: string;
  roomId?: string;
  staffId?: string;
  outcome?: InspectionOutcome;
  from?: Date;
  to?: Date;
}

export interface HousekeepingShiftQueryFilters {
  date?: Date;
  from?: Date;
  to?: Date;
  status?: ShiftStatus;
}

export interface LostFoundQueryFilters {
  status?: LostFoundStatus;
  category?: string;
  roomId?: string;
  from?: Date;
  to?: Date;
}

export interface StaffScoreSummary {
  tasksCompleted: number;
  tasksInspected: number;
  passRate: number;
  averageScore: number;
  averageMinutesPerRoom: number;
  reinspectionRate: number;
}

export interface StaffScoreHistoryResponse {
  staffId: string;
  staffName: string;
  period: string;
  summary: StaffScoreSummary;
  categoryAverages: InspectionScores;
  weakArea: keyof InspectionScores;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
}

export interface StaffWorkloadItem {
  staffId: string;
  staffName: string;
  assignedTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  averageMinutesPerTask: number;
  activeShifts: number;
}

export interface DashboardShiftSummary {
  planned: number;
  active: number;
  completed: number;
  cancelled: number;
}

export interface DashboardLostFoundSummary {
  reported: number;
  stored: number;
  claimed: number;
  disposed: number;
}

export interface DashboardInspectionSummary {
  passed: number;
  failed: number;
  passRate: number;
}

export interface HousekeepingDashboardSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  verified: number;
  issues: number;
  dnd: number;
  cancelled: number;
}

export interface HousekeepingDashboardResponse {
  date: string;
  tasks: HousekeepingDashboardSummary;
  shifts: DashboardShiftSummary;
  lostFound: DashboardLostFoundSummary;
  inspections: DashboardInspectionSummary;
}
