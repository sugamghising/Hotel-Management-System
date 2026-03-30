import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  AddOrderItemsInput,
  CloseOrderInput,
  CreateMenuItemInput,
  CreateOrderInput,
  CreateOutletInput,
  ListMenuItemsQueryInput,
  ListOrdersQueryInput,
  ListOutletsQueryInput,
  PosDashboardQueryInput,
  PosSalesReportQueryInput,
  PostToRoomInput,
  ReopenOrderInput,
  SplitOrderInput,
  TransferOrderInput,
  UpdateMenuItemInput,
  UpdateOrderItemInput,
  UpdateOutletInput,
  VoidOrderInput,
  VoidOrderItemInput,
} from './pos.schema';
import { posService } from './pos.service';

export class PosController {
  createOutlet = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateOutletInput;

    const data = await posService.createOutlet(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS outlet created', StatusCodes.CREATED),
      res
    );
  });

  listOutlets = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListOutletsQueryInput;

    const data = await posService.listOutlets(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS outlets retrieved'), res);
  });

  updateOutlet = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, outletId } = req.params as {
      organizationId: string;
      hotelId: string;
      outletId: string;
    };
    const input = req.body as UpdateOutletInput;

    const data = await posService.updateOutlet(organizationId, hotelId, outletId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS outlet updated'), res);
  });

  createMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateMenuItemInput;

    const data = await posService.createMenuItem(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS menu item created', StatusCodes.CREATED),
      res
    );
  });

  listMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListMenuItemsQueryInput;

    const data = await posService.listMenuItems(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS menu items retrieved'), res);
  });

  updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, menuItemId } = req.params as {
      organizationId: string;
      hotelId: string;
      menuItemId: string;
    };
    const input = req.body as UpdateMenuItemInput;

    const data = await posService.updateMenuItem(organizationId, hotelId, menuItemId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS menu item updated'), res);
  });

  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateOrderInput;

    const data = await posService.createOrder(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS order created', StatusCodes.CREATED),
      res
    );
  });

  getOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };

    const data = await posService.getOrder(organizationId, hotelId, orderId);

    handleServiceResponse(ServiceResponse.success(data, 'POS order retrieved'), res);
  });

  listOrders = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListOrdersQueryInput;

    const data = await posService.listOrders(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS orders retrieved'), res);
  });

  addOrderItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as AddOrderItemsInput;

    const data = await posService.addOrderItems(organizationId, hotelId, orderId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS order items added'), res);
  });

  updateOrderItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
      itemId: string;
    };
    const input = req.body as UpdateOrderItemInput;

    const data = await posService.updateOrderItem(organizationId, hotelId, orderId, itemId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS order item updated'), res);
  });

  removeOrderItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
      itemId: string;
    };
    const input = req.body as VoidOrderItemInput;

    const data = await posService.removeOrderItem(organizationId, hotelId, orderId, itemId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS order item removed'), res);
  });

  closeOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as CloseOrderInput;

    const data = await posService.closeOrder(
      organizationId,
      hotelId,
      orderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'POS order closed'), res);
  });

  postToRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as PostToRoomInput;

    const data = await posService.postToRoom(
      organizationId,
      hotelId,
      orderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'POS order posted to room'), res);
  });

  voidOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as VoidOrderInput;

    const data = await posService.voidOrder(organizationId, hotelId, orderId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success(data, 'POS order voided'), res);
  });

  reopenOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as ReopenOrderInput;

    const data = await posService.reopenOrder(organizationId, hotelId, orderId, input);

    handleServiceResponse(ServiceResponse.success(data, 'POS order reopened'), res);
  });

  splitOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as SplitOrderInput;

    const data = await posService.splitOrder(
      organizationId,
      hotelId,
      orderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'POS order split completed'), res);
  });

  transferOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };
    const input = req.body as TransferOrderInput;

    const data = await posService.transferOrder(
      organizationId,
      hotelId,
      orderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'POS order transfer completed'), res);
  });

  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as PosDashboardQueryInput;

    const data = await posService.getDashboard(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS dashboard retrieved'), res);
  });

  getSalesReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as PosSalesReportQueryInput;

    const data = await posService.getSalesReport(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS sales report retrieved'), res);
  });
}

export const posController = new PosController();
