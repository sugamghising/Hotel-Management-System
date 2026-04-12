import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  AssignMaintenanceRequestInput,
  CancelMaintenanceRequestInput,
  CompleteMaintenanceRequestInput,
  CreateAssetInput,
  CreateMaintenanceRequestInput,
  CreatePreventiveScheduleInput,
  EscalateMaintenanceRequestInput,
  GenerateDuePreventiveInput,
  ListAssetsQueryInput,
  ListMaintenanceRequestsQueryInput,
  ListPreventiveSchedulesQueryInput,
  LogPartsInput,
  MaintenanceDashboardQueryInput,
  PostGuestChargeInput,
  ScheduleMaintenanceRequestInput,
  UpdateAssetInput,
  UpdateMaintenanceRequestInput,
  VerifyMaintenanceRequestInput,
} from './maintenance.schema';
import { maintenanceService } from './maintenance.service';

/**
 * Controller transport handlers for maintenance operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance.
 */
export class MaintenanceController {
  /**
   * Handles create request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateMaintenanceRequestInput;

    const data = await maintenanceService.createRequest(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(
        data,
        'Maintenance request created successfully',
        StatusCodes.CREATED
      ),
      res
    );
  });

  /**
   * Handles list requests requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listRequests = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListMaintenanceRequestsQueryInput;

    const data = await maintenanceService.listRequests(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance requests retrieved'), res);
  });

  /**
   * Handles get request detail requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getRequestDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };

    const data = await maintenanceService.getRequestDetail(organizationId, hotelId, requestId);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request retrieved'), res);
  });

  /**
   * Handles update request requests for maintenance operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as UpdateMaintenanceRequestInput;

    const data = await maintenanceService.updateRequest(organizationId, hotelId, requestId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request updated'), res);
  });

  /**
   * Handles acknowledge request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/acknowledge
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  acknowledgeRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };

    const data = await maintenanceService.acknowledgeRequest(organizationId, hotelId, requestId);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request acknowledged'), res);
  });

  /**
   * Handles assign request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/assign
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  assignRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as AssignMaintenanceRequestInput;

    const data = await maintenanceService.assignRequest(organizationId, hotelId, requestId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request assigned'), res);
  });

  /**
   * Handles schedule request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/schedule
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  scheduleRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as ScheduleMaintenanceRequestInput;

    const data = await maintenanceService.scheduleRequest(
      organizationId,
      hotelId,
      requestId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request scheduled'), res);
  });

  /**
   * Handles start request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/start
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  startRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };

    const data = await maintenanceService.startRequest(
      organizationId,
      hotelId,
      requestId,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request started'), res);
  });

  /**
   * Handles pause request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/pause
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  pauseRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as { reason: string };

    const data = await maintenanceService.pauseRequest(organizationId, hotelId, requestId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request paused'), res);
  });

  /**
   * Handles log parts requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/log-parts
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  logParts = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as LogPartsInput;

    const data = await maintenanceService.logParts(
      organizationId,
      hotelId,
      requestId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Parts logged successfully'), res);
  });

  /**
   * Handles complete request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/complete
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  completeRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as CompleteMaintenanceRequestInput;

    const data = await maintenanceService.completeRequest(
      organizationId,
      hotelId,
      requestId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request completed'), res);
  });

  /**
   * Handles verify request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/verify
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  verifyRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as VerifyMaintenanceRequestInput;

    const data = await maintenanceService.verifyRequest(
      organizationId,
      hotelId,
      requestId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request verified'), res);
  });

  /**
   * Handles cancel request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/cancel
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  cancelRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as CancelMaintenanceRequestInput;

    const data = await maintenanceService.cancelRequest(
      organizationId,
      hotelId,
      requestId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request cancelled'), res);
  });

  /**
   * Handles escalate request requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/escalate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  escalateRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as EscalateMaintenanceRequestInput;

    const data = await maintenanceService.escalateRequest(
      organizationId,
      hotelId,
      requestId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request escalated'), res);
  });

  /**
   * Handles post guest charge requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/requests/:requestId/guest-charge
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  postGuestCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };
    const input = req.body as PostGuestChargeInput;

    const data = await maintenanceService.postGuestCharge(
      organizationId,
      hotelId,
      requestId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Guest charge posted successfully'), res);
  });

  /**
   * Handles get dashboard requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as MaintenanceDashboardQueryInput;

    const data = await maintenanceService.getDashboard(organizationId, hotelId, query.date);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance dashboard retrieved'), res);
  });

  /**
   * Handles create preventive schedule requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/preventive/schedules
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createPreventiveSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreatePreventiveScheduleInput;

    const data = await maintenanceService.createPreventiveSchedule(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Preventive schedule created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list preventive schedules requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/preventive/schedules
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listPreventiveSchedules = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListPreventiveSchedulesQueryInput;

    const data = await maintenanceService.listPreventiveSchedules(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Preventive schedules retrieved'), res);
  });

  /**
   * Handles pause preventive schedule requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/preventive/schedules/:scheduleId/pause
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  pausePreventiveSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, scheduleId } = req.params as {
      organizationId: string;
      hotelId: string;
      scheduleId: string;
    };

    const data = await maintenanceService.pausePreventiveSchedule(
      organizationId,
      hotelId,
      scheduleId
    );

    handleServiceResponse(ServiceResponse.success(data, 'Preventive schedule paused'), res);
  });

  /**
   * Handles generate due preventive requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/preventive/schedules/generate-due
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  generateDuePreventive = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as GenerateDuePreventiveInput;

    const data = await maintenanceService.generateDuePreventiveTasks(
      organizationId,
      hotelId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Due preventive tasks generated'), res);
  });

  /**
   * Handles create asset requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/assets
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createAsset = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateAssetInput;

    const data = await maintenanceService.createAsset(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Asset created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list assets requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/assets
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listAssets = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListAssetsQueryInput;

    const data = await maintenanceService.listAssets(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Assets retrieved'), res);
  });

  /**
   * Handles get asset detail requests for maintenance operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/assets/:assetId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getAssetDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, assetId } = req.params as {
      organizationId: string;
      hotelId: string;
      assetId: string;
    };

    const data = await maintenanceService.getAssetDetail(organizationId, hotelId, assetId);

    handleServiceResponse(ServiceResponse.success(data, 'Asset retrieved'), res);
  });

  /**
   * Handles update asset requests for maintenance operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/assets/:assetId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateAsset = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, assetId } = req.params as {
      organizationId: string;
      hotelId: string;
      assetId: string;
    };
    const input = req.body as UpdateAssetInput;

    const data = await maintenanceService.updateAsset(organizationId, hotelId, assetId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Asset updated'), res);
  });

  /**
   * Handles evaluate asset requests for maintenance operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/maintenance/assets/:assetId/evaluate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  evaluateAsset = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, assetId } = req.params as {
      organizationId: string;
      hotelId: string;
      assetId: string;
    };

    const data = await maintenanceService.evaluateAsset(organizationId, hotelId, assetId);

    handleServiceResponse(ServiceResponse.success(data, 'Asset evaluation completed'), res);
  });
}

export const maintenanceController = new MaintenanceController();
