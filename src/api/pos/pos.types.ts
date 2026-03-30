import type { POSOrderStatus, PaymentMethod } from '../../generated/prisma';

export interface PosOutletResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  code: string;
  name: string;
  description: string | null;
  allowRoomPosting: boolean;
  allowDirectBill: boolean;
  isActive: boolean;
  openTime: Date | null;
  closeTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PosMenuItemResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  outletId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unitPrice: number;
  taxRate: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PosOrderItemResponse {
  id: string;
  orderId: string;
  itemName: string;
  itemCode: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifications: string | null;
  specialInstructions: string | null;
  isVoided: boolean;
  voidReason: string | null;
}

export interface PosOrderResponse {
  id: string;
  organizationId: string;
  hotelId: string;
  outletId: string;
  reservationId: string | null;
  orderNumber: string;
  outlet: string;
  tableNumber: string | null;
  roomNumber: string | null;
  status: POSOrderStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  serviceCharge: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  paidAmount: number;
  postedToRoom: boolean;
  postedToFolioAt: Date | null;
  serverId: string;
  createdAt: Date;
  closedAt: Date | null;
  outletMeta: {
    id: string;
    code: string;
    name: string;
  };
  items: PosOrderItemResponse[];
}

export interface PosPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PosPaginatedResponse<T> {
  items: T[];
  meta: PosPaginationMeta;
}

export interface PosDashboardResponse {
  asOfDate: string;
  openOrders: number;
  closedOrders: number;
  paidOrders: number;
  voidOrders: number;
  grossSales: number;
  netSales: number;
  averageCheck: number;
  postedToRoomCount: number;
  topItems: Array<{
    itemCode: string | null;
    itemName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface PosSalesReportResponse {
  from: string;
  to: string;
  summary: {
    grossSales: number;
    netSales: number;
    discountTotal: number;
    taxTotal: number;
    serviceChargeTotal: number;
    orderCount: number;
    averageCheck: number;
  };
  byPaymentMethod: Array<{
    method: PaymentMethod | 'UNPAID';
    amount: number;
    count: number;
  }>;
  byOutlet?: Array<{
    outletId: string;
    outletName: string;
    amount: number;
    count: number;
  }>;
  byDay?: Array<{
    date: string;
    grossSales: number;
    netSales: number;
    count: number;
  }>;
}

export interface PosSplitResult {
  orderId: string;
  sourceOrderNumber: string;
  totalAmount: number;
  splitTotal: number;
  splits: Array<{
    reservationId: string;
    roomNumber: string;
    amount: number;
    folioItemId: string;
  }>;
}

export interface PosTransferResult {
  orderId: string;
  sourceReservationId: string;
  targetReservationId: string;
  toRoomNumber: string;
  amount: number;
  sourceVoidedCount: number;
  targetFolioItemId: string;
}
