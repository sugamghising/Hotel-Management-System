import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AssetIdParamSchema,
  AssignMaintenanceRequestSchema,
  CompleteMaintenanceRequestSchema,
  CreateAssetSchema,
  CreateMaintenanceRequestSchema,
  CreatePreventiveScheduleSchema,
  GenerateDuePreventiveSchema,
  HotelIdParamSchema,
  ListAssetsQuerySchema,
  ListMaintenanceRequestsQuerySchema,
  ListPreventiveSchedulesQuerySchema,
  LogPartsSchema,
  MaintenanceDashboardQuerySchema,
  OrganizationIdParamSchema,
  PostGuestChargeSchema,
  RequestIdParamSchema,
  UpdateAssetSchema,
  UpdateMaintenanceRequestSchema,
} from './maintenance.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelRequestParams = OrgHotelParams.merge(RequestIdParamSchema);
const OrgHotelAssetParams = OrgHotelParams.merge(AssetIdParamSchema);

const GenericRequestSchema = z.record(z.unknown());
const GenericAssetSchema = z.record(z.unknown());
const GenericScheduleSchema = z.record(z.unknown());

export const maintenanceRegistry = new OpenAPIRegistry();

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests',
  tags: ['Maintenance'],
  summary: 'Create maintenance request',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateMaintenanceRequestSchema } } },
  },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema, warnings: z.array(z.record(z.unknown())) }),
    'Maintenance request created successfully',
    StatusCodes.CREATED
  ),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests',
  tags: ['Maintenance'],
  summary: 'List maintenance requests',
  request: {
    params: OrgHotelParams,
    query: ListMaintenanceRequestsQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Maintenance requests retrieved'),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}',
  tags: ['Maintenance'],
  summary: 'Get maintenance request detail',
  request: { params: OrgHotelRequestParams },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema }),
    'Maintenance request retrieved'
  ),
});

maintenanceRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}',
  tags: ['Maintenance'],
  summary: 'Update maintenance request',
  request: {
    params: OrgHotelRequestParams,
    body: { content: { 'application/json': { schema: UpdateMaintenanceRequestSchema } } },
  },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema }),
    'Maintenance request updated'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}/assign',
  tags: ['Maintenance'],
  summary: 'Assign maintenance request',
  request: {
    params: OrgHotelRequestParams,
    body: { content: { 'application/json': { schema: AssignMaintenanceRequestSchema } } },
  },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema }),
    'Maintenance request assigned'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}/log-parts',
  tags: ['Maintenance'],
  summary: 'Log consumed parts',
  request: {
    params: OrgHotelRequestParams,
    body: { content: { 'application/json': { schema: LogPartsSchema } } },
  },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema }),
    'Parts logged successfully'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}/complete',
  tags: ['Maintenance'],
  summary: 'Complete maintenance request',
  request: {
    params: OrgHotelRequestParams,
    body: { content: { 'application/json': { schema: CompleteMaintenanceRequestSchema } } },
  },
  responses: createApiResponse(
    z.object({ request: GenericRequestSchema }),
    'Maintenance request completed'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/requests/{requestId}/guest-charge',
  tags: ['Maintenance'],
  summary: 'Post maintenance guest charge to folio',
  request: {
    params: OrgHotelRequestParams,
    body: { content: { 'application/json': { schema: PostGuestChargeSchema } } },
  },
  responses: createApiResponse(z.record(z.unknown()), 'Guest charge posted successfully'),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/dashboard',
  tags: ['Maintenance'],
  summary: 'Get maintenance dashboard summary',
  request: {
    params: OrgHotelParams,
    query: MaintenanceDashboardQuerySchema,
  },
  responses: createApiResponse(
    z.object({ dashboard: z.record(z.unknown()) }),
    'Maintenance dashboard retrieved'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/preventive/schedules',
  tags: ['PreventiveMaintenance'],
  summary: 'Create preventive schedule',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreatePreventiveScheduleSchema } } },
  },
  responses: createApiResponse(
    z.object({ schedule: GenericScheduleSchema }),
    'Preventive schedule created',
    StatusCodes.CREATED
  ),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/preventive/schedules',
  tags: ['PreventiveMaintenance'],
  summary: 'List preventive schedules',
  request: {
    params: OrgHotelParams,
    query: ListPreventiveSchedulesQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Preventive schedules retrieved'),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/preventive/schedules/generate-due',
  tags: ['PreventiveMaintenance'],
  summary: 'Generate due preventive work orders',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: GenerateDuePreventiveSchema } } },
  },
  responses: createApiResponse(
    z.object({ createdCount: z.number().int() }),
    'Due preventive tasks generated'
  ),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/assets',
  tags: ['Assets'],
  summary: 'Create maintenance asset',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateAssetSchema } } },
  },
  responses: createApiResponse(
    z.object({ asset: GenericAssetSchema }),
    'Asset created successfully',
    StatusCodes.CREATED
  ),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/assets',
  tags: ['Assets'],
  summary: 'List assets',
  request: {
    params: OrgHotelParams,
    query: ListAssetsQuerySchema,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Assets retrieved'),
});

maintenanceRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/assets/{assetId}',
  tags: ['Assets'],
  summary: 'Get asset detail',
  request: {
    params: OrgHotelAssetParams,
  },
  responses: createApiResponse(z.object({ asset: GenericAssetSchema }), 'Asset retrieved'),
});

maintenanceRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/assets/{assetId}',
  tags: ['Assets'],
  summary: 'Update asset',
  request: {
    params: OrgHotelAssetParams,
    body: { content: { 'application/json': { schema: UpdateAssetSchema } } },
  },
  responses: createApiResponse(z.object({ asset: GenericAssetSchema }), 'Asset updated'),
});

maintenanceRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/maintenance/assets/{assetId}/evaluate',
  tags: ['Assets'],
  summary: 'Evaluate repair vs replace recommendation',
  request: {
    params: OrgHotelAssetParams,
  },
  responses: createApiResponse(z.record(z.unknown()), 'Asset evaluation completed'),
});
