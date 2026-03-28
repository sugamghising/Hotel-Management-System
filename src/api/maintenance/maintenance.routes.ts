import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requireAnyPermission, requirePermission } from '../../core/middleware/requirePermission';
import { maintenanceController } from './maintenance.controller';
import {
  AssetIdParamSchema,
  AssignMaintenanceRequestSchema,
  CancelMaintenanceRequestSchema,
  CompleteMaintenanceRequestSchema,
  CreateAssetSchema,
  CreateMaintenanceRequestSchema,
  CreatePreventiveScheduleSchema,
  EscalateMaintenanceRequestSchema,
  GenerateDuePreventiveSchema,
  HotelIdParamSchema,
  ListAssetsQuerySchema,
  ListMaintenanceRequestsQuerySchema,
  ListPreventiveSchedulesQuerySchema,
  LogPartsSchema,
  MaintenanceDashboardQuerySchema,
  OrganizationIdParamSchema,
  PauseMaintenanceRequestSchema,
  PostGuestChargeSchema,
  RequestIdParamSchema,
  ScheduleIdParamSchema,
  ScheduleMaintenanceRequestSchema,
  UpdateAssetSchema,
  UpdateMaintenanceRequestSchema,
  VerifyMaintenanceRequestSchema,
} from './maintenance.dto';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OrgHotelRequestParams = OrgHotelParams.merge(RequestIdParamSchema);
const OrgHotelScheduleParams = OrgHotelParams.merge(ScheduleIdParamSchema);
const OrgHotelAssetParams = OrgHotelParams.merge(AssetIdParamSchema);

// ============================================================================
// MAINTENANCE REQUESTS
// ============================================================================

router.post(
  '/requests',
  requirePermission('MAINTENANCE.CREATE'),
  validate({ params: OrgHotelParams, body: CreateMaintenanceRequestSchema }),
  maintenanceController.createRequest
);

router.get(
  '/requests',
  requirePermission('MAINTENANCE.READ'),
  validate({ params: OrgHotelParams, query: ListMaintenanceRequestsQuerySchema }),
  maintenanceController.listRequests
);

router.get(
  '/requests/:requestId',
  requirePermission('MAINTENANCE.READ'),
  validate({ params: OrgHotelRequestParams }),
  maintenanceController.getRequestDetail
);

router.patch(
  '/requests/:requestId',
  requirePermission('MAINTENANCE.UPDATE'),
  validate({ params: OrgHotelRequestParams, body: UpdateMaintenanceRequestSchema }),
  maintenanceController.updateRequest
);

router.post(
  '/requests/:requestId/acknowledge',
  requirePermission('MAINTENANCE.UPDATE'),
  validate({ params: OrgHotelRequestParams }),
  maintenanceController.acknowledgeRequest
);

router.post(
  '/requests/:requestId/assign',
  requirePermission('MAINTENANCE.ASSIGN'),
  validate({ params: OrgHotelRequestParams, body: AssignMaintenanceRequestSchema }),
  maintenanceController.assignRequest
);

router.post(
  '/requests/:requestId/schedule',
  requirePermission('MAINTENANCE.UPDATE'),
  validate({ params: OrgHotelRequestParams, body: ScheduleMaintenanceRequestSchema }),
  maintenanceController.scheduleRequest
);

router.post(
  '/requests/:requestId/start',
  requirePermission('MAINTENANCE.START'),
  validate({ params: OrgHotelRequestParams }),
  maintenanceController.startRequest
);

router.post(
  '/requests/:requestId/pause',
  requirePermission('MAINTENANCE.PAUSE'),
  validate({ params: OrgHotelRequestParams, body: PauseMaintenanceRequestSchema }),
  maintenanceController.pauseRequest
);

router.post(
  '/requests/:requestId/log-parts',
  requireAnyPermission('MAINTENANCE.PARTS_LOG', 'INVENTORY.CONSUME'),
  validate({ params: OrgHotelRequestParams, body: LogPartsSchema }),
  maintenanceController.logParts
);

router.post(
  '/requests/:requestId/complete',
  requirePermission('MAINTENANCE.COMPLETE'),
  validate({ params: OrgHotelRequestParams, body: CompleteMaintenanceRequestSchema }),
  maintenanceController.completeRequest
);

router.post(
  '/requests/:requestId/verify',
  requirePermission('MAINTENANCE.VERIFY'),
  validate({ params: OrgHotelRequestParams, body: VerifyMaintenanceRequestSchema }),
  maintenanceController.verifyRequest
);

router.post(
  '/requests/:requestId/cancel',
  requirePermission('MAINTENANCE.CANCEL'),
  validate({ params: OrgHotelRequestParams, body: CancelMaintenanceRequestSchema }),
  maintenanceController.cancelRequest
);

router.post(
  '/requests/:requestId/escalate',
  requirePermission('MAINTENANCE.ESCALATE'),
  validate({ params: OrgHotelRequestParams, body: EscalateMaintenanceRequestSchema }),
  maintenanceController.escalateRequest
);

router.post(
  '/requests/:requestId/guest-charge',
  requirePermission('MAINTENANCE.GUEST_CHARGE'),
  validate({ params: OrgHotelRequestParams, body: PostGuestChargeSchema }),
  maintenanceController.postGuestCharge
);

router.get(
  '/dashboard',
  requirePermission('MAINTENANCE.DASHBOARD_READ'),
  validate({ params: OrgHotelParams, query: MaintenanceDashboardQuerySchema }),
  maintenanceController.getDashboard
);

// ============================================================================
// PREVENTIVE SCHEDULES
// ============================================================================

router.post(
  '/preventive/schedules',
  requirePermission('PREVENTIVE.CREATE'),
  validate({ params: OrgHotelParams, body: CreatePreventiveScheduleSchema }),
  maintenanceController.createPreventiveSchedule
);

router.get(
  '/preventive/schedules',
  requirePermission('PREVENTIVE.READ'),
  validate({ params: OrgHotelParams, query: ListPreventiveSchedulesQuerySchema }),
  maintenanceController.listPreventiveSchedules
);

router.post(
  '/preventive/schedules/generate-due',
  requirePermission('PREVENTIVE.GENERATE'),
  validate({ params: OrgHotelParams, body: GenerateDuePreventiveSchema }),
  maintenanceController.generateDuePreventive
);

router.post(
  '/preventive/schedules/:scheduleId/pause',
  requirePermission('PREVENTIVE.PAUSE'),
  validate({ params: OrgHotelScheduleParams }),
  maintenanceController.pausePreventiveSchedule
);

// ============================================================================
// ASSETS
// ============================================================================

router.post(
  '/assets',
  requirePermission('ASSET.CREATE'),
  validate({ params: OrgHotelParams, body: CreateAssetSchema }),
  maintenanceController.createAsset
);

router.get(
  '/assets',
  requirePermission('ASSET.READ'),
  validate({ params: OrgHotelParams, query: ListAssetsQuerySchema }),
  maintenanceController.listAssets
);

router.get(
  '/assets/:assetId',
  requirePermission('ASSET.READ'),
  validate({ params: OrgHotelAssetParams }),
  maintenanceController.getAssetDetail
);

router.patch(
  '/assets/:assetId',
  requirePermission('ASSET.UPDATE'),
  validate({ params: OrgHotelAssetParams, body: UpdateAssetSchema }),
  maintenanceController.updateAsset
);

router.post(
  '/assets/:assetId/evaluate',
  requirePermission('ASSET.EVALUATE'),
  validate({ params: OrgHotelAssetParams }),
  maintenanceController.evaluateAsset
);

export default router;
