import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
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
} from './inventory.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const ItemParams = OrgHotelParams.merge(ItemIdParamSchema);
const VendorParams = OrgHotelParams.merge(VendorIdParamSchema);
const PurchaseOrderParams = OrgHotelParams.merge(PurchaseOrderIdParamSchema);
const PurchaseOrderItemParams = PurchaseOrderParams.merge(PoItemIdParamSchema);

const PaginationMetaSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  unitOfMeasure: z.string(),
  parLevel: z.number().int(),
  reorderPoint: z.number().int(),
  reorderQty: z.number().int(),
  currentStock: z.number().int(),
  reservedStock: z.number().int(),
  availableStock: z.number().int(),
  avgUnitCost: z.number(),
  lastUnitCost: z.number(),
  trackExpiry: z.boolean(),
  trackBatches: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

const VendorSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.record(z.unknown()).nullable(),
  paymentTerms: z.string().nullable(),
  currencyCode: z.string(),
  taxId: z.string().nullable(),
  isApproved: z.boolean(),
  isActive: z.boolean(),
  rating: z.number().int().nullable(),
  lastOrderDate: z.string().nullable(),
  totalOrders: z.number().int(),
  totalSpend: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PurchaseOrderLineSchema = z.object({
  id: z.string().uuid(),
  poId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  receivedQty: z.number().int(),
  item: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    unitOfMeasure: z.string(),
  }),
});

const PurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  vendorId: z.string().uuid(),
  poNumber: z.string(),
  status: z.string(),
  orderDate: z.string(),
  expectedDelivery: z.string().nullable(),
  receivedDate: z.string().nullable(),
  subtotal: z.number(),
  taxAmount: z.number(),
  shippingCost: z.number(),
  total: z.number(),
  requestedBy: z.string().uuid(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  vendor: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    isApproved: z.boolean(),
    isActive: z.boolean(),
  }),
  items: z.array(PurchaseOrderLineSchema),
});

const DashboardSchema = z.object({
  asOfDate: z.string(),
  totals: z.object({
    items: z.number().int(),
    lowStockItems: z.number().int(),
    activeVendors: z.number().int(),
    draftPurchaseOrders: z.number().int(),
    pendingApprovalPurchaseOrders: z.number().int(),
    openPurchaseOrders: z.number().int(),
    receivedPurchaseOrdersToday: z.number().int(),
  }),
  stock: z.object({
    totalUnitsOnHand: z.number().int(),
    totalUnitsAvailable: z.number().int(),
    totalValuation: z.number(),
  }),
  purchaseOrders: z.object({
    pendingValue: z.number(),
    receivedValueToday: z.number(),
  }),
  topLowStockItems: z.array(
    z.object({
      itemId: z.string().uuid(),
      sku: z.string(),
      name: z.string(),
      availableStock: z.number().int(),
      reorderPoint: z.number().int(),
      reorderQty: z.number().int(),
    })
  ),
});

const TransactionSchema = z.record(z.unknown());

export const inventoryRegistry = new OpenAPIRegistry();

inventoryRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items',
  tags: ['Inventory'],
  summary: 'Create inventory item',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateInventoryItemSchema } } },
  },
  responses: createApiResponse(InventoryItemSchema, 'Inventory item created', 201),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items',
  tags: ['Inventory'],
  summary: 'List inventory items',
  request: {
    params: OrgHotelParams,
    query: ListInventoryItemsQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(InventoryItemSchema), meta: PaginationMetaSchema }),
    'Inventory items retrieved'
  ),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items/{itemId}',
  tags: ['Inventory'],
  summary: 'Get inventory item',
  request: { params: ItemParams },
  responses: createApiResponse(InventoryItemSchema, 'Inventory item retrieved'),
});

inventoryRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items/{itemId}',
  tags: ['Inventory'],
  summary: 'Update inventory item',
  request: {
    params: ItemParams,
    body: { content: { 'application/json': { schema: UpdateInventoryItemSchema } } },
  },
  responses: createApiResponse(InventoryItemSchema, 'Inventory item updated'),
});

inventoryRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items/{itemId}',
  tags: ['Inventory'],
  summary: 'Delete inventory item',
  request: { params: ItemParams },
  responses: createApiResponse(InventoryItemSchema, 'Inventory item deleted'),
});

const itemActionPaths: Array<{
  path: string;
  summary: string;
  bodySchema: z.ZodTypeAny;
}> = [
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items/{itemId}/adjust',
    summary: 'Adjust inventory stock',
    bodySchema: AdjustInventoryStockSchema,
  },
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/items/{itemId}/consume',
    summary: 'Consume inventory stock',
    bodySchema: ConsumeInventoryStockSchema,
  },
];

for (const action of itemActionPaths) {
  inventoryRegistry.registerPath({
    method: 'post',
    path: action.path,
    tags: ['Inventory'],
    summary: action.summary,
    request: {
      params: ItemParams,
      body: { content: { 'application/json': { schema: action.bodySchema } } },
    },
    responses: createApiResponse(InventoryItemSchema, `${action.summary} successful`),
  });
}

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/transactions',
  tags: ['Inventory'],
  summary: 'List inventory transactions',
  request: {
    params: OrgHotelParams,
    query: ListInventoryTransactionsQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(TransactionSchema), meta: PaginationMetaSchema }),
    'Inventory transactions retrieved'
  ),
});

inventoryRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/vendors',
  tags: ['Procurement'],
  summary: 'Create vendor',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreateVendorSchema } } },
  },
  responses: createApiResponse(VendorSchema, 'Vendor created', 201),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/vendors',
  tags: ['Procurement'],
  summary: 'List vendors',
  request: {
    params: OrgHotelParams,
    query: ListVendorsQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(VendorSchema), meta: PaginationMetaSchema }),
    'Vendors retrieved'
  ),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/vendors/{vendorId}',
  tags: ['Procurement'],
  summary: 'Get vendor',
  request: { params: VendorParams },
  responses: createApiResponse(VendorSchema, 'Vendor retrieved'),
});

inventoryRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/vendors/{vendorId}',
  tags: ['Procurement'],
  summary: 'Update vendor',
  request: {
    params: VendorParams,
    body: { content: { 'application/json': { schema: UpdateVendorSchema } } },
  },
  responses: createApiResponse(VendorSchema, 'Vendor updated'),
});

inventoryRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/vendors/{vendorId}/approve',
  tags: ['Procurement'],
  summary: 'Approve vendor',
  request: {
    params: VendorParams,
    body: { content: { 'application/json': { schema: ApproveVendorSchema } } },
  },
  responses: createApiResponse(VendorSchema, 'Vendor approval updated'),
});

inventoryRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders',
  tags: ['Procurement'],
  summary: 'Create purchase order',
  request: {
    params: OrgHotelParams,
    body: { content: { 'application/json': { schema: CreatePurchaseOrderSchema } } },
  },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order created', 201),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders',
  tags: ['Procurement'],
  summary: 'List purchase orders',
  request: {
    params: OrgHotelParams,
    query: ListPurchaseOrdersQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(PurchaseOrderSchema), meta: PaginationMetaSchema }),
    'Purchase orders retrieved'
  ),
});

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}',
  tags: ['Procurement'],
  summary: 'Get purchase order',
  request: { params: PurchaseOrderParams },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order retrieved'),
});

inventoryRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}',
  tags: ['Procurement'],
  summary: 'Update purchase order',
  request: {
    params: PurchaseOrderParams,
    body: { content: { 'application/json': { schema: UpdatePurchaseOrderSchema } } },
  },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order updated'),
});

inventoryRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/items',
  tags: ['Procurement'],
  summary: 'Add purchase order item',
  request: {
    params: PurchaseOrderParams,
    body: { content: { 'application/json': { schema: AddPurchaseOrderItemSchema } } },
  },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order item added'),
});

inventoryRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/items/{poItemId}',
  tags: ['Procurement'],
  summary: 'Update purchase order item',
  request: {
    params: PurchaseOrderItemParams,
    body: { content: { 'application/json': { schema: UpdatePurchaseOrderItemSchema } } },
  },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order item updated'),
});

inventoryRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/items/{poItemId}',
  tags: ['Procurement'],
  summary: 'Remove purchase order item',
  request: { params: PurchaseOrderItemParams },
  responses: createApiResponse(PurchaseOrderSchema, 'Purchase order item removed'),
});

const purchaseOrderActions: Array<{
  path: string;
  summary: string;
  bodySchema: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny;
}> = [
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/submit',
    summary: 'Submit purchase order',
    bodySchema: SubmitPurchaseOrderSchema,
    responseSchema: PurchaseOrderSchema,
  },
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/approve',
    summary: 'Approve purchase order',
    bodySchema: ApprovePurchaseOrderSchema,
    responseSchema: PurchaseOrderSchema,
  },
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/receive',
    summary: 'Receive purchase order',
    bodySchema: ReceivePurchaseOrderSchema,
    responseSchema: z.object({
      purchaseOrderId: z.string().uuid(),
      status: z.string(),
      receivedDate: z.string(),
      receiptTotalCost: z.number(),
      updatedLines: z.array(
        z.object({
          poItemId: z.string().uuid(),
          itemId: z.string().uuid(),
          receivedQty: z.number().int(),
          cumulativeReceivedQty: z.number().int(),
          unitCost: z.number(),
          totalCost: z.number(),
        })
      ),
    }),
  },
  {
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/purchase-orders/{purchaseOrderId}/cancel',
    summary: 'Cancel purchase order',
    bodySchema: CancelPurchaseOrderSchema,
    responseSchema: PurchaseOrderSchema,
  },
];

for (const action of purchaseOrderActions) {
  inventoryRegistry.registerPath({
    method: 'post',
    path: action.path,
    tags: ['Procurement'],
    summary: action.summary,
    request: {
      params: PurchaseOrderParams,
      body: { content: { 'application/json': { schema: action.bodySchema } } },
    },
    responses: createApiResponse(
      action.responseSchema ?? PurchaseOrderSchema,
      `${action.summary} successful`
    ),
  });
}

inventoryRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/inventory/dashboard',
  tags: ['Inventory'],
  summary: 'Get inventory and procurement dashboard',
  request: {
    params: OrgHotelParams,
    query: InventoryDashboardQuerySchema,
  },
  responses: createApiResponse(DashboardSchema, 'Inventory dashboard retrieved'),
});
