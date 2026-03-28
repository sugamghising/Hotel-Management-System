import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AssignShiftStaffSchema,
  AssignTaskSchema,
  AutoGenerateTasksSchema,
  BulkAssignSchema,
  CancelTaskSchema,
  CompleteTaskSchema,
  CreateLostFoundItemSchema,
  CreateShiftSchema,
  CreateTaskSchema,
  DashboardQuerySchema,
  DndTaskSchema,
  HotelIdParamSchema,
  InspectionIdParamSchema,
  InspectionListQuerySchema,
  LostFoundItemIdParamSchema,
  LostFoundListQuerySchema,
  NotifyLostFoundSchema,
  OrganizationIdParamSchema,
  RoomIdParamSchema,
  ShiftIdParamSchema,
  ShiftListQuerySchema,
  StaffIdParamSchema,
  StaffScoreQuerySchema,
  StaffWorkloadQuerySchema,
  StartTaskSchema,
  SubmitInspectionSchema,
  TaskIdParamSchema,
  TaskListQuerySchema,
  UpdateLostFoundItemSchema,
  UpdateShiftSchema,
  UpdateTaskSchema,
} from './housekeeping.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelTaskParams = OrgHotelParams.merge(TaskIdParamSchema);
const OrgHotelInspectionParams = OrgHotelParams.merge(InspectionIdParamSchema);
const OrgHotelStaffParams = OrgHotelParams.merge(StaffIdParamSchema);
const OrgHotelRoomParams = OrgHotelParams.merge(RoomIdParamSchema);
const OrgHotelShiftParams = OrgHotelParams.merge(ShiftIdParamSchema);
const OrgHotelLostFoundItemParams = OrgHotelParams.merge(LostFoundItemIdParamSchema);

const GenericTaskSchema = z.record(z.unknown());
const GenericInspectionSchema = z.record(z.unknown());
const GenericShiftSchema = z.record(z.unknown());
const GenericLostFoundSchema = z.record(z.unknown());

export const housekeepingRegistry = new OpenAPIRegistry();

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks',
  tags: ['Housekeeping'],
  summary: 'Create housekeeping task',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateTaskSchema } } },
  },
  responses: createApiResponse(
    z.object({ task: GenericTaskSchema }),
    'Housekeeping task created',
    StatusCodes.CREATED
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks',
  tags: ['Housekeeping'],
  summary: 'List housekeeping tasks',
  request: {
    params: OrgHotelParams,
    query: TaskListQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Housekeeping tasks retrieved'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/auto-generate',
  tags: ['Housekeeping'],
  summary: 'Auto-generate stayover tasks for a date',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: AutoGenerateTasksSchema } } },
  },
  responses: createApiResponse(z.object({ created: z.number().int() }), 'Stayover tasks generated'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/bulk-assign',
  tags: ['Housekeeping'],
  summary: 'Bulk assign pending tasks',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: BulkAssignSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Tasks bulk-assigned successfully'),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}',
  tags: ['Housekeeping'],
  summary: 'Get housekeeping task detail',
  request: { params: OrgHotelTaskParams },
  responses: createApiResponse(
    z.object({ task: GenericTaskSchema }),
    'Housekeeping task retrieved'
  ),
});

housekeepingRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}',
  tags: ['Housekeeping'],
  summary: 'Update housekeeping task',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: UpdateTaskSchema } } },
  },
  responses: createApiResponse(z.object({ task: GenericTaskSchema }), 'Housekeeping task updated'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/assign',
  tags: ['Housekeeping'],
  summary: 'Assign task to staff member',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: AssignTaskSchema } } },
  },
  responses: createApiResponse(z.object({ task: GenericTaskSchema }), 'Task assigned successfully'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/start',
  tags: ['Housekeeping'],
  summary: 'Start a housekeeping task',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: StartTaskSchema } } },
  },
  responses: createApiResponse(z.object({ task: GenericTaskSchema }), 'Task started successfully'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/complete',
  tags: ['Housekeeping'],
  summary: 'Complete a housekeeping task',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: CompleteTaskSchema } } },
  },
  responses: createApiResponse(
    z.object({ task: GenericTaskSchema }),
    'Task completed successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/dnd',
  tags: ['Housekeeping'],
  summary: 'Mark task as Do Not Disturb',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: DndTaskSchema } } },
  },
  responses: createApiResponse(z.object({ task: GenericTaskSchema }), 'Task marked as DND'),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/cancel',
  tags: ['Housekeeping'],
  summary: 'Cancel a housekeeping task',
  request: {
    params: OrgHotelTaskParams,
    body: { content: { 'application/json': { schema: CancelTaskSchema } } },
  },
  responses: createApiResponse(
    z.object({ task: GenericTaskSchema }),
    'Task cancelled successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/inspections',
  tags: ['Housekeeping'],
  summary: 'Submit inspection with scoring',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: SubmitInspectionSchema } } },
  },
  responses: createApiResponse(
    z.object({ inspection: GenericInspectionSchema }),
    'Inspection submitted successfully',
    StatusCodes.CREATED
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/inspections',
  tags: ['Housekeeping'],
  summary: 'List inspections',
  request: {
    params: OrgHotelParams,
    query: InspectionListQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Inspections retrieved successfully'),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/inspections/{inspId}',
  tags: ['Housekeeping'],
  summary: 'Get inspection detail',
  request: { params: OrgHotelInspectionParams },
  responses: createApiResponse(
    z.object({ inspection: GenericInspectionSchema }),
    'Inspection detail retrieved'
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/tasks/{taskId}/inspections',
  tags: ['Housekeeping'],
  summary: 'List inspections for a task',
  request: { params: OrgHotelTaskParams },
  responses: createApiResponse(
    z.object({ inspections: z.array(GenericInspectionSchema) }),
    'Task inspections retrieved successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/staff/{staffId}/scores',
  tags: ['Housekeeping'],
  summary: 'Get staff quality score history',
  request: {
    params: OrgHotelStaffParams,
    query: StaffScoreQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Staff quality history retrieved'),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/rooms/{roomId}/inspections',
  tags: ['Housekeeping'],
  summary: 'Get room inspection history',
  request: { params: OrgHotelRoomParams },
  responses: createApiResponse(
    z.object({ inspections: z.array(GenericInspectionSchema) }),
    'Room inspection history retrieved'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/shifts',
  tags: ['Housekeeping'],
  summary: 'Create housekeeping shift',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateShiftSchema } } },
  },
  responses: createApiResponse(
    z.object({ shift: GenericShiftSchema }),
    'Shift created successfully',
    StatusCodes.CREATED
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/shifts',
  tags: ['Housekeeping'],
  summary: 'List housekeeping shifts',
  request: {
    params: OrgHotelParams,
    query: ShiftListQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Shifts retrieved'),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/shifts/{shiftId}',
  tags: ['Housekeeping'],
  summary: 'Get shift detail',
  request: {
    params: OrgHotelShiftParams,
  },
  responses: createApiResponse(
    z.object({ shift: GenericShiftSchema }),
    'Shift retrieved successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/shifts/{shiftId}',
  tags: ['Housekeeping'],
  summary: 'Update shift details',
  request: {
    params: OrgHotelShiftParams,
    body: { content: { 'application/json': { schema: UpdateShiftSchema } } },
  },
  responses: createApiResponse(
    z.object({ shift: GenericShiftSchema }),
    'Shift updated successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/shifts/{shiftId}/assign-staff',
  tags: ['Housekeeping'],
  summary: 'Assign staff to a shift',
  request: {
    params: OrgHotelShiftParams,
    body: { content: { 'application/json': { schema: AssignShiftStaffSchema } } },
  },
  responses: createApiResponse(
    z.object({ shift: GenericShiftSchema }),
    'Shift staff assigned successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/staff/workload',
  tags: ['Housekeeping'],
  summary: 'Get staff workload for a date',
  request: {
    params: OrgHotelParams,
    query: StaffWorkloadQuerySchema,
  },
  responses: createApiResponse(
    z.object({ workload: z.array(z.record(z.unknown())) }),
    'Staff workload retrieved successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/dashboard',
  tags: ['Housekeeping'],
  summary: 'Get housekeeping dashboard summary for a date',
  request: {
    params: OrgHotelParams,
    query: DashboardQuerySchema,
  },
  responses: createApiResponse(
    z.object({ dashboard: z.record(z.unknown()) }),
    'Housekeeping dashboard retrieved successfully'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/lost-found',
  tags: ['Housekeeping'],
  summary: 'Create lost and found item record',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateLostFoundItemSchema } } },
  },
  responses: createApiResponse(
    z.object({ item: GenericLostFoundSchema }),
    'Lost and found item created',
    StatusCodes.CREATED
  ),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/lost-found',
  tags: ['Housekeeping'],
  summary: 'List lost and found records',
  request: {
    params: OrgHotelParams,
    query: LostFoundListQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Lost and found items retrieved'),
});

housekeepingRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/lost-found/{itemId}',
  tags: ['Housekeeping'],
  summary: 'Get lost and found record detail',
  request: {
    params: OrgHotelLostFoundItemParams,
  },
  responses: createApiResponse(
    z.object({ item: GenericLostFoundSchema }),
    'Lost and found item retrieved'
  ),
});

housekeepingRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/lost-found/{itemId}',
  tags: ['Housekeeping'],
  summary: 'Update lost and found record',
  request: {
    params: OrgHotelLostFoundItemParams,
    body: { content: { 'application/json': { schema: UpdateLostFoundItemSchema } } },
  },
  responses: createApiResponse(
    z.object({ item: GenericLostFoundSchema }),
    'Lost and found item updated'
  ),
});

housekeepingRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/housekeeping/lost-found/{itemId}/notify',
  tags: ['Housekeeping'],
  summary: 'Notify owner about a lost and found item',
  request: {
    params: OrgHotelLostFoundItemParams,
    body: { content: { 'application/json': { schema: NotifyLostFoundSchema } } },
  },
  responses: createApiResponse(
    z.object({ notification: z.record(z.unknown()) }),
    'Lost and found owner notified'
  ),
});
