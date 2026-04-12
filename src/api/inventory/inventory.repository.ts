import { prisma } from '../../database/prisma';
import { type InventoryItem, Prisma, type Vendor } from '../../generated/prisma';
import type {
  ListInventoryItemsQueryInput,
  ListInventoryTransactionsQueryInput,
  ListPurchaseOrdersQueryInput,
  ListVendorsQueryInput,
} from './inventory.schema';

const PURCHASE_ORDER_INCLUDE = {
  vendor: true,
  items: {
    include: {
      item: {
        select: {
          id: true,
          sku: true,
          name: true,
          unitOfMeasure: true,
        },
      },
    },
    orderBy: [{ id: 'asc' }],
  },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_INCLUDE;
}>;

export class InventoryRepository {
  /**
   * Returns a transaction-aware Prisma client, defaulting to the global client.
   *
   * @param tx - Optional transaction client provided by a surrounding transaction.
   * @returns Transaction client when present, otherwise the root Prisma client.
   */
  private getDb(tx?: Prisma.TransactionClient) {
    return tx ?? prisma;
  }

  /**
   * Validates that a hotel exists within the given organization scope.
   *
   * @param organizationId - Organization UUID expected to own the hotel.
   * @param hotelId - Hotel UUID to validate.
   * @returns Resolves when hotel exists and is not soft-deleted.
   * @throws {Error} With message `HOTEL_NOT_FOUND` when scope validation fails.
   */
  async ensureHotelScope(organizationId: string, hotelId: string): Promise<void> {
    const hotel = await prisma.hotel.findFirst({
      where: {
        id: hotelId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!hotel) {
      throw new Error('HOTEL_NOT_FOUND');
    }
  }

  /**
   * Finds an inventory item by SKU within hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param sku - Normalized SKU value to match.
   * @returns Minimal item projection containing ID or `null` if not found.
   */
  async findInventoryItemBySku(organizationId: string, hotelId: string, sku: string) {
    return prisma.inventoryItem.findFirst({
      where: {
        organizationId,
        hotelId,
        sku,
      },
      select: { id: true },
    });
  }

  /**
   * Finds a single inventory item by ID within hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param itemId - Inventory item UUID.
   * @param tx - Optional transaction client.
   * @returns Matching inventory item or `null` when absent.
   */
  async findInventoryItemById(
    organizationId: string,
    hotelId: string,
    itemId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Finds multiple inventory items by IDs within hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param itemIds - Inventory item UUIDs to fetch.
   * @param tx - Optional transaction client.
   * @returns Matching inventory items.
   */
  async findInventoryItemsByIds(
    organizationId: string,
    hotelId: string,
    itemIds: string[],
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryItem.findMany({
      where: {
        organizationId,
        hotelId,
        id: { in: itemIds },
      },
    });
  }

  /**
   * Lists paginated inventory items using query filters.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param query - Pagination and filter inputs.
   * @returns Page of inventory items with total count.
   * @remarks Complexity: O(n) in page size plus two DB queries (rows + count).
   */
  async listInventoryItems(
    organizationId: string,
    hotelId: string,
    query: ListInventoryItemsQueryInput
  ): Promise<{ items: InventoryItem[]; total: number }> {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
      hotelId,
      deletedAt: null,
      ...(query.active !== undefined ? { isActive: query.active } : {}),
      ...(query.category?.length ? { category: { in: query.category } } : {}),
      ...(query.lowStockOnly
        ? {
            availableStock: {
              lte: prisma.inventoryItem.fields.reorderPoint,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.inventoryItem.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Creates an inventory item record.
   *
   * @param data - Prisma unchecked create payload.
   * @param tx - Optional transaction client.
   * @returns Created inventory item.
   */
  async createInventoryItem(
    data: Prisma.InventoryItemUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryItem.create({ data });
  }

  /**
   * Updates an inventory item by ID.
   *
   * @param itemId - Inventory item UUID to update.
   * @param data - Prisma unchecked update payload.
   * @param tx - Optional transaction client.
   * @returns Updated inventory item.
   */
  async updateInventoryItem(
    itemId: string,
    data: Prisma.InventoryItemUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryItem.update({
      where: { id: itemId },
      data,
    });
  }

  /**
   * Lists paginated inventory transactions constrained by item and date filters.
   *
   * @param organizationId - Organization UUID for nested item scope filtering.
   * @param hotelId - Hotel UUID for nested item scope filtering.
   * @param query - Transaction listing filters and pagination settings.
   * @returns Transaction rows with related item summary plus total count.
   * @remarks Complexity: O(n) in page size plus two DB queries (rows + count).
   */
  async listInventoryTransactions(
    organizationId: string,
    hotelId: string,
    query: ListInventoryTransactionsQueryInput
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const where: Prisma.InventoryTransactionWhereInput = {
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.type?.length ? { type: { in: query.type } } : {}),
      ...(query.refType ? { refType: query.refType } : {}),
      ...(query.from || query.to
        ? {
            performedAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      item: {
        organizationId,
        hotelId,
      },
    };

    const [items, total] = await prisma.$transaction([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
        orderBy: [{ performedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return {
      items: items as Array<Record<string, unknown>>,
      total,
    };
  }

  /**
   * Finds a vendor by vendor code within hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param code - Normalized vendor code.
   * @returns Minimal vendor projection containing ID or `null`.
   */
  async findVendorByCode(organizationId: string, hotelId: string, code: string) {
    return prisma.vendor.findFirst({
      where: {
        organizationId,
        hotelId,
        code,
      },
      select: { id: true },
    });
  }

  /**
   * Finds a vendor by ID within hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param vendorId - Vendor UUID.
   * @param tx - Optional transaction client.
   * @returns Matching vendor or `null` when absent.
   */
  async findVendorById(
    organizationId: string,
    hotelId: string,
    vendorId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).vendor.findFirst({
      where: {
        id: vendorId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Lists paginated vendors using active/approved/search filters.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param query - Vendor filters and pagination settings.
   * @returns Vendor page and total matching count.
   */
  async listVendors(
    organizationId: string,
    hotelId: string,
    query: ListVendorsQueryInput
  ): Promise<{ items: Vendor[]; total: number }> {
    const where: Prisma.VendorWhereInput = {
      organizationId,
      hotelId,
      ...(query.active !== undefined ? { isActive: query.active } : {}),
      ...(query.approved !== undefined ? { isApproved: query.approved } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { contactPerson: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Creates a vendor record.
   *
   * @param data - Prisma unchecked create payload.
   * @param tx - Optional transaction client.
   * @returns Created vendor record.
   */
  async createVendor(data: Prisma.VendorUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).vendor.create({ data });
  }

  /**
   * Updates a vendor record.
   *
   * @param vendorId - Vendor UUID to update.
   * @param data - Prisma unchecked update payload.
   * @param tx - Optional transaction client.
   * @returns Updated vendor record.
   */
  async updateVendor(
    vendorId: string,
    data: Prisma.VendorUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).vendor.update({
      where: { id: vendorId },
      data,
    });
  }

  /**
   * Counts purchase orders created on a UTC day for sequence generation.
   *
   * @param hotelId - Hotel UUID whose purchase orders are counted.
   * @param date - Anchor date used to derive UTC day boundaries.
   * @param tx - Optional transaction client.
   * @returns Number of purchase orders on the specified UTC date.
   */
  async countTodayPurchaseOrdersForHotel(
    hotelId: string,
    date: Date,
    tx?: Prisma.TransactionClient
  ) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.getDb(tx).purchaseOrder.count({
      where: {
        hotelId,
        orderDate: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  /**
   * Creates a purchase order including vendor and line item relations.
   *
   * @param data - Prisma unchecked create payload for purchase order.
   * @param tx - Optional transaction client.
   * @returns Created purchase order with configured include relations.
   */
  async createPurchaseOrder(
    data: Prisma.PurchaseOrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrder.create({
      data,
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  /**
   * Finds a purchase order by ID within organization and hotel scope.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param purchaseOrderId - Purchase order UUID.
   * @param tx - Optional transaction client.
   * @returns Purchase order with relations or `null` when absent.
   */
  async findPurchaseOrderById(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<PurchaseOrderWithRelations | null> {
    return this.getDb(tx).purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        organizationId,
        hotelId,
      },
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  /**
   * Lists paginated purchase orders with vendor and line item relations.
   *
   * @param organizationId - Organization UUID for scope filtering.
   * @param hotelId - Hotel UUID for scope filtering.
   * @param query - Purchase-order filters and pagination settings.
   * @returns Purchase-order page with total matching count.
   */
  async listPurchaseOrders(
    organizationId: string,
    hotelId: string,
    query: ListPurchaseOrdersQueryInput
  ): Promise<{ items: PurchaseOrderWithRelations[]; total: number }> {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      hotelId,
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.from || query.to
        ? {
            orderDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: PURCHASE_ORDER_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Updates a purchase order and returns relation-expanded projection.
   *
   * @param purchaseOrderId - Purchase order UUID to update.
   * @param data - Prisma unchecked update payload.
   * @param tx - Optional transaction client.
   * @returns Updated purchase order with configured include relations.
   */
  async updatePurchaseOrder(
    purchaseOrderId: string,
    data: Prisma.PurchaseOrderUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrder.update({
      where: { id: purchaseOrderId },
      data,
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  /**
   * Creates a purchase-order line item.
   *
   * @param data - Prisma unchecked create payload for PO line item.
   * @param tx - Optional transaction client.
   * @returns Created purchase-order line item.
   */
  async createPurchaseOrderItem(
    data: Prisma.PurchaseOrderItemUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrderItem.create({ data });
  }

  /**
   * Updates a purchase-order line item.
   *
   * @param poItemId - Purchase-order item UUID to update.
   * @param data - Prisma unchecked update payload.
   * @param tx - Optional transaction client.
   * @returns Updated purchase-order line item.
   */
  async updatePurchaseOrderItem(
    poItemId: string,
    data: Prisma.PurchaseOrderItemUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrderItem.update({
      where: { id: poItemId },
      data,
    });
  }

  /**
   * Deletes a purchase-order line item.
   *
   * @param poItemId - Purchase-order item UUID to delete.
   * @param tx - Optional transaction client.
   * @returns Deleted purchase-order line item.
   */
  async deletePurchaseOrderItem(poItemId: string, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).purchaseOrderItem.delete({
      where: { id: poItemId },
    });
  }

  /**
   * Finds a purchase-order line item by ID.
   *
   * @param poItemId - Purchase-order item UUID.
   * @param tx - Optional transaction client.
   * @returns Matching purchase-order line item or `null`.
   */
  async findPurchaseOrderItemById(poItemId: string, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).purchaseOrderItem.findUnique({
      where: { id: poItemId },
    });
  }

  /**
   * Lists all line items for a purchase order with inventory item metadata.
   *
   * @param purchaseOrderId - Purchase order UUID whose lines are requested.
   * @param tx - Optional transaction client.
   * @returns Purchase-order line items ordered by ID ascending.
   */
  async listPurchaseOrderItems(purchaseOrderId: string, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).purchaseOrderItem.findMany({
      where: {
        poId: purchaseOrderId,
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unitOfMeasure: true,
          },
        },
      },
      orderBy: [{ id: 'asc' }],
    });
  }

  /**
   * Recomputes purchase-order subtotal and total from line items and fixed charges.
   *
   * @param purchaseOrderId - Purchase order UUID to recompute.
   * @param tx - Optional transaction client.
   * @returns Updated purchase order with recalculated totals.
   * @throws {Error} With message `PURCHASE_ORDER_NOT_FOUND` when order is missing.
   * @remarks Complexity: O(n) in number of purchase-order line items.
   */
  async recomputePurchaseOrderTotals(purchaseOrderId: string, tx?: Prisma.TransactionClient) {
    const db = this.getDb(tx);
    const [items, order] = await Promise.all([
      db.purchaseOrderItem.findMany({
        where: { poId: purchaseOrderId },
        select: {
          quantity: true,
          unitPrice: true,
        },
      }),
      db.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          taxAmount: true,
          shippingCost: true,
        },
      }),
    ]);

    if (!order) {
      throw new Error('PURCHASE_ORDER_NOT_FOUND');
    }

    const subtotal = items.reduce(
      (acc, item) => acc.plus(item.unitPrice.mul(item.quantity)),
      new Prisma.Decimal(0)
    );

    const total = subtotal.plus(order.taxAmount).plus(order.shippingCost);

    return db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        subtotal,
        total,
      },
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  /**
   * Creates an inventory transaction ledger record.
   *
   * @param data - Prisma unchecked create payload for inventory transaction.
   * @param tx - Optional transaction client.
   * @returns Created inventory transaction.
   */
  async createInventoryTransaction(
    data: Prisma.InventoryTransactionUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryTransaction.create({ data });
  }

  /**
   * Creates a single outbox event for asynchronous integration processing.
   *
   * @param eventType - Outbox event type key.
   * @param aggregateType - Aggregate type associated with the event.
   * @param aggregateId - Aggregate identifier associated with the event.
   * @param payload - JSON payload persisted in outbox.
   * @param tx - Optional transaction client.
   * @returns Created outbox event record.
   */
  async createOutboxEvent(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).outboxEvent.create({
      data: {
        eventType,
        aggregateType,
        aggregateId,
        payload,
      },
    });
  }

  /**
   * Creates multiple outbox events in a single batch insert.
   *
   * @param events - Outbox event payloads to persist.
   * @param tx - Optional transaction client.
   * @returns Resolves when batch insert completes; no-op for empty arrays.
   */
  async createOutboxEvents(
    events: Array<{
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Prisma.InputJsonValue;
    }>,
    tx?: Prisma.TransactionClient
  ) {
    if (events.length === 0) {
      return;
    }

    await this.getDb(tx).outboxEvent.createMany({
      data: events,
    });
  }

  /**
   * Executes work inside a Prisma transaction boundary.
   *
   * @param fn - Callback receiving transaction client and returning result.
   * @returns Callback result after transaction commits.
   */
  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => fn(tx));
  }

  /**
   * Converts Decimal-like values to API numbers with zero fallback.
   *
   * @param value - Decimal, number, or nullable value to normalize.
   * @returns Numeric value or `0` when input is `null`/`undefined`.
   */
  toApiNumber(value: Prisma.Decimal | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number.parseFloat(value.toString());
  }

  /**
   * Builds pagination metadata object.
   *
   * @param total - Total matching records.
   * @param page - Current page number (1-based).
   * @param limit - Page size.
   * @returns Pagination metadata including computed `totalPages`.
   */
  toPaginationMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export type InventoryRepositoryType = InventoryRepository;
export const inventoryRepository = new InventoryRepository();
