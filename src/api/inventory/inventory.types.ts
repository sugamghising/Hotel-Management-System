export interface InventoryPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryPaginatedResponse<T> {
  items: T[];
  meta: InventoryPaginationMeta;
}

export interface InventoryDashboardResponse {
  asOfDate: string;
  totals: {
    items: number;
    lowStockItems: number;
    activeVendors: number;
    draftPurchaseOrders: number;
    pendingApprovalPurchaseOrders: number;
    openPurchaseOrders: number;
    receivedPurchaseOrdersToday: number;
  };
  stock: {
    totalUnitsOnHand: number;
    totalUnitsAvailable: number;
    totalValuation: number;
  };
  purchaseOrders: {
    pendingValue: number;
    receivedValueToday: number;
  };
  topLowStockItems: Array<{
    itemId: string;
    sku: string;
    name: string;
    availableStock: number;
    reorderPoint: number;
    reorderQty: number;
  }>;
}

export interface ReceiveGoodsResult {
  purchaseOrderId: string;
  status: 'PARTIALLY_RECEIVED' | 'RECEIVED';
  receivedDate: Date;
  receiptTotalCost: number;
  updatedLines: Array<{
    poItemId: string;
    itemId: string;
    receivedQty: number;
    cumulativeReceivedQty: number;
    unitCost: number;
    totalCost: number;
  }>;
}
