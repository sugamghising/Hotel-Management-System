import { z } from 'zod';

const parseCsvArray = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return value;
};

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const RequestIdParamSchema = z.object({
  requestId: z.string().uuid(),
});

export const ScheduleIdParamSchema = z.object({
  scheduleId: z.string().uuid(),
});

export const AssetIdParamSchema = z.object({
  assetId: z.string().uuid(),
});

export const MaintenanceCategorySchema = z.enum([
  'PLUMBING',
  'ELECTRICAL',
  'HVAC',
  'FURNITURE',
  'APPLIANCE',
  'STRUCTURAL',
  'PAINTING',
  'CLEANING',
  'SAFETY',
  'IT_EQUIPMENT',
  'OTHER',
]);

export const MaintenancePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'EMERGENCY']);

export const MaintenanceRequestStatusSchema = z.enum([
  'REPORTED',
  'ACKNOWLEDGED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_PARTS',
  'COMPLETED',
  'VERIFIED',
  'CANCELLED',
]);

export const RecurrenceFrequencySchema = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'CUSTOM',
]);

export const CreateMaintenanceRequestSchema = z.object({
  roomId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  preventiveScheduleId: z.string().uuid().optional(),
  category: MaintenanceCategorySchema,
  priority: MaintenancePrioritySchema.default('MEDIUM'),
  title: z.string().min(3).max(255),
  description: z.string().min(3).max(8000),
  source: z.string().max(30).default('MANUAL'),
  locationDetails: z.string().max(255).optional(),
  reportedByType: z.enum(['STAFF', 'GUEST', 'SYSTEM']).default('STAFF'),
  scheduledFor: z.coerce.date().optional(),
  estimatedHours: z.number().positive().max(720).optional(),
  targetCompletionAt: z.coerce.date().optional(),
  roomOutOfOrder: z.boolean().default(false),
  oooUntil: z.coerce.date().optional(),
  forceRoomOutOfOrder: z.boolean().default(false),
});

export const UpdateMaintenanceRequestSchema = z.object({
  category: MaintenanceCategorySchema.optional(),
  priority: MaintenancePrioritySchema.optional(),
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(3).max(8000).optional(),
  locationDetails: z.string().max(255).optional(),
  scheduledFor: z.coerce.date().optional(),
  estimatedHours: z.number().positive().max(720).optional(),
  targetCompletionAt: z.coerce.date().optional(),
  roomOutOfOrder: z.boolean().optional(),
  oooUntil: z.coerce.date().optional(),
});

export const AssignMaintenanceRequestSchema = z.object({
  assignedTo: z.string().uuid(),
});

export const ScheduleMaintenanceRequestSchema = z.object({
  scheduledFor: z.coerce.date(),
  estimatedHours: z.number().positive().max(720).optional(),
  targetCompletionAt: z.coerce.date().optional(),
});

export const PauseMaintenanceRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const PartsUsageItemSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().positive(),
  notes: z.string().max(1000).optional(),
});

export const LogPartsSchema = z.object({
  parts: z.array(PartsUsageItemSchema).min(1),
});

export const CompleteMaintenanceRequestSchema = z.object({
  resolution: z.string().min(3).max(8000),
  laborCost: z.number().min(0).optional(),
  vendorCost: z.number().min(0).optional(),
  clearRoomOutOfOrder: z.boolean().default(false),
  parts: z.array(PartsUsageItemSchema).optional(),
});

export const VerifyMaintenanceRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const CancelMaintenanceRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const EscalateMaintenanceRequestSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const PostGuestChargeSchema = z.object({
  reservationId: z.string().uuid().optional(),
  amount: z.number().positive(),
  description: z.string().min(3).max(255),
  taxAmount: z.number().min(0).default(0),
  revenueCode: z.string().max(50).optional(),
  department: z.string().max(50).optional(),
});

