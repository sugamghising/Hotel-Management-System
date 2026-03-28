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

export class MaintenanceController {
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

  listRequests = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListMaintenanceRequestsQueryInput;

    const data = await maintenanceService.listRequests(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance requests retrieved'), res);
  });

  getRequestDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };

    const data = await maintenanceService.getRequestDetail(organizationId, hotelId, requestId);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request retrieved'), res);
  });

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

  acknowledgeRequest = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, requestId } = req.params as {
      organizationId: string;
      hotelId: string;
      requestId: string;
    };

    const data = await maintenanceService.acknowledgeRequest(organizationId, hotelId, requestId);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance request acknowledged'), res);
  });

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

  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as MaintenanceDashboardQueryInput;

    const data = await maintenanceService.getDashboard(organizationId, hotelId, query.date);

    handleServiceResponse(ServiceResponse.success(data, 'Maintenance dashboard retrieved'), res);
  });

  createPreventiveSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreatePreventiveScheduleInput;

    const data = await maintenanceService.createPreventiveSchedule(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Preventive schedule created', StatusCodes.CREATED),
      res
    );
  });

  listPreventiveSchedules = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListPreventiveSchedulesQueryInput;

    const data = await maintenanceService.listPreventiveSchedules(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Preventive schedules retrieved'), res);
  });

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

  createAsset = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateAssetInput;

    const data = await maintenanceService.createAsset(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Asset created successfully', StatusCodes.CREATED),
      res
    );
  });

  listAssets = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListAssetsQueryInput;

    const data = await maintenanceService.listAssets(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Assets retrieved'), res);
  });

  getAssetDetail = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, assetId } = req.params as {
      organizationId: string;
      hotelId: string;
      assetId: string;
    };

    const data = await maintenanceService.getAssetDetail(organizationId, hotelId, assetId);

    handleServiceResponse(ServiceResponse.success(data, 'Asset retrieved'), res);
  });

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
