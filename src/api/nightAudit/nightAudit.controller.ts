import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  NightAuditDateQueryInput,
  NightAuditHistoryQueryInput,
  NightAuditReportQueryInput,
  RollbackNightAuditInput,
  RunNightAuditInput,
} from './nightAudit.schema';
import { nightAuditService } from './nightAudit.service';

export class NightAuditController {
  preCheck = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditDateQueryInput;

    const result = await nightAuditService.preCheck(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ preCheck: result }, 'Pre-check completed'),
      res
    );
  });

  runAudit = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as RunNightAuditInput;

    const result = await nightAuditService.runAudit(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success({ result }, 'Night audit completed', StatusCodes.OK),
      res
    );
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const result = await nightAuditService.getStatus(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ status: result }, 'Night audit status retrieved'),
      res
    );
  });

  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditHistoryQueryInput;

    const result = await nightAuditService.getHistory(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ history: result }, 'Night audit history retrieved'),
      res
    );
  });

  getReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as NightAuditReportQueryInput;

    const result = await nightAuditService.getReport(organizationId, hotelId, query);

    handleServiceResponse(
      ServiceResponse.success({ report: result }, 'Night audit report retrieved'),
      res
    );
  });

  rollback = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as RollbackNightAuditInput;

    const result = await nightAuditService.rollbackAudit(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ result }, 'Night audit rollback completed', StatusCodes.OK),
      res
    );
  });
}

export const nightAuditController = new NightAuditController();
