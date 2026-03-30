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

export class InventoryController {
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

  listInventoryItems = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListInventoryItemsQueryInput;

    const data = await inventoryService.listInventoryItems(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory items retrieved'), res);
  });

  getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };

    const data = await inventoryService.getInventoryItem(organizationId, hotelId, itemId);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory item retrieved'), res);
  });

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

  deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, itemId } = req.params as {
      organizationId: string;
      hotelId: string;
      itemId: string;
    };

    const data = await inventoryService.deleteInventoryItem(organizationId, hotelId, itemId);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory item deleted'), res);
  });

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

  listInventoryTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListInventoryTransactionsQueryInput;

    const data = await inventoryService.listInventoryTransactions(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory transactions retrieved'), res);
  });

  createVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateVendorInput;

    const data = await inventoryService.createVendor(organizationId, hotelId, input);

    handleServiceResponse(
      ServiceResponse.success(data, 'Vendor created', StatusCodes.CREATED),
      res
    );
  });

  listVendors = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListVendorsQueryInput;

    const data = await inventoryService.listVendors(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Vendors retrieved'), res);
  });

  getVendor = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, vendorId } = req.params as {
      organizationId: string;
      hotelId: string;
      vendorId: string;
    };

    const data = await inventoryService.getVendor(organizationId, hotelId, vendorId);

    handleServiceResponse(ServiceResponse.success(data, 'Vendor retrieved'), res);
  });

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

  listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ListPurchaseOrdersQueryInput;

    const data = await inventoryService.listPurchaseOrders(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Purchase orders retrieved'), res);
  });

  getPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, purchaseOrderId } = req.params as {
      organizationId: string;
      hotelId: string;
      purchaseOrderId: string;
    };

    const data = await inventoryService.getPurchaseOrder(organizationId, hotelId, purchaseOrderId);

    handleServiceResponse(ServiceResponse.success(data, 'Purchase order retrieved'), res);
  });

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

  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as InventoryDashboardQueryInput;

    const data = await inventoryService.getDashboard(organizationId, hotelId, query);

    handleServiceResponse(ServiceResponse.success(data, 'Inventory dashboard retrieved'), res);
  });
}

export const inventoryController = new InventoryController();
