import { z } from 'zod';

/**
 * Normalizes comma-separated query values into string arrays for schema preprocessing.
 *
 * @param value - Raw query value that may be empty, string, or array.
 * @returns `undefined` for empty input, parsed string array for CSV input, or original value.
 */
const parseCsvArray = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return value;
};

/**
 * Normalizes boolean-like query values for schema preprocessing.
 *
 * @param value - Raw query value that may be empty, boolean, or `'true'`/`'false'` string.
 * @returns Parsed boolean, `undefined` for empty values, or original value when unparsable.
 */
const parseBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return value;
};

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const ItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
});

export const VendorIdParamSchema = z.object({
  vendorId: z.string().uuid(),
});

export const PurchaseOrderIdParamSchema = z.object({
  purchaseOrderId: z.string().uuid(),
});

export const PoItemIdParamSchema = z.object({
  poItemId: z.string().uuid(),
});

export const InventoryCategorySchema = z.enum([
  'ROOM_SUPPLIES',
  'MINIBAR',
  'CLEANING',
  'FANDB',
  'MAINTENANCE',
  'OFFICE',
  'UNIFORM',
  'MARKETING',
  'OTHER',
]);

export const TransactionTypeSchema = z.enum([
  'PURCHASE',
  'CONSUMPTION',
  'ADJUSTMENT',
  'RETURN',
  'TRANSFER',
  'WASTE',
  'OPENING',
]);

export const PurchaseOrderStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CLOSED',
]);

export const CreateInventoryItemSchema = z.object({
  sku: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  description: z.string().max(4000).optional(),
  category: InventoryCategorySchema,
  unitOfMeasure: z.string().min(1).max(20),
  parLevel: z.coerce.number().int().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative(),
  reorderQty: z.coerce.number().int().positive(),
  currentStock: z.coerce.number().int().nonnegative().default(0),
  avgUnitCost: z.coerce.number().nonnegative().default(0),
  lastUnitCost: z.coerce.number().nonnegative().optional(),
  trackExpiry: z.boolean().default(false),
  trackBatches: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UpdateInventoryItemSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    description: z.string().max(4000).nullable().optional(),
    category: InventoryCategorySchema.optional(),
    unitOfMeasure: z.string().min(1).max(20).optional(),
    parLevel: z.coerce.number().int().nonnegative().optional(),
    reorderPoint: z.coerce.number().int().nonnegative().optional(),
    reorderQty: z.coerce.number().int().positive().optional(),
    trackExpiry: z.boolean().optional(),
    trackBatches: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const ListInventoryItemsQuerySchema = z.object({
  category: z.preprocess(parseCsvArray, z.array(InventoryCategorySchema).optional()),
  active: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  lowStockOnly: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const AdjustInventoryStockSchema = z.object({
  quantity: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, { message: 'Quantity must be non-zero' }),
  unitCost: z.coerce.number().nonnegative().optional(),
  reason: z.string().min(3).max(1000),
  notes: z.string().max(2000).optional(),
  refType: z.string().max(50).optional(),
  refId: z.string().uuid().optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: z.coerce.date().optional(),
});

export const ConsumeInventoryStockSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  refType: z.string().max(50),
  refId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const ListInventoryTransactionsQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  type: z.preprocess(parseCsvArray, z.array(TransactionTypeSchema).optional()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  refType: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateVendorSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.record(z.unknown()).optional(),
  paymentTerms: z.string().max(50).optional(),
  currencyCode: z.string().length(3).default('USD'),
  taxId: z.string().max(100).optional(),
  isApproved: z.boolean().default(false),
  isActive: z.boolean().default(true),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const UpdateVendorSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    contactPerson: z.string().max(100).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    address: z.record(z.unknown()).nullable().optional(),
    paymentTerms: z.string().max(50).nullable().optional(),
    currencyCode: z.string().length(3).optional(),
    taxId: z.string().max(100).nullable().optional(),
    isActive: z.boolean().optional(),
    rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const ListVendorsQuerySchema = z.object({
  active: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  approved: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ApproveVendorSchema = z.object({
  approved: z.boolean().default(true),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const PurchaseOrderItemInputSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
});

export const CreatePurchaseOrderSchema = z
  .object({
    vendorId: z.string().uuid(),
    expectedDelivery: z.coerce.date().optional(),
    taxAmount: z.coerce.number().nonnegative().default(0),
    shippingCost: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(2000).optional(),
    items: z.array(PurchaseOrderItemInputSchema).min(1),
  })
  .refine(
    (payload) => {
      const itemIds = payload.items.map((item) => item.itemId);
      return itemIds.length === new Set(itemIds).size;
    },
    {
      message: 'Duplicate itemId is not allowed in purchase order lines',
      path: ['items'],
    }
  );

export const UpdatePurchaseOrderSchema = z
  .object({
    expectedDelivery: z.coerce.date().nullable().optional(),
    taxAmount: z.coerce.number().nonnegative().optional(),
    shippingCost: z.coerce.number().nonnegative().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const AddPurchaseOrderItemSchema = PurchaseOrderItemInputSchema;

export const UpdatePurchaseOrderItemSchema = z
  .object({
    quantity: z.coerce.number().int().positive().optional(),
    unitPrice: z.coerce.number().positive().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const ListPurchaseOrdersQuerySchema = z.object({
  status: z.preprocess(parseCsvArray, z.array(PurchaseOrderStatusSchema).optional()),
  vendorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const SubmitPurchaseOrderSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const ApprovePurchaseOrderSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const ReceivePurchaseOrderLineSchema = z.object({
  poItemId: z.string().uuid(),
  receivedQty: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive().optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export const ReceivePurchaseOrderSchema = z
  .object({
    receivedDate: z.coerce.date().optional(),
    lines: z.array(ReceivePurchaseOrderLineSchema).min(1),
  })
  .refine(
    (payload) => {
      const poItemIds = payload.lines.map((line) => line.poItemId);
      return poItemIds.length === new Set(poItemIds).size;
    },
    {
      message: 'Duplicate poItemId is not allowed in receive lines',
      path: ['lines'],
    }
  );

export const CancelPurchaseOrderSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const InventoryDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;
export type ListInventoryItemsQueryInput = z.infer<typeof ListInventoryItemsQuerySchema>;
export type AdjustInventoryStockInput = z.infer<typeof AdjustInventoryStockSchema>;
export type ConsumeInventoryStockInput = z.infer<typeof ConsumeInventoryStockSchema>;
export type ListInventoryTransactionsQueryInput = z.infer<
  typeof ListInventoryTransactionsQuerySchema
>;

export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
export type ListVendorsQueryInput = z.infer<typeof ListVendorsQuerySchema>;
export type ApproveVendorInput = z.infer<typeof ApproveVendorSchema>;

export type PurchaseOrderItemInput = z.infer<typeof PurchaseOrderItemInputSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;
export type AddPurchaseOrderItemInput = z.infer<typeof AddPurchaseOrderItemSchema>;
export type UpdatePurchaseOrderItemInput = z.infer<typeof UpdatePurchaseOrderItemSchema>;
export type ListPurchaseOrdersQueryInput = z.infer<typeof ListPurchaseOrdersQuerySchema>;
export type SubmitPurchaseOrderInput = z.infer<typeof SubmitPurchaseOrderSchema>;
export type ApprovePurchaseOrderInput = z.infer<typeof ApprovePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof ReceivePurchaseOrderSchema>;
export type CancelPurchaseOrderInput = z.infer<typeof CancelPurchaseOrderSchema>;
export type InventoryDashboardQueryInput = z.infer<typeof InventoryDashboardQuerySchema>;
