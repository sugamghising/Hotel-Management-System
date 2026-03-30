import { Router } from 'express';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { posController } from './pos.controller';
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

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const OutletParams = OrgHotelParams.merge(OutletIdParamSchema);
const MenuParams = OrgHotelParams.merge(MenuItemIdParamSchema);
const OrderParams = OrgHotelParams.merge(OrderIdParamSchema);
const OrderItemParams = OrderParams.merge(ItemIdParamSchema);

router.post(
  '/outlets',
  requirePermission('POS.MANAGE_OUTLET'),
  validate({ params: OrgHotelParams, body: CreateOutletSchema }),
  posController.createOutlet
);

router.get(
  '/outlets',
  requirePermission('POS.MANAGE_OUTLET'),
  validate({ params: OrgHotelParams, query: ListOutletsQuerySchema }),
  posController.listOutlets
);

router.patch(
  '/outlets/:outletId',
  requirePermission('POS.MANAGE_OUTLET'),
  validate({ params: OutletParams, body: UpdateOutletSchema }),
  posController.updateOutlet
);

router.post(
  '/menu',
  requirePermission('POS.MANAGE_MENU'),
  validate({ params: OrgHotelParams, body: CreateMenuItemSchema }),
  posController.createMenuItem
);

router.get(
  '/menu',
  requirePermission('POS.MANAGE_MENU'),
  validate({ params: OrgHotelParams, query: ListMenuItemsQuerySchema }),
  posController.listMenuItems
);

router.patch(
  '/menu/:menuItemId',
  requirePermission('POS.MANAGE_MENU'),
  validate({ params: MenuParams, body: UpdateMenuItemSchema }),
  posController.updateMenuItem
);

router.post(
  '/orders',
  requirePermission('POS.CREATE_ORDER'),
  validate({ params: OrgHotelParams, body: CreateOrderSchema }),
  posController.createOrder
);

router.get(
  '/orders',
  requirePermission('POS.READ_ORDER'),
  validate({ params: OrgHotelParams, query: ListOrdersQuerySchema }),
  posController.listOrders
);

router.get(
  '/orders/:orderId',
  requirePermission('POS.READ_ORDER'),
  validate({ params: OrderParams }),
  posController.getOrder
);

router.post(
  '/orders/:orderId/items',
  requirePermission('POS.MODIFY_ORDER'),
  validate({ params: OrderParams, body: AddOrderItemsSchema }),
  posController.addOrderItems
);

router.patch(
  '/orders/:orderId/items/:itemId',
  requirePermission('POS.MODIFY_ORDER'),
  validate({ params: OrderItemParams, body: UpdateOrderItemSchema }),
  posController.updateOrderItem
);

router.delete(
  '/orders/:orderId/items/:itemId',
  requirePermission('POS.MODIFY_ORDER'),
  validate({ params: OrderItemParams, body: VoidOrderItemSchema }),
  posController.removeOrderItem
);

router.post(
  '/orders/:orderId/close',
  requirePermission('POS.CLOSE_ORDER'),
  validate({ params: OrderParams, body: CloseOrderSchema }),
  posController.closeOrder
);

router.post(
  '/orders/:orderId/post-to-room',
  requirePermission('POS.POST_ROOM_CHARGE'),
  validate({ params: OrderParams, body: PostToRoomSchema }),
  posController.postToRoom
);

router.post(
  '/orders/:orderId/void',
  requirePermission('POS.VOID_ORDER'),
  validate({ params: OrderParams, body: VoidOrderSchema }),
  posController.voidOrder
);

router.post(
  '/orders/:orderId/reopen',
  requirePermission('POS.REOPEN_ORDER'),
  validate({ params: OrderParams, body: ReopenOrderSchema }),
  posController.reopenOrder
);

router.post(
  '/orders/:orderId/split',
  requirePermission('POS.SPLIT_ORDER'),
  validate({ params: OrderParams, body: SplitOrderSchema }),
  posController.splitOrder
);

router.post(
  '/orders/:orderId/transfer',
  requirePermission('POS.TRANSFER_ORDER'),
  validate({ params: OrderParams, body: TransferOrderSchema }),
  posController.transferOrder
);

router.get(
  '/dashboard',
  requirePermission('POS.VIEW_DASHBOARD'),
  validate({ params: OrgHotelParams, query: PosDashboardQuerySchema }),
  posController.getDashboard
);

router.get(
  '/reports/sales',
  requirePermission('POS.VIEW_REPORTS'),
  validate({ params: OrgHotelParams, query: PosSalesReportQuerySchema }),
  posController.getSalesReport
);

export default router;
