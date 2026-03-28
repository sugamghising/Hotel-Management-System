import { z } from 'zod';

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const TaskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

export const InspectionIdParamSchema = z.object({
  inspId: z.string().uuid(),
});

export const ShiftIdParamSchema = z.object({
  shiftId: z.string().uuid(),
});

export const LostFoundItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
});

export const StaffIdParamSchema = z.object({
  staffId: z.string().uuid(),
});

export const RoomIdParamSchema = z.object({
  roomId: z.string().uuid(),
});

export const HousekeepingTaskTypeSchema = z.enum([
  'CLEANING_DEPARTURE',
  'CLEANING_STAYOVER',
  'CLEANING_TOUCHUP',
  'DEEP_CLEAN',
  'TURNDOWN_SERVICE',
  'INSPECTION',
  'SPECIAL_REQUEST',
]);

export const HousekeepingTaskStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'ISSUES_REPORTED',
  'DND',
  'CANCELLED',
]);

export const InspectionOutcomeSchema = z.enum(['PASSED', 'FAILED']);
export const ShiftStatusSchema = z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export const LostFoundStatusSchema = z.enum(['REPORTED', 'STORED', 'CLAIMED', 'DISPOSED']);

export const CreateTaskSchema = z.object({
  roomId: z.string().uuid(),
  taskType: HousekeepingTaskTypeSchema,
  scheduledFor: z.coerce.date(),
  priority: z.number().int().min(0).max(2).default(0),
  notes: z.string().max(2000).optional(),
  guestRequests: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export const TaskListQuerySchema = z.object({
  status: HousekeepingTaskStatusSchema.optional(),
  taskType: HousekeepingTaskTypeSchema.optional(),
  assignedTo: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const UpdateTaskSchema = z.object({
  priority: z.number().int().min(0).max(2).optional(),
  notes: z.string().max(2000).optional(),
  guestRequests: z.string().max(2000).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export const AssignTaskSchema = z.object({
  staffId: z.string().uuid(),
});

export const StartTaskSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const CompleteTaskSchema = z.object({
  suppliesUsed: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().positive(),
      })
    )
    .optional(),
  photos: z.array(z.string().url()).max(20).optional(),
  notes: z.string().max(2000).optional(),
  actualMinutes: z.number().int().positive().max(720).optional(),
});

export const DndTaskSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const CancelTaskSchema = z.object({
  reason: z.string().min(3).max(1000),
});

export const AutoGenerateTasksSchema = z.object({
  date: z.coerce.date(),
});

export const BulkAssignSchema = z
  .object({
    date: z.coerce.date().optional(),
    taskIds: z.array(z.string().uuid()).min(1).optional(),
    staffIds: z.array(z.string().uuid()).min(1),
  })
  .refine((value) => value.taskIds !== undefined || value.date !== undefined, {
    message: 'Either taskIds or date is required',
    path: ['taskIds'],
  });

export const InspectionScoresSchema = z.object({
  bedding: z.number().min(0).max(100),
  bathroom: z.number().min(0).max(100),
  floors: z.number().min(0).max(100),
  amenities: z.number().min(0).max(100),
  furniture: z.number().min(0).max(100),
  general: z.number().min(0).max(100),
});

export const InspectionFailureItemSchema = z.object({
  area: z.enum(['bedding', 'bathroom', 'floors', 'amenities', 'furniture', 'general']),
  issue: z.string().min(3).max(1000),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
});

export const SubmitInspectionSchema = z.object({
  taskId: z.string().uuid(),
  scores: InspectionScoresSchema,
  failureItems: z.array(InspectionFailureItemSchema).optional(),
  feedbackToStaff: z.string().max(2000).optional(),
  requiresMaintenance: z.boolean().default(false),
});

export const InspectionListQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  outcome: InspectionOutcomeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const StaffScoreQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const CreateShiftSchema = z
  .object({
    shiftDate: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    supervisorId: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: 'endTime must be greater than startTime',
    path: ['endTime'],
  });

export const UpdateShiftSchema = z
  .object({
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    status: ShiftStatusSchema.optional(),
    supervisorId: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (value) =>
      value.startTime === undefined ||
      value.endTime === undefined ||
      value.endTime > value.startTime,
    {
      message: 'endTime must be greater than startTime',
      path: ['endTime'],
    }
  );

export const AssignShiftStaffSchema = z.object({
  staffIds: z.array(z.string().uuid()).min(1),
  role: z.string().max(40).optional(),
  replaceExisting: z.boolean().default(false),
});

export const ShiftListQuerySchema = z.object({
  date: z.coerce.date().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: ShiftStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const StaffWorkloadQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const DashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const CreateLostFoundItemSchema = z.object({
  roomId: z.string().uuid().optional(),
  itemName: z.string().min(2).max(160),
  category: z.string().min(2).max(80),
  description: z.string().max(2000).optional(),
  locationFound: z.string().min(2).max(120),
  foundAt: z.coerce.date().optional(),
  storageLocation: z.string().max(120).optional(),
  custodyNotes: z.string().max(2000).optional(),
  guestId: z.string().uuid().optional(),
});

export const UpdateLostFoundItemSchema = z.object({
  status: LostFoundStatusSchema.optional(),
  storageLocation: z.string().max(120).optional(),
  custodyNotes: z.string().max(2000).optional(),
  claimedByName: z.string().max(180).optional(),
  claimedAt: z.coerce.date().optional(),
  disposedAt: z.coerce.date().optional(),
  disposalMethod: z.string().max(120).optional(),
});

export const LostFoundListQuerySchema = z.object({
  status: LostFoundStatusSchema.optional(),
  category: z.string().max(80).optional(),
  roomId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const NotifyLostFoundSchema = z.object({
  message: z.string().min(3).max(2000),
  channel: z.enum(['SMS', 'EMAIL', 'PHONE', 'IN_PERSON']).default('EMAIL'),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type TaskListQueryInput = z.infer<typeof TaskListQuerySchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;
export type StartTaskInput = z.infer<typeof StartTaskSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
export type DndTaskInput = z.infer<typeof DndTaskSchema>;
export type CancelTaskInput = z.infer<typeof CancelTaskSchema>;
export type AutoGenerateTasksInput = z.infer<typeof AutoGenerateTasksSchema>;
export type BulkAssignInput = z.infer<typeof BulkAssignSchema>;
export type SubmitInspectionInput = z.infer<typeof SubmitInspectionSchema>;
export type InspectionListQueryInput = z.infer<typeof InspectionListQuerySchema>;
export type StaffScoreQueryInput = z.infer<typeof StaffScoreQuerySchema>;
export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;
export type UpdateShiftInput = z.infer<typeof UpdateShiftSchema>;
export type AssignShiftStaffInput = z.infer<typeof AssignShiftStaffSchema>;
export type ShiftListQueryInput = z.infer<typeof ShiftListQuerySchema>;
export type StaffWorkloadQueryInput = z.infer<typeof StaffWorkloadQuerySchema>;
export type DashboardQueryInput = z.infer<typeof DashboardQuerySchema>;
export type CreateLostFoundItemInput = z.infer<typeof CreateLostFoundItemSchema>;
export type UpdateLostFoundItemInput = z.infer<typeof UpdateLostFoundItemSchema>;
export type LostFoundListQueryInput = z.infer<typeof LostFoundListQuerySchema>;
export type NotifyLostFoundInput = z.infer<typeof NotifyLostFoundSchema>;
