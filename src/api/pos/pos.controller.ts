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

/**
 * Controller transport handlers for point-of-sale operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/pos.
 */
export class PosController {
  /**
   * Handles create outlet requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/outlets
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createOutlet = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateOutletInput;

    const data = await posService.createOutlet(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS outlet created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list outlets requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/outlets
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listOutlets = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListOutletsQueryInput;

    const data = await posService.listOutlets(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS outlets retrieved'), res);
  });

  /**
   * Handles update outlet requests for point-of-sale operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/pos/outlets/:outletId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles create menu item requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/menu
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateMenuItemInput;

    const data = await posService.createMenuItem(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS menu item created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list menu items requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/menu
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListMenuItemsQueryInput;

    const data = await posService.listMenuItems(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS menu items retrieved'), res);
  });

  /**
   * Handles update menu item requests for point-of-sale operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/pos/menu/:menuItemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles create order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateOrderInput;

    const data = await posService.createOrder(organizationId, hotelId, input, req.user?.sub);

    handleServiceResponse(
      ServiceResponse.success(data, 'POS order created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles get order requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, orderId } = req.params as {
      organizationId: string;
      hotelId: string;
      orderId: string;
    };

    const data = await posService.getOrder(organizationId, hotelId, orderId);

    handleServiceResponse(ServiceResponse.success(data, 'POS order retrieved'), res);
  });

  /**
   * Handles list orders requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listOrders = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListOrdersQueryInput;

    const data = await posService.listOrders(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS orders retrieved'), res);
  });

  /**
   * Handles add order items requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/items
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles update order item requests for point-of-sale operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/items/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles remove order item requests for point-of-sale operations.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/items/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles close order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/close
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles post to room requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/post-to-room
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles void order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/void
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles reopen order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/reopen
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles split order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/split
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles transfer order requests for point-of-sale operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/pos/orders/:orderId/transfer
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
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

  /**
   * Handles get dashboard requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as PosDashboardQueryInput;

    const data = await posService.getDashboard(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS dashboard retrieved'), res);
  });

  /**
   * Handles get sales report requests for point-of-sale operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/pos/reports/sales
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getSalesReport = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as PosSalesReportQueryInput;

    const data = await posService.getSalesReport(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'POS sales report retrieved'), res);
  });
}

export const posController = new PosController();
