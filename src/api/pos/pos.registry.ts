import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  AddOrderItemsSchema,
  CloseOrderSchema,
  CreateMenuItemSchema,
  CreateOrderSchema,
  CreateOutletSchema,
  HotelIdParamSchema,
  ItemIdParamSchema,
  ListMenuItemsQuerySchema,
  ListOrdersQuerySchema,
  ListOutletsQuerySchema,
  MenuItemIdParamSchema,
  OrderIdParamSchema,
  OrganizationIdParamSchema,
  OutletIdParamSchema,
  PosDashboardQuerySchema,
  PosSalesReportQuerySchema,
  PostToRoomSchema,
  ReopenOrderSchema,
  SplitOrderSchema,
  TransferOrderSchema,
  UpdateMenuItemSchema,
  UpdateOrderItemSchema,
  UpdateOutletSchema,
  VoidOrderItemSchema,
  VoidOrderSchema,
} from './pos.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OutletParams = OrgHotelParams.merge(OutletIdParamSchema);
const MenuParams = OrgHotelParams.merge(MenuItemIdParamSchema);
const OrderParams = OrgHotelParams.merge(OrderIdParamSchema);
const OrderItemParams = OrderParams.merge(ItemIdParamSchema);

const PaginationMetaSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

const OutletSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  allowRoomPosting: z.boolean(),
  allowDirectBill: z.boolean(),
  isActive: z.boolean(),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MenuItemSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  hotelId: z.string().uuid(),
  outletId: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  unitPrice: z.number(),
  taxRate: z.number(),
  isActive: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const OrderItemSchema = z.object({
  id: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  modifications: z.string().nullable(),
  specialInstructions: z.string().nullable(),
  isVoided: z.boolean(),
  voidReason: z.string().nullable(),
});

const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  outletId: z.string().uuid(),
  reservationId: z.string().uuid().nullable(),
  outlet: z.string(),
  tableNumber: z.string().nullable(),
  roomNumber: z.string().nullable(),
  status: z.string(),
  subtotal: z.number(),
  taxTotal: z.number(),
  discountTotal: z.number(),
  serviceCharge: z.number(),
  total: z.number(),
  paymentMethod: z.string().nullable(),
  paidAmount: z.number(),
  postedToRoom: z.boolean(),
  postedToFolioAt: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  outletMeta: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
  items: z.array(OrderItemSchema),
});

const DashboardSchema = z.object({
  asOfDate: z.string(),
  openOrders: z.number().int(),
  closedOrders: z.number().int(),
  paidOrders: z.number().int(),
  voidOrders: z.number().int(),
  grossSales: z.number(),
  netSales: z.number(),
  averageCheck: z.number(),
  postedToRoomCount: z.number().int(),
  topItems: z.array(
    z.object({
      itemCode: z.string().nullable(),
      itemName: z.string(),
      quantity: z.number().int(),
      revenue: z.number(),
    })
  ),
});

const SalesReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  summary: z.object({
    grossSales: z.number(),
    netSales: z.number(),
    discountTotal: z.number(),
    taxTotal: z.number(),
    serviceChargeTotal: z.number(),
    orderCount: z.number().int(),
    averageCheck: z.number(),
  }),
  byPaymentMethod: z.array(
    z.object({
      method: z.string(),
      amount: z.number(),
      count: z.number().int(),
    })
  ),
  byOutlet: z.array(
    z.object({
      outletId: z.string().uuid(),
      outletName: z.string(),
      amount: z.number(),
      count: z.number().int(),
    })
  ),
  byDay: z.array(
    z.object({
      date: z.string(),
      grossSales: z.number(),
      netSales: z.number(),
      count: z.number().int(),
    })
  ),
});

export const posRegistry = new OpenAPIRegistry();

posRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/outlets',
  tags: ['POS'],
  summary: 'Create POS outlet',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateOutletSchema,
        },
      },
    },
  },
  responses: createApiResponse(OutletSchema, 'POS outlet created', 201),
});

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/outlets',
  tags: ['POS'],
  summary: 'List POS outlets',
  request: {
    params: OrgHotelParams,
    query: ListOutletsQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(OutletSchema), meta: PaginationMetaSchema }),
    'POS outlets retrieved'
  ),
});

posRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/outlets/{outletId}',
  tags: ['POS'],
  summary: 'Update POS outlet',
  request: {
    params: OutletParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateOutletSchema,
        },
      },
    },
  },
  responses: createApiResponse(OutletSchema, 'POS outlet updated'),
});

posRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/menu',
  tags: ['POS'],
  summary: 'Create POS menu item',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateMenuItemSchema,
        },
      },
    },
  },
  responses: createApiResponse(MenuItemSchema, 'POS menu item created', 201),
});

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/menu',
  tags: ['POS'],
  summary: 'List POS menu items',
  request: {
    params: OrgHotelParams,
    query: ListMenuItemsQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(MenuItemSchema), meta: PaginationMetaSchema }),
    'POS menu items retrieved'
  ),
});

posRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/menu/{menuItemId}',
  tags: ['POS'],
  summary: 'Update POS menu item',
  request: {
    params: MenuParams,
    body: {
      content: {
        'application/json': {
          schema: UpdateMenuItemSchema,
        },
      },
    },
  },
  responses: createApiResponse(MenuItemSchema, 'POS menu item updated'),
});

posRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders',
  tags: ['POS'],
  summary: 'Create POS order',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: CreateOrderSchema,
        },
      },
    },
  },
  responses: createApiResponse(OrderSchema, 'POS order created', 201),
});

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders',
  tags: ['POS'],
  summary: 'List POS orders',
  request: {
    params: OrgHotelParams,
    query: ListOrdersQuerySchema,
  },
  responses: createApiResponse(
    z.object({ items: z.array(OrderSchema), meta: PaginationMetaSchema }),
    'POS orders retrieved'
  ),
});

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}',
  tags: ['POS'],
  summary: 'Get POS order by id',
  request: {
    params: OrderParams,
  },
  responses: createApiResponse(OrderSchema, 'POS order retrieved'),
});

const orderActionPaths: Array<{
  method: 'post' | 'patch' | 'delete';
  path: string;
  summary: string;
  bodySchema: z.ZodTypeAny;
  params: z.ZodTypeAny;
  responseSchema: z.ZodTypeAny;
}> = [
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/items',
    summary: 'Add order items',
    bodySchema: AddOrderItemsSchema,
    params: OrderParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'patch',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/items/{itemId}',
    summary: 'Update order item',
    bodySchema: UpdateOrderItemSchema,
    params: OrderItemParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'delete',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/items/{itemId}',
    summary: 'Remove order item',
    bodySchema: VoidOrderItemSchema,
    params: OrderItemParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/close',
    summary: 'Close POS order',
    bodySchema: CloseOrderSchema,
    params: OrderParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/post-to-room',
    summary: 'Post order to room folio',
    bodySchema: PostToRoomSchema,
    params: OrderParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/void',
    summary: 'Void POS order',
    bodySchema: VoidOrderSchema,
    params: OrderParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/reopen',
    summary: 'Reopen POS order',
    bodySchema: ReopenOrderSchema,
    params: OrderParams,
    responseSchema: OrderSchema,
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/split',
    summary: 'Split POS order to multiple rooms',
    bodySchema: SplitOrderSchema,
    params: OrderParams,
    responseSchema: z.object({
      orderId: z.string().uuid(),
      sourceOrderNumber: z.string(),
      totalAmount: z.number(),
      splitTotal: z.number(),
      splits: z.array(
        z.object({
          reservationId: z.string().uuid(),
          roomNumber: z.string(),
          amount: z.number(),
          folioItemId: z.string().uuid(),
        })
      ),
    }),
  },
  {
    method: 'post',
    path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/orders/{orderId}/transfer',
    summary: 'Transfer POS order charge to another room',
    bodySchema: TransferOrderSchema,
    params: OrderParams,
    responseSchema: z.object({
      orderId: z.string().uuid(),
      sourceReservationId: z.string().uuid(),
      targetReservationId: z.string().uuid(),
      toRoomNumber: z.string(),
      amount: z.number(),
      sourceVoidedCount: z.number().int(),
      targetFolioItemId: z.string().uuid(),
    }),
  },
];

for (const action of orderActionPaths) {
  posRegistry.registerPath({
    method: action.method,
    path: action.path,
    tags: ['POS'],
    summary: action.summary,
    request: {
      params: action.params as unknown as typeof OrderParams,
      body: {
        content: {
          'application/json': {
            schema: action.bodySchema,
          },
        },
      },
    },
    responses: createApiResponse(action.responseSchema, `${action.summary} completed`),
  });
}

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/dashboard',
  tags: ['POS'],
  summary: 'Get POS dashboard',
  request: {
    params: OrgHotelParams,
    query: PosDashboardQuerySchema,
  },
  responses: createApiResponse(DashboardSchema, 'POS dashboard retrieved'),
});

posRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/pos/reports/sales',
  tags: ['POS'],
  summary: 'Get POS sales report',
  request: {
    params: OrgHotelParams,
    query: PosSalesReportQuerySchema,
  },
  responses: createApiResponse(SalesReportSchema, 'POS sales report retrieved'),
});
