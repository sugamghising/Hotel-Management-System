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
  private getDb(tx?: Prisma.TransactionClient) {
    return tx ?? prisma;
  }

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

  async createInventoryItem(
    data: Prisma.InventoryItemUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryItem.create({ data });
  }

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

  async createVendor(data: Prisma.VendorUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).vendor.create({ data });
  }

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

  async createPurchaseOrder(
    data: Prisma.PurchaseOrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrder.create({
      data,
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

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

  async createPurchaseOrderItem(
    data: Prisma.PurchaseOrderItemUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).purchaseOrderItem.create({ data });
  }

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

  async deletePurchaseOrderItem(poItemId: string, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).purchaseOrderItem.delete({
      where: { id: poItemId },
    });
  }

  async findPurchaseOrderItemById(poItemId: string, tx?: Prisma.TransactionClient) {
    return this.getDb(tx).purchaseOrderItem.findUnique({
      where: { id: poItemId },
    });
  }

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

  async createInventoryTransaction(
    data: Prisma.InventoryTransactionUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    return this.getDb(tx).inventoryTransaction.create({ data });
  }

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

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => fn(tx));
  }

  toApiNumber(value: Prisma.Decimal | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number.parseFloat(value.toString());
  }

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
