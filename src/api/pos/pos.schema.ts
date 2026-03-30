import { z } from 'zod';

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

export const OutletIdParamSchema = z.object({
  outletId: z.string().uuid(),
});

export const MenuItemIdParamSchema = z.object({
  menuItemId: z.string().uuid(),
});

export const OrderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});

export const ItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
});

export const PaymentMethodSchema = z.enum([
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'CHECK',
  'MOBILE_PAYMENT',
  'GIFT_CARD',
  'LOYALTY_POINTS',
  'DIRECT_BILL',
  'DEPOSIT',
]);

export const POSOrderStatusSchema = z.enum(['OPEN', 'CLOSED', 'PAID', 'VOID', 'COMPED']);

export const CreateOutletSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  allowRoomPosting: z.boolean().default(true),
  allowDirectBill: z.boolean().default(true),
  isActive: z.boolean().default(true),
  openTime: z.string().max(8).optional(),
  closeTime: z.string().max(8).optional(),
});

export const ListOutletsQuerySchema = z.object({
  active: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const UpdateOutletSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(2000).nullable().optional(),
    allowRoomPosting: z.boolean().optional(),
    allowDirectBill: z.boolean().optional(),
    isActive: z.boolean().optional(),
    openTime: z.string().max(8).nullable().optional(),
    closeTime: z.string().max(8).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const CreateMenuItemSchema = z.object({
  outletId: z.string().uuid(),
  sku: z.string().min(2).max(50),
  name: z.string().min(2).max(150),
  description: z.string().max(2000).optional(),
  category: z.string().min(2).max(100),
  unitPrice: z.number().positive(),
  taxRate: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const ListMenuItemsQuerySchema = z.object({
  outletId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  active: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  includeDeleted: z.preprocess(parseBoolean, z.boolean().optional()).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const UpdateMenuItemSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(2000).nullable().optional(),
    category: z.string().min(2).max(100).optional(),
    unitPrice: z.number().positive().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const OrderItemInputSchema = z
  .object({
    menuItemId: z.string().uuid().optional(),
    itemName: z.string().min(2).max(255).optional(),
    itemCode: z.string().max(50).optional(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.number().positive().optional(),
    modifications: z.string().max(2000).optional(),
    specialInstructions: z.string().max(2000).optional(),
  })
  .refine((payload) => payload.menuItemId || (payload.itemName && payload.unitPrice), {
    message: 'Provide menuItemId or custom itemName with unitPrice',
  });

export const CreateOrderSchema = z.object({
  outletId: z.string().uuid(),
  tableNumber: z.string().max(20).optional(),
  roomNumber: z.string().max(20).optional(),
  items: z.array(OrderItemInputSchema).min(1),
  discountTotal: z.number().min(0).default(0),
  serviceCharge: z.number().min(0).default(0),
});

export const AddOrderItemsSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1),
});

export const UpdateOrderItemSchema = z
  .object({
    quantity: z.coerce.number().int().positive().optional(),
    unitPrice: z.number().positive().optional(),
    modifications: z.string().max(2000).optional(),
    specialInstructions: z.string().max(2000).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  });

export const VoidOrderItemSchema = z.object({
  reason: z.string().min(3).max(2000).optional(),
});

export const ListOrdersQuerySchema = z.object({
  status: z.preprocess(parseCsvArray, z.array(POSOrderStatusSchema).optional()),
  outletId: z.string().uuid().optional(),
  roomNumber: z.string().max(20).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CloseOrderSchema = z.object({
  paymentMethod: PaymentMethodSchema.optional(),
  paidAmount: z.number().min(0).optional(),
  autoPostToRoom: z.boolean().optional(),
  roomNumber: z.string().max(20).optional(),
});

export const PostToRoomSchema = z.object({
  roomNumber: z.string().max(20).optional(),
  force: z.boolean().default(false),
});

export const VoidOrderSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const ReopenOrderSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const SplitOrderSchema = z.object({
  splits: z
    .array(
      z.object({
        roomNumber: z.string().max(20),
        amount: z.number().positive(),
      })
    )
    .min(1),
});

export const TransferOrderSchema = z.object({
  toRoomNumber: z.string().max(20),
  amount: z.number().positive().optional(),
  reason: z.string().max(2000).optional(),
});

export const PosDashboardQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const PosSalesReportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  outletId: z.string().uuid().optional(),
  groupBy: z.enum(['DAY', 'OUTLET']).default('DAY'),
});

export type CreateOutletInput = z.infer<typeof CreateOutletSchema>;
export type ListOutletsQueryInput = z.infer<typeof ListOutletsQuerySchema>;
export type UpdateOutletInput = z.infer<typeof UpdateOutletSchema>;

export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
export type ListMenuItemsQueryInput = z.infer<typeof ListMenuItemsQuerySchema>;
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;

export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type AddOrderItemsInput = z.infer<typeof AddOrderItemsSchema>;
export type UpdateOrderItemInput = z.infer<typeof UpdateOrderItemSchema>;
export type VoidOrderItemInput = z.infer<typeof VoidOrderItemSchema>;
export type ListOrdersQueryInput = z.infer<typeof ListOrdersQuerySchema>;

export type CloseOrderInput = z.infer<typeof CloseOrderSchema>;
export type PostToRoomInput = z.infer<typeof PostToRoomSchema>;
export type VoidOrderInput = z.infer<typeof VoidOrderSchema>;
export type ReopenOrderInput = z.infer<typeof ReopenOrderSchema>;
export type SplitOrderInput = z.infer<typeof SplitOrderSchema>;
export type TransferOrderInput = z.infer<typeof TransferOrderSchema>;

export type PosDashboardQueryInput = z.infer<typeof PosDashboardQuerySchema>;
export type PosSalesReportQueryInput = z.infer<typeof PosSalesReportQuerySchema>;