export const ListMaintenanceRequestsQuerySchema = z.object({
  status: z.preprocess(parseCsvArray, z.array(MaintenanceRequestStatusSchema).optional()),
  priority: z.preprocess(parseCsvArray, z.array(MaintenancePrioritySchema).optional()),
  category: z.preprocess(parseCsvArray, z.array(MaintenanceCategorySchema).optional()),
  assignedTo: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  overdue: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        return value === 'true';
      }

      return value;
    }, z.boolean().optional())
    .optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const MaintenanceDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const CreatePreventiveScheduleSchema = z
  .object({
    roomId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    title: z.string().min(3).max(255),
    description: z.string().max(4000).optional(),
    category: MaintenanceCategorySchema,
    priority: MaintenancePrioritySchema.default('MEDIUM'),
    frequency: RecurrenceFrequencySchema,
    frequencyValue: z.coerce.number().int().positive().default(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    estimatedHours: z.number().positive().max(720).optional(),
    defaultTitle: z.string().max(255).optional(),
    defaultDescription: z.string().max(4000).optional(),
    autoAssignTo: z.string().uuid().optional(),
  })
  .refine((value) => value.roomId !== undefined || value.assetId !== undefined, {
    message: 'Either roomId or assetId is required',
    path: ['roomId'],
  });

export const ListPreventiveSchedulesQuerySchema = z.object({
  active: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        return value === 'true';
      }

      return value;
    }, z.boolean().optional())
    .optional(),
  roomId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  frequency: RecurrenceFrequencySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const GenerateDuePreventiveSchema = z.object({
  date: z.coerce.date().optional(),
  scheduleId: z.string().uuid().optional(),
});

export const CreateAssetSchema = z.object({
  roomId: z.string().uuid().optional(),
  assetTag: z.string().min(2).max(100),
  name: z.string().min(2).max(255),
  category: z.string().min(2).max(100),
  manufacturer: z.string().max(100).optional(),
  modelNumber: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.coerce.date().optional(),
  installDate: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
  lifeExpectancyMonths: z.coerce.number().int().positive().max(600).optional(),
  notes: z.string().max(4000).optional(),
});

export const UpdateAssetSchema = z.object({
  roomId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(255).optional(),
  category: z.string().min(2).max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  modelNumber: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  status: z.string().max(30).optional(),
  purchaseDate: z.coerce.date().optional(),
  installDate: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
  lifeExpectancyMonths: z.coerce.number().int().positive().max(600).optional(),
  notes: z.string().max(4000).optional(),
  isActive: z.boolean().optional(),
});

export const ListAssetsQuerySchema = z.object({
  active: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        return value === 'true';
      }

      return value;
    }, z.boolean().optional())
    .optional(),
  roomId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateMaintenanceRequestInput = z.infer<typeof CreateMaintenanceRequestSchema>;
export type UpdateMaintenanceRequestInput = z.infer<typeof UpdateMaintenanceRequestSchema>;
export type AssignMaintenanceRequestInput = z.infer<typeof AssignMaintenanceRequestSchema>;
export type ScheduleMaintenanceRequestInput = z.infer<typeof ScheduleMaintenanceRequestSchema>;
export type PauseMaintenanceRequestInput = z.infer<typeof PauseMaintenanceRequestSchema>;
export type LogPartsInput = z.infer<typeof LogPartsSchema>;
export type CompleteMaintenanceRequestInput = z.infer<typeof CompleteMaintenanceRequestSchema>;
export type VerifyMaintenanceRequestInput = z.infer<typeof VerifyMaintenanceRequestSchema>;
export type CancelMaintenanceRequestInput = z.infer<typeof CancelMaintenanceRequestSchema>;
export type EscalateMaintenanceRequestInput = z.infer<typeof EscalateMaintenanceRequestSchema>;
export type PostGuestChargeInput = z.infer<typeof PostGuestChargeSchema>;
export type ListMaintenanceRequestsQueryInput = z.infer<typeof ListMaintenanceRequestsQuerySchema>;
export type MaintenanceDashboardQueryInput = z.infer<typeof MaintenanceDashboardQuerySchema>;
export type CreatePreventiveScheduleInput = z.infer<typeof CreatePreventiveScheduleSchema>;
export type ListPreventiveSchedulesQueryInput = z.infer<typeof ListPreventiveSchedulesQuerySchema>;
export type GenerateDuePreventiveInput = z.infer<typeof GenerateDuePreventiveSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;
export type ListAssetsQueryInput = z.infer<typeof ListAssetsQuerySchema>;
