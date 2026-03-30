import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requireAnyPermission, requirePermission } from '../../core/middleware/requirePermission';
import { inventoryController } from './inventory.controller';
import {
  AddPurchaseOrderItemSchema,
  AdjustInventoryStockSchema,
  ApprovePurchaseOrderSchema,
  ApproveVendorSchema,
  CancelPurchaseOrderSchema,
  ConsumeInventoryStockSchema,
  CreateInventoryItemSchema,
  CreatePurchaseOrderSchema,
  CreateVendorSchema,
  HotelIdParamSchema,
  InventoryDashboardQuerySchema,
  ItemIdParamSchema,
  ListInventoryItemsQuerySchema,
  ListInventoryTransactionsQuerySchema,
  ListPurchaseOrdersQuerySchema,
  ListVendorsQuerySchema,
  OrganizationIdParamSchema,
  PoItemIdParamSchema,
  PurchaseOrderIdParamSchema,
  ReceivePurchaseOrderSchema,
  SubmitPurchaseOrderSchema,
  UpdateInventoryItemSchema,
  UpdatePurchaseOrderItemSchema,
  UpdatePurchaseOrderSchema,
  UpdateVendorSchema,
  VendorIdParamSchema,
} from './inventory.dto';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const ItemParams = OrgHotelParams.merge(ItemIdParamSchema);
const VendorParams = OrgHotelParams.merge(VendorIdParamSchema);
const PurchaseOrderParams = OrgHotelParams.merge(PurchaseOrderIdParamSchema);
const PurchaseOrderItemParams = PurchaseOrderParams.merge(PoItemIdParamSchema);

// Inventory Items
router.post(
  '/items',
  requirePermission('INVENTORY.CREATE'),
  validate({ params: OrgHotelParams, body: CreateInventoryItemSchema }),
  inventoryController.createInventoryItem
);

router.get(
  '/items',
  requirePermission('INVENTORY.READ'),
  validate({ params: OrgHotelParams, query: ListInventoryItemsQuerySchema }),
  inventoryController.listInventoryItems
);

router.get(
  '/items/:itemId',
  requirePermission('INVENTORY.READ'),
  validate({ params: ItemParams }),
  inventoryController.getInventoryItem
);

router.patch(
  '/items/:itemId',
  requirePermission('INVENTORY.UPDATE'),
  validate({ params: ItemParams, body: UpdateInventoryItemSchema }),
  inventoryController.updateInventoryItem
);

router.delete(
  '/items/:itemId',
  requirePermission('INVENTORY.DELETE'),
  validate({ params: ItemParams }),
  inventoryController.deleteInventoryItem
);

router.post(
  '/items/:itemId/adjust',
  requirePermission('INVENTORY.ADJUST'),
  validate({ params: ItemParams, body: AdjustInventoryStockSchema }),
  inventoryController.adjustInventoryStock
);

router.post(
  '/items/:itemId/consume',
  requirePermission('INVENTORY.CONSUME'),
  validate({ params: ItemParams, body: ConsumeInventoryStockSchema }),
  inventoryController.consumeInventoryStock
);

router.get(
  '/transactions',
  requirePermission('INVENTORY.READ'),
  validate({ params: OrgHotelParams, query: ListInventoryTransactionsQuerySchema }),
  inventoryController.listInventoryTransactions
);

// Vendors
router.post(
  '/vendors',
  requirePermission('PROCUREMENT.CREATE'),
  validate({ params: OrgHotelParams, body: CreateVendorSchema }),
  inventoryController.createVendor
);

router.get(
  '/vendors',
  requirePermission('PROCUREMENT.READ'),
  validate({ params: OrgHotelParams, query: ListVendorsQuerySchema }),
  inventoryController.listVendors
);

router.get(
  '/vendors/:vendorId',
  requirePermission('PROCUREMENT.READ'),
  validate({ params: VendorParams }),
  inventoryController.getVendor
);

router.patch(
  '/vendors/:vendorId',
  requirePermission('PROCUREMENT.UPDATE'),
  validate({ params: VendorParams, body: UpdateVendorSchema }),
  inventoryController.updateVendor
);

router.post(
  '/vendors/:vendorId/approve',
  requirePermission('PROCUREMENT.APPROVE'),
  validate({ params: VendorParams, body: ApproveVendorSchema }),
  inventoryController.approveVendor
);

// Purchase Orders
router.post(
  '/purchase-orders',
  requirePermission('PROCUREMENT.CREATE'),
  validate({ params: OrgHotelParams, body: CreatePurchaseOrderSchema }),
  inventoryController.createPurchaseOrder
);

router.get(
  '/purchase-orders',
  requirePermission('PROCUREMENT.READ'),
  validate({ params: OrgHotelParams, query: ListPurchaseOrdersQuerySchema }),
  inventoryController.listPurchaseOrders
);

router.get(
  '/purchase-orders/:purchaseOrderId',
  requirePermission('PROCUREMENT.READ'),
  validate({ params: PurchaseOrderParams }),
  inventoryController.getPurchaseOrder
);

router.patch(
  '/purchase-orders/:purchaseOrderId',
  requirePermission('PROCUREMENT.UPDATE'),
  validate({ params: PurchaseOrderParams, body: UpdatePurchaseOrderSchema }),
  inventoryController.updatePurchaseOrder
);

router.post(
  '/purchase-orders/:purchaseOrderId/items',
  requirePermission('PROCUREMENT.UPDATE'),
  validate({ params: PurchaseOrderParams, body: AddPurchaseOrderItemSchema }),
  inventoryController.addPurchaseOrderItem
);

router.patch(
  '/purchase-orders/:purchaseOrderId/items/:poItemId',
  requirePermission('PROCUREMENT.UPDATE'),
  validate({ params: PurchaseOrderItemParams, body: UpdatePurchaseOrderItemSchema }),
  inventoryController.updatePurchaseOrderItem
);

router.delete(
  '/purchase-orders/:purchaseOrderId/items/:poItemId',
  requirePermission('PROCUREMENT.UPDATE'),
  validate({ params: PurchaseOrderItemParams }),
  inventoryController.removePurchaseOrderItem
);

router.post(
  '/purchase-orders/:purchaseOrderId/submit',
  requirePermission('PROCUREMENT.SUBMIT'),
  validate({ params: PurchaseOrderParams, body: SubmitPurchaseOrderSchema }),
  inventoryController.submitPurchaseOrder
);

router.post(
  '/purchase-orders/:purchaseOrderId/approve',
  requirePermission('PROCUREMENT.APPROVE'),
  validate({ params: PurchaseOrderParams, body: ApprovePurchaseOrderSchema }),
  inventoryController.approvePurchaseOrder
);

router.post(
  '/purchase-orders/:purchaseOrderId/receive',
  requirePermission('PROCUREMENT.RECEIVE'),
  validate({ params: PurchaseOrderParams, body: ReceivePurchaseOrderSchema }),
  inventoryController.receivePurchaseOrder
);

router.post(
  '/purchase-orders/:purchaseOrderId/cancel',
  requirePermission('PROCUREMENT.CANCEL'),
  validate({ params: PurchaseOrderParams, body: CancelPurchaseOrderSchema }),
  inventoryController.cancelPurchaseOrder
);

router.get(
  '/dashboard',
  requireAnyPermission('INVENTORY.DASHBOARD', 'PROCUREMENT.DASHBOARD'),
  validate({ params: OrgHotelParams, query: InventoryDashboardQuerySchema }),
  inventoryController.getDashboard
);

export default router;
