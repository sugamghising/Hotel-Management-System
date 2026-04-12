import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  AddPurchaseOrderItemInput,
  AdjustInventoryStockInput,
  ApprovePurchaseOrderInput,
  ApproveVendorInput,
  CancelPurchaseOrderInput,
  ConsumeInventoryStockInput,
  CreateInventoryItemInput,
  CreatePurchaseOrderInput,
  CreateVendorInput,
  InventoryDashboardQueryInput,
  ListInventoryItemsQueryInput,
  ListInventoryTransactionsQueryInput,
  ListPurchaseOrdersQueryInput,
  ListVendorsQueryInput,
  ReceivePurchaseOrderInput,
  SubmitPurchaseOrderInput,
  UpdateInventoryItemInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput,
  UpdateVendorInput,
} from './inventory.schema';
import { inventoryService } from './inventory.service';

/**
 * Controller transport handlers for inventory and procurement operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/inventory.
 */
export class InventoryController {
  /**
   * Handles create inventory item requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateInventoryItemInput;

    const data = await inventoryService.createInventoryItem(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(data, 'Inventory item created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list inventory items requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listInventoryItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListInventoryItemsQueryInput;

    const data = await inventoryService.listInventoryItems(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory items retrieved'), res);
  });

  /**
   * Handles get inventory item requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };

    const data = await inventoryService.getInventoryItem(organizationId, hotelId, itemId);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory item retrieved'), res);
  });

  /**
   * Handles update inventory item requests for inventory and procurement operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };
    const input = req.body as UpdateInventoryItemInput;

    const data = await inventoryService.updateInventoryItem(organizationId, hotelId, itemId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory item updated'), res);
  });

  /**
   * Handles delete inventory item requests for inventory and procurement operations.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items/:itemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };

    const data = await inventoryService.deleteInventoryItem(organizationId, hotelId, itemId);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory item deleted'), res);
  });

  /**
   * Handles adjust inventory stock requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items/:itemId/adjust
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  adjustInventoryStock = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };
    const input = req.body as AdjustInventoryStockInput;

    const data = await inventoryService.adjustInventoryStock(
      organizationId,
      hotelId,
      itemId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Inventory stock adjusted'), res);
  });

  /**
   * Handles consume inventory stock requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/items/:itemId/consume
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  consumeInventoryStock = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };
    const input = req.body as ConsumeInventoryStockInput;

    const data = await inventoryService.consumeInventoryStock(
      organizationId,
      hotelId,
      itemId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Inventory stock consumed'), res);
  });

  /**
   * Handles list inventory transactions requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/transactions
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listInventoryTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListInventoryTransactionsQueryInput;

    const data = await inventoryService.listInventoryTransactions(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory transactions retrieved'), res);
  });

  /**
   * Handles create vendor requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/vendors
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateVendorInput;

    const data = await inventoryService.createVendor(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Vendor created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list vendors requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/vendors
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listVendors = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListVendorsQueryInput;

    const data = await inventoryService.listVendors(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Vendors retrieved'), res);
  });

  /**
   * Handles get vendor requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/vendors/:vendorId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, vendorId } = req.params as {
      organizationId: string;
      hotelId: string;
      vendorId: string;
    };

    const data = await inventoryService.getVendor(organizationId, hotelId, vendorId);

    handleServiceResponse(ServiceResponse.success(data, 'Vendor retrieved'), res);
  });

  /**
   * Handles update vendor requests for inventory and procurement operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/vendors/:vendorId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updateVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, vendorId } = req.params as {
      organizationId: string;
      hotelId: string;
      vendorId: string;
    };
    const input = req.body as UpdateVendorInput;

    const data = await inventoryService.updateVendor(organizationId, hotelId, vendorId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Vendor updated'), res);
  });

  /**
   * Handles approve vendor requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/vendors/:vendorId/approve
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  approveVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, vendorId } = req.params as {
      organizationId: string;
      hotelId: string;
      vendorId: string;
    };
    const input = req.body as ApproveVendorInput;

    const data = await inventoryService.approveVendor(organizationId, hotelId, vendorId, input);

    handleServiceResponse(ServiceResponse.success(data, 'Vendor approval updated'), res);
  });

  /**
   * Handles create purchase order requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreatePurchaseOrderInput;

    const data = await inventoryService.createPurchaseOrder(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(data, 'Purchase order created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list purchase orders requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListPurchaseOrdersQueryInput;

    const data = await inventoryService.listPurchaseOrders(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Purchase orders retrieved'), res);
  });

  /**
   * Handles get purchase order requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };

    const data = await inventoryService.getPurchaseOrder(organizationId, hotelId, purchaseOrderId);

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order retrieved'), res);
  });

  /**
   * Handles update purchase order requests for inventory and procurement operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updatePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as UpdatePurchaseOrderInput;

    const data = await inventoryService.updatePurchaseOrder(
      organizationId,
      hotelId,
      purchaseOrderId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order updated'), res);
  });

  /**
   * Handles add purchase order item requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/items
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  addPurchaseOrderItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as AddPurchaseOrderItemInput;

    const data = await inventoryService.addPurchaseOrderItem(
      organizationId,
      hotelId,
      purchaseOrderId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order item added'), res);
  });

  /**
   * Handles update purchase order item requests for inventory and procurement operations.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/items/:poItemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  updatePurchaseOrderItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId, poItemId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
      poItemId: string;
    };
    const input = req.body as UpdatePurchaseOrderItemInput;

    const data = await inventoryService.updatePurchaseOrderItem(
      organizationId,
      hotelId,
      purchaseOrderId,
      poItemId,
      input
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order item updated'), res);
  });

  /**
   * Handles remove purchase order item requests for inventory and procurement operations.
   *
   * Route: DELETE /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/items/:poItemId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  removePurchaseOrderItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId, poItemId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
      poItemId: string;
    };

    const data = await inventoryService.removePurchaseOrderItem(
      organizationId,
      hotelId,
      purchaseOrderId,
      poItemId
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order item removed'), res);
  });

  /**
   * Handles submit purchase order requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/submit
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  submitPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as SubmitPurchaseOrderInput;

    const data = await inventoryService.submitPurchaseOrder(
      organizationId,
      hotelId,
      purchaseOrderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order submitted'), res);
  });

  /**
   * Handles approve purchase order requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/approve
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  approvePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as ApprovePurchaseOrderInput;

    const data = await inventoryService.approvePurchaseOrder(
      organizationId,
      hotelId,
      purchaseOrderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order approved'), res);
  });

  /**
   * Handles receive purchase order requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/receive
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as ReceivePurchaseOrderInput;

    const data = await inventoryService.receivePurchaseOrder(
      organizationId,
      hotelId,
      purchaseOrderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order received'), res);
  });

  /**
   * Handles cancel purchase order requests for inventory and procurement operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/purchase-orders/:purchaseOrderId/cancel
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };
    const input = req.body as CancelPurchaseOrderInput;

    const data = await inventoryService.cancelPurchaseOrder(
      organizationId,
      hotelId,
      purchaseOrderId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order cancelled'), res);
  });

  /**
   * Handles get dashboard requests for inventory and procurement operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/inventory/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as InventoryDashboardQueryInput;

    const data = await inventoryService.getDashboard(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory dashboard retrieved'), res);
  });
}

export const inventoryController = new InventoryController();
