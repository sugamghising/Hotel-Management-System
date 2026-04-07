import { config } from '../../config';
import {
  BadRequestError,
  ConflictError,
  InsufficientStockError,
  InvalidStatusTransitionError,
  NotFoundError,
  ProcurementInvalidPurchaseOrderStatusError,
  ProcurementOverReceiptError,
  ProcurementPurchaseOrderClosedError,
  UnprocessableEntityError,
} from '../../core';
import { Prisma } from '../../generated/prisma';
import { type InventoryRepositoryType, inventoryRepository } from './inventory.repository';
import type {
  AddPurchaseOrderItemInput,
  AdjustInventoryStockInput,
  ApprovePurchaseOrderInput,
  ApproveVendorInput,
  CancelPurchaseOrderInput,
  ConsumeInventoryStockInput,
  CreateInventoryItemInput,
  CreatePurchaseOrderInput,
  CreateVendorInput,
  InventoryDashboardQueryInput,
  ListInventoryItemsQueryInput,
  ListInventoryTransactionsQueryInput,
  ListPurchaseOrdersQueryInput,
  ListVendorsQueryInput,
  ReceivePurchaseOrderInput,
  SubmitPurchaseOrderInput,
  UpdateInventoryItemInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput,
  UpdateVendorInput,
} from './inventory.schema';
import type {
  InventoryDashboardResponse,
  InventoryPaginatedResponse,
  ReceiveGoodsResult,
} from './inventory.types';

const ZERO = new Prisma.Decimal(0);

const PURCHASE_ORDER_EDITABLE_STATUSES = ['DRAFT'] as const;
const PURCHASE_ORDER_RECEIVABLE_STATUSES = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;

/**
 * Converts primitive or Decimal-like values into a Prisma Decimal instance.
 *
 * @param value - Numeric input as Decimal, number, or numeric string.
 * @returns Decimal representation of the input value.
 */
const asDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

/**
 * Serializes unknown input into Prisma-compatible JSON value.
 *
 * @param value - Arbitrary serializable payload.
 * @returns Deep-cloned JSON value safe for Prisma JSON fields.
 */
const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * Normalizes a date into UTC date-only midnight.
 *
 * @param value - Source date-time.
 * @returns New Date at `00:00:00.000` UTC for the same UTC calendar day.
 */
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Returns UTC start-of-day timestamp for a given date.
 *
 * @param value - Source date-time.
 * @returns New Date at UTC `00:00:00.000`.
 */
const startOfDayUtc = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));

/**
 * Returns UTC end-of-day timestamp for a given date.
 *
 * @param value - Source date-time.
 * @returns New Date at UTC `23:59:59.999`.
 */
const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

export class InventoryService {
  private readonly repo: InventoryRepositoryType;

  /**
   * Creates an inventory service with an overridable repository dependency.
   *
   * @param repository - Inventory repository implementation.
   */
  constructor(repository: InventoryRepositoryType = inventoryRepository) {
    this.repo = repository;
  }

  /**
   * Creates a new inventory item and optional opening-stock transaction.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where item is created.
   * @param input - Inventory item creation payload.
   * @param userId - Optional actor ID for audit logging.
   * @returns API-mapped inventory item.
   * @throws {ConflictError} When SKU already exists for the hotel.
   */
  async createInventoryItem(
    organizationId: string,
    hotelId: string,
    input: CreateInventoryItemInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const sku = input.sku.trim().toUpperCase();
    const existing = await this.repo.findInventoryItemBySku(organizationId, hotelId, sku);
    if (existing) {
      throw new ConflictError(`Inventory SKU ${sku} already exists for this hotel`);
    }

    const actorId = userId ?? config.system.userId;

    const item = await this.repo.runInTransaction(async (tx) => {
      const avgUnitCost = asDecimal(input.avgUnitCost);
      const lastUnitCost =
        input.lastUnitCost !== undefined ? asDecimal(input.lastUnitCost) : avgUnitCost;

      const created = await this.repo.createInventoryItem(
        {
          organizationId,
          hotelId,
          sku,
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          category: input.category,
          unitOfMeasure: input.unitOfMeasure.trim(),
          parLevel: input.parLevel,
          reorderPoint: input.reorderPoint,
          reorderQty: input.reorderQty,
          currentStock: input.currentStock,
          reservedStock: 0,
          availableStock: input.currentStock,
          avgUnitCost,
          lastUnitCost,
          trackExpiry: input.trackExpiry,
          trackBatches: input.trackBatches,
          isActive: input.isActive,
          deletedAt: null,
        },
        tx
      );

      if (created.currentStock > 0) {
        await this.repo.createInventoryTransaction(
          {
            itemId: created.id,
            type: 'OPENING',
            quantity: created.currentStock,
            unitCost: created.avgUnitCost,
            totalCost: created.avgUnitCost.mul(created.currentStock),
            refType: 'INVENTORY_OPENING',
            refId: created.id,
            notes: 'Opening stock entry',
            performedBy: actorId,
          },
          tx
        );
      }

      return created;
    });

    return this.toApiInventoryItem(item);
  }

  /**
   * Lists inventory items with pagination and filtering.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is queried.
   * @param query - Filter and pagination parameters.
   * @returns Paginated inventory items with metadata.
   */
  async listInventoryItems(
    organizationId: string,
    hotelId: string,
    query: ListInventoryItemsQueryInput
  ): Promise<InventoryPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listInventoryItems(organizationId, hotelId, query);

    return {
      items: items.map((item) => this.toApiInventoryItem(item)),
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Retrieves one inventory item by ID.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is queried.
   * @param itemId - Inventory item UUID.
   * @returns API-mapped inventory item.
   * @throws {NotFoundError} When item does not exist or is soft-deleted.
   */
  async getInventoryItem(organizationId: string, hotelId: string, itemId: string) {
    await this.assertHotelScope(organizationId, hotelId);

    const item = await this.repo.findInventoryItemById(organizationId, hotelId, itemId);
    if (!item || item.deletedAt) {
      throw new NotFoundError(`Inventory item ${itemId} not found`);
    }

    return this.toApiInventoryItem(item);
  }

  /**
   * Updates editable fields of an inventory item.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is updated.
   * @param itemId - Inventory item UUID to update.
   * @param input - Partial update payload.
   * @returns API-mapped updated inventory item.
   * @throws {NotFoundError} When item does not exist or is soft-deleted.
   */
  async updateInventoryItem(
    organizationId: string,
    hotelId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const item = await this.repo.findInventoryItemById(organizationId, hotelId, itemId);
    if (!item || item.deletedAt) {
      throw new NotFoundError(`Inventory item ${itemId} not found`);
    }

    const updated = await this.repo.updateInventoryItem(itemId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() ?? null }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.unitOfMeasure !== undefined ? { unitOfMeasure: input.unitOfMeasure.trim() } : {}),
      ...(input.parLevel !== undefined ? { parLevel: input.parLevel } : {}),
      ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
      ...(input.reorderQty !== undefined ? { reorderQty: input.reorderQty } : {}),
      ...(input.trackExpiry !== undefined ? { trackExpiry: input.trackExpiry } : {}),
      ...(input.trackBatches !== undefined ? { trackBatches: input.trackBatches } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    return this.toApiInventoryItem(updated);
  }

  /**
   * Soft-deletes an inventory item by disabling and timestamping deletion.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is updated.
   * @param itemId - Inventory item UUID to soft-delete.
   * @returns API-mapped updated inventory item.
   * @throws {NotFoundError} When item does not exist or is already deleted.
   */
  async deleteInventoryItem(organizationId: string, hotelId: string, itemId: string) {
    await this.assertHotelScope(organizationId, hotelId);

    const item = await this.repo.findInventoryItemById(organizationId, hotelId, itemId);
    if (!item || item.deletedAt) {
      throw new NotFoundError(`Inventory item ${itemId} not found`);
    }

    const updated = await this.repo.updateInventoryItem(itemId, {
      isActive: false,
      deletedAt: new Date(),
    });

    return this.toApiInventoryItem(updated);
  }

  /**
   * Applies manual stock adjustments and emits inventory events.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is adjusted.
   * @param itemId - Inventory item UUID to adjust.
   * @param input - Adjustment payload with quantity delta and optional costing metadata.
   * @param userId - Optional actor ID for transaction and outbox events.
   * @returns API-mapped inventory item after adjustment.
   * @throws {NotFoundError} When item is missing, inactive, or deleted.
   * @throws {InsufficientStockError} When adjustment would violate stock constraints.
   * @remarks Complexity: O(1) with a fixed set of reads/writes in one transaction.
   */
  async adjustInventoryStock(
    organizationId: string,
    hotelId: string,
    itemId: string,
    input: AdjustInventoryStockInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const result = await this.repo.runInTransaction(async (tx) => {
      const item = await this.repo.findInventoryItemById(organizationId, hotelId, itemId, tx);
      if (!item || item.deletedAt || !item.isActive) {
        throw new NotFoundError(`Inventory item ${itemId} not found`);
      }

      const newCurrent = item.currentStock + input.quantity;
      if (newCurrent < 0 || newCurrent < item.reservedStock) {
        throw new InsufficientStockError('Stock adjustment would violate inventory constraints', {
          itemId,
          currentStock: item.currentStock,
          reservedStock: item.reservedStock,
          quantityDelta: input.quantity,
        });
      }

      const newAvailable = newCurrent - item.reservedStock;
      const previousAvailable = item.availableStock;
      const unitCost = input.unitCost !== undefined ? asDecimal(input.unitCost) : item.avgUnitCost;
      const totalCost = unitCost.mul(input.quantity);

      const updated = await this.repo.updateInventoryItem(
        item.id,
        {
          currentStock: newCurrent,
          availableStock: newAvailable,
          ...(input.unitCost !== undefined ? { lastUnitCost: unitCost } : {}),
        },
        tx
      );

      await this.repo.createInventoryTransaction(
        {
          itemId: item.id,
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          unitCost,
          totalCost,
          refType: input.refType ?? 'STOCK_ADJUSTMENT',
          refId: input.refId ?? null,
          notes: input.notes ?? input.reason,
          batchNumber: input.batchNumber ?? null,
          expiryDate: input.expiryDate ?? null,
          performedBy: actorId,
        },
        tx
      );

      if (previousAvailable > item.reorderPoint && newAvailable <= item.reorderPoint) {
        await this.repo.createOutboxEvent(
          'inventory.low_stock',
          'INVENTORY_ITEM',
          item.id,
          asJson({
            organizationId,
            hotelId,
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            reorderPoint: item.reorderPoint,
            availableStock: newAvailable,
            refType: input.refType ?? 'STOCK_ADJUSTMENT',
            refId: input.refId ?? null,
          }),
          tx
        );
      }

      await this.repo.createOutboxEvent(
        'inventory.updated',
        'INVENTORY_ITEM',
        item.id,
        asJson({
          organizationId,
          hotelId,
          itemId: item.id,
          reason: 'stock_adjusted',
          refType: input.refType ?? 'STOCK_ADJUSTMENT',
          refId: input.refId ?? null,
          dateFrom: startOfDayUtc(new Date()).toISOString(),
          dateTo: endOfDayUtc(new Date()).toISOString(),
        }),
        tx
      );

      return updated;
    });

    return this.toApiInventoryItem(result);
  }

  /**
   * Consumes inventory stock for an operational reference and emits inventory events.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose inventory is consumed.
   * @param itemId - Inventory item UUID to consume.
   * @param input - Consumption payload including quantity and reference metadata.
   * @param userId - Optional actor ID for transaction and outbox events.
   * @returns API-mapped inventory item after consumption.
   * @throws {NotFoundError} When item is missing, inactive, or deleted.
   * @throws {InsufficientStockError} When available stock is below requested quantity.
   * @remarks Complexity: O(1) with a fixed set of reads/writes in one transaction.
   */
  async consumeInventoryStock(
    organizationId: string,
    hotelId: string,
    itemId: string,
    input: ConsumeInventoryStockInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const result = await this.repo.runInTransaction(async (tx) => {
      const item = await this.repo.findInventoryItemById(organizationId, hotelId, itemId, tx);
      if (!item || item.deletedAt || !item.isActive) {
        throw new NotFoundError(`Inventory item ${itemId} not found`);
      }

      if (item.availableStock < input.quantity) {
        throw new InsufficientStockError('Insufficient available inventory stock', {
          itemId,
          availableStock: item.availableStock,
          requestedQty: input.quantity,
        });
      }

      const previousAvailable = item.availableStock;
      const newCurrent = item.currentStock - input.quantity;
      const newAvailable = item.availableStock - input.quantity;

      const updated = await this.repo.updateInventoryItem(
        item.id,
        {
          currentStock: newCurrent,
          availableStock: newAvailable,
        },
        tx
      );

      await this.repo.createInventoryTransaction(
        {
          itemId: item.id,
          type: 'CONSUMPTION',
          quantity: -input.quantity,
          unitCost: item.avgUnitCost,
          totalCost: item.avgUnitCost.mul(input.quantity).neg(),
          refType: input.refType,
          refId: input.refId,
          notes: input.notes ?? null,
          performedBy: actorId,
        },
        tx
      );

      if (previousAvailable > item.reorderPoint && newAvailable <= item.reorderPoint) {
        await this.repo.createOutboxEvent(
          'inventory.low_stock',
          'INVENTORY_ITEM',
          item.id,
          asJson({
            organizationId,
            hotelId,
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            reorderPoint: item.reorderPoint,
            availableStock: newAvailable,
            refType: input.refType,
            refId: input.refId,
          }),
          tx
        );
      }

      await this.repo.createOutboxEvent(
        'inventory.updated',
        'INVENTORY_ITEM',
        item.id,
        asJson({
          organizationId,
          hotelId,
          itemId: item.id,
          reason: 'stock_consumed',
          refType: input.refType,
          refId: input.refId,
          dateFrom: startOfDayUtc(new Date()).toISOString(),
          dateTo: endOfDayUtc(new Date()).toISOString(),
        }),
        tx
      );

      return updated;
    });

    return this.toApiInventoryItem(result);
  }

  /**
   * Lists inventory transactions with pagination and numeric field normalization.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose transactions are queried.
   * @param query - Transaction filters and pagination settings.
   * @returns Paginated transaction rows with numeric costs normalized.
   */
  async listInventoryTransactions(
    organizationId: string,
    hotelId: string,
    query: ListInventoryTransactionsQueryInput
  ): Promise<InventoryPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listInventoryTransactions(
      organizationId,
      hotelId,
      query
    );

    const mapped = items.map((item) => {
      const typed = item as {
        unitCost?: Prisma.Decimal | null;
        totalCost?: Prisma.Decimal | null;
      };

      return {
        ...item,
        unitCost:
          typed.unitCost === null
            ? null
            : typed.unitCost !== undefined
              ? this.repo.toApiNumber(typed.unitCost)
              : undefined,
        totalCost:
          typed.totalCost === null
            ? null
            : typed.totalCost !== undefined
              ? this.repo.toApiNumber(typed.totalCost)
              : undefined,
      };
    });

    return {
      items: mapped,
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Creates a vendor within hotel scope.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where vendor is created.
   * @param input - Vendor creation payload.
   * @returns API-mapped vendor.
   * @throws {ConflictError} When vendor code already exists for the hotel.
   */
  async createVendor(organizationId: string, hotelId: string, input: CreateVendorInput) {
    await this.assertHotelScope(organizationId, hotelId);

    const code = input.code.trim().toUpperCase();
    const existing = await this.repo.findVendorByCode(organizationId, hotelId, code);
    if (existing) {
      throw new ConflictError(`Vendor code ${code} already exists for this hotel`);
    }

    const vendor = await this.repo.createVendor({
      organizationId,
      hotelId,
      code,
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() ?? null,
      email: input.email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      ...(input.address !== undefined
        ? {
            address: input.address as Prisma.InputJsonValue,
          }
        : {}),
      paymentTerms: input.paymentTerms?.trim() ?? null,
      currencyCode: input.currencyCode.toUpperCase(),
      taxId: input.taxId?.trim() ?? null,
      isApproved: input.isApproved,
      isActive: input.isActive,
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
    });

    return this.toApiVendor(vendor);
  }

  /**
   * Lists vendors with pagination and filter support.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose vendors are queried.
   * @param query - Vendor filters and pagination settings.
   * @returns Paginated vendors with metadata.
   */
  async listVendors(
    organizationId: string,
    hotelId: string,
    query: ListVendorsQueryInput
  ): Promise<InventoryPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listVendors(organizationId, hotelId, query);

    return {
      items: items.map((vendor) => this.toApiVendor(vendor)),
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Retrieves a vendor by ID.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where vendor exists.
   * @param vendorId - Vendor UUID.
   * @returns API-mapped vendor record.
   * @throws {NotFoundError} When vendor does not exist.
   */
  async getVendor(organizationId: string, hotelId: string, vendorId: string) {
    await this.assertHotelScope(organizationId, hotelId);

    const vendor = await this.repo.findVendorById(organizationId, hotelId, vendorId);
    if (!vendor) {
      throw new NotFoundError(`Vendor ${vendorId} not found`);
    }

    return this.toApiVendor(vendor);
  }

  /**
   * Updates mutable vendor fields.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where vendor exists.
   * @param vendorId - Vendor UUID to update.
   * @param input - Partial vendor update payload.
   * @returns API-mapped updated vendor.
   * @throws {NotFoundError} When vendor does not exist.
   */
  async updateVendor(
    organizationId: string,
    hotelId: string,
    vendorId: string,
    input: UpdateVendorInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const vendor = await this.repo.findVendorById(organizationId, hotelId, vendorId);
    if (!vendor) {
      throw new NotFoundError(`Vendor ${vendorId} not found`);
    }

    const updated = await this.repo.updateVendor(vendor.id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.contactPerson !== undefined
        ? { contactPerson: input.contactPerson?.trim() ?? null }
        : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() ?? null } : {}),
      ...(input.address !== undefined
        ? {
            address:
              input.address === null ? Prisma.JsonNull : (input.address as Prisma.InputJsonValue),
          }
        : {}),
      ...(input.paymentTerms !== undefined
        ? { paymentTerms: input.paymentTerms?.trim() ?? null }
        : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode.toUpperCase() }
        : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
    });

    return this.toApiVendor(updated);
  }

  /**
   * Approves or unapproves a vendor for procurement workflows.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where vendor exists.
   * @param vendorId - Vendor UUID to update.
   * @param input - Approval payload containing status and optional rating.
   * @returns API-mapped updated vendor.
   * @throws {NotFoundError} When vendor does not exist.
   */
  async approveVendor(
    organizationId: string,
    hotelId: string,
    vendorId: string,
    input: ApproveVendorInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const vendor = await this.repo.findVendorById(organizationId, hotelId, vendorId);
    if (!vendor) {
      throw new NotFoundError(`Vendor ${vendorId} not found`);
    }

    const updated = await this.repo.updateVendor(vendor.id, {
      isApproved: input.approved,
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
    });

    return this.toApiVendor(updated);
  }

  /**
   * Creates a draft purchase order with line items and computed totals.
   *
   * The method validates vendor and item eligibility, generates a unique PO number with
   * retry handling for unique-key races, inserts header and lines in a transaction, and
   * recalculates subtotal/total before returning API-mapped output.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order is created.
   * @param input - Purchase order creation payload including vendor and item lines.
   * @param userId - Optional actor ID used as requester.
   * @returns API-mapped purchase order with vendor and item details.
   * @throws {NotFoundError} When vendor or inventory items are missing/inactive.
   * @throws {ConflictError} When duplicate PO number collisions exceed retry threshold.
   * @remarks Complexity: O(n) in number of purchase-order lines.
   * @example
   * const po = await service.createPurchaseOrder(organizationId, hotelId, {
   *   vendorId,
   *   items: [{ itemId, quantity: 10, unitPrice: 4.25 }],
   *   taxAmount: 0,
   *   shippingCost: 0,
   * });
   */
  async createPurchaseOrder(
    organizationId: string,
    hotelId: string,
    input: CreatePurchaseOrderInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const MAX_PO_NUMBER_RETRIES = 5;
    let purchaseOrder: Awaited<ReturnType<typeof this.repo.findPurchaseOrderById>> | undefined =
      undefined;

    for (let attempt = 0; attempt <= MAX_PO_NUMBER_RETRIES; attempt++) {
      try {
        purchaseOrder = await this.repo.runInTransaction(async (tx) => {
          const vendor = await this.repo.findVendorById(
            organizationId,
            hotelId,
            input.vendorId,
            tx
          );
          if (!vendor || !vendor.isActive) {
            throw new NotFoundError(`Vendor ${input.vendorId} not found`);
          }

          const itemIds = input.items.map((item) => item.itemId);
          const inventoryItems = await this.repo.findInventoryItemsByIds(
            organizationId,
            hotelId,
            itemIds,
            tx
          );
          if (inventoryItems.length !== itemIds.length) {
            throw new NotFoundError('One or more purchase order items do not exist in inventory');
          }

          const invalidItem = inventoryItems.find((item) => item.deletedAt || !item.isActive);
          if (invalidItem) {
            throw new ConflictError(
              `Inventory item ${invalidItem.id} is inactive and cannot be ordered`
            );
          }

          const now = new Date();
          const baseSequence = await this.repo.countTodayPurchaseOrdersForHotel(hotelId, now, tx);
          const sequence = baseSequence + 1 + attempt;
          const poNumber = this.generatePurchaseOrderNumber(hotelId, now, sequence);

          const subtotal = input.items.reduce(
            (acc, line) => acc.plus(asDecimal(line.unitPrice).mul(line.quantity)),
            ZERO
          );
          const taxAmount = asDecimal(input.taxAmount);
          const shippingCost = asDecimal(input.shippingCost);
          const total = subtotal.plus(taxAmount).plus(shippingCost);

          const created = await this.repo.createPurchaseOrder(
            {
              organizationId,
              hotelId,
              vendorId: vendor.id,
              poNumber,
              status: 'DRAFT',
              orderDate: asDateOnly(now),
              expectedDelivery: input.expectedDelivery ? asDateOnly(input.expectedDelivery) : null,
              subtotal,
              taxAmount,
              shippingCost,
              total,
              requestedBy: actorId,
              approvedBy: null,
              approvedAt: null,
              notes: input.notes?.trim() ?? null,
            },
            tx
          );

          for (const line of input.items) {
            const unitPrice = asDecimal(line.unitPrice);
            await this.repo.createPurchaseOrderItem(
              {
                poId: created.id,
                itemId: line.itemId,
                quantity: line.quantity,
                unitPrice,
                totalPrice: unitPrice.mul(line.quantity),
                receivedQty: 0,
              },
              tx
            );
          }

          const orderWithItems = await this.repo.recomputePurchaseOrderTotals(created.id, tx);
          return orderWithItems;
        });
        break;
      } catch (error) {
        if (
          attempt < MAX_PO_NUMBER_RETRIES &&
          error instanceof Prisma.PrismaClientKnownRequestError
        ) {
          const prismaError = error as Prisma.PrismaClientKnownRequestError;
          if (prismaError.code === 'P2002') {
            continue;
          }
        }
        throw error;
      }
    }

    if (!purchaseOrder) {
      throw new ConflictError('Failed to generate a unique purchase order number after retries');
    }

    return this.toApiPurchaseOrder(purchaseOrder);
  }

  /**
   * Lists purchase orders with pagination and filter support.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose purchase orders are queried.
   * @param query - Purchase-order filters and pagination settings.
   * @returns Paginated purchase orders with metadata.
   */
  async listPurchaseOrders(
    organizationId: string,
    hotelId: string,
    query: ListPurchaseOrdersQueryInput
  ): Promise<InventoryPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listPurchaseOrders(organizationId, hotelId, query);

    return {
      items: items.map((po) => this.toApiPurchaseOrder(po)),
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Retrieves a purchase order by ID.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID.
   * @returns API-mapped purchase order.
   * @throws {NotFoundError} When purchase order does not exist.
   */
  async getPurchaseOrder(organizationId: string, hotelId: string, purchaseOrderId: string) {
    await this.assertHotelScope(organizationId, hotelId);

    const po = await this.repo.findPurchaseOrderById(organizationId, hotelId, purchaseOrderId);
    if (!po) {
      throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
    }

    return this.toApiPurchaseOrder(po);
  }

  /**
   * Updates editable purchase-order header fields.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID to update.
   * @param input - Header update payload.
   * @returns API-mapped updated purchase order.
   * @throws {NotFoundError} When purchase order does not exist.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When order is not editable.
   */
  async updatePurchaseOrder(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: UpdatePurchaseOrderInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      this.assertPurchaseOrderEditable(po.status);

      const next = await this.repo.updatePurchaseOrder(
        po.id,
        {
          ...(input.expectedDelivery !== undefined
            ? {
                expectedDelivery: input.expectedDelivery
                  ? asDateOnly(input.expectedDelivery)
                  : null,
              }
            : {}),
          ...(input.taxAmount !== undefined ? { taxAmount: asDecimal(input.taxAmount) } : {}),
          ...(input.shippingCost !== undefined
            ? { shippingCost: asDecimal(input.shippingCost) }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() ?? null } : {}),
        },
        tx
      );

      if (input.taxAmount !== undefined || input.shippingCost !== undefined) {
        return this.repo.recomputePurchaseOrderTotals(next.id, tx);
      }

      return next;
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Adds a new line item to an editable purchase order.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID to modify.
   * @param input - Line item payload containing inventory item, quantity, and unit price.
   * @returns API-mapped updated purchase order.
   * @throws {NotFoundError} When purchase order or inventory item does not exist.
   * @throws {ConflictError} When line item already exists on purchase order.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When order is not editable.
   */
  async addPurchaseOrderItem(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: AddPurchaseOrderItemInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      this.assertPurchaseOrderEditable(po.status);

      const exists = po.items.some((line) => line.itemId === input.itemId);
      if (exists) {
        throw new ConflictError('Item already exists on this purchase order');
      }

      const item = await this.repo.findInventoryItemById(organizationId, hotelId, input.itemId, tx);
      if (!item || item.deletedAt || !item.isActive) {
        throw new NotFoundError(`Inventory item ${input.itemId} not found`);
      }

      const unitPrice = asDecimal(input.unitPrice);
      await this.repo.createPurchaseOrderItem(
        {
          poId: po.id,
          itemId: input.itemId,
          quantity: input.quantity,
          unitPrice,
          totalPrice: unitPrice.mul(input.quantity),
          receivedQty: 0,
        },
        tx
      );

      return this.repo.recomputePurchaseOrderTotals(po.id, tx);
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Updates quantity or price for an existing purchase-order line item.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID that owns the line.
   * @param poItemId - Purchase-order line UUID to update.
   * @param input - Partial line update payload.
   * @returns API-mapped updated purchase order.
   * @throws {NotFoundError} When purchase order or line item does not exist.
   * @throws {ConflictError} When requested quantity is below already received quantity.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When order is not editable.
   */
  async updatePurchaseOrderItem(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    poItemId: string,
    input: UpdatePurchaseOrderItemInput
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      this.assertPurchaseOrderEditable(po.status);

      const poItem = po.items.find((item) => item.id === poItemId);
      if (!poItem) {
        throw new NotFoundError(`Purchase order item ${poItemId} not found`);
      }

      const nextQuantity = input.quantity ?? poItem.quantity;
      if (nextQuantity < poItem.receivedQty) {
        throw new ConflictError('Quantity cannot be less than already received quantity');
      }

      const nextUnitPrice =
        input.unitPrice !== undefined ? asDecimal(input.unitPrice) : poItem.unitPrice;

      await this.repo.updatePurchaseOrderItem(
        poItem.id,
        {
          quantity: nextQuantity,
          unitPrice: nextUnitPrice,
          totalPrice: nextUnitPrice.mul(nextQuantity),
        },
        tx
      );

      return this.repo.recomputePurchaseOrderTotals(po.id, tx);
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Removes a line item from an editable purchase order.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID that owns the line.
   * @param poItemId - Purchase-order line UUID to remove.
   * @returns API-mapped updated purchase order.
   * @throws {NotFoundError} When purchase order or line item does not exist.
   * @throws {ConflictError} When line item has already received stock.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When order is not editable.
   */
  async removePurchaseOrderItem(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    poItemId: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      this.assertPurchaseOrderEditable(po.status);

      const poItem = po.items.find((item) => item.id === poItemId);
      if (!poItem) {
        throw new NotFoundError(`Purchase order item ${poItemId} not found`);
      }

      if (poItem.receivedQty > 0) {
        throw new ConflictError('Cannot remove a purchase order line that has received quantity');
      }

      await this.repo.deletePurchaseOrderItem(poItem.id, tx);

      return this.repo.recomputePurchaseOrderTotals(po.id, tx);
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Submits a draft purchase order for approval.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID to submit.
   * @param input - Submission payload with optional notes.
   * @param userId - Optional actor ID recorded in outbox payload.
   * @returns API-mapped submitted purchase order.
   * @throws {NotFoundError} When purchase order does not exist.
   * @throws {InvalidStatusTransitionError} When order is not in `'DRAFT'` state.
   * @throws {BadRequestError} When order has no line items.
   * @throws {UnprocessableEntityError} When vendor is not approved.
   */
  async submitPurchaseOrder(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: SubmitPurchaseOrderInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      if (po.status !== 'DRAFT') {
        throw new InvalidStatusTransitionError('Only DRAFT purchase orders can be submitted', {
          currentStatus: po.status,
          targetStatus: 'PENDING_APPROVAL',
        });
      }

      if (po.items.length === 0) {
        throw new BadRequestError(
          'Purchase order requires at least one line item before submission'
        );
      }

      const vendor = await this.repo.findVendorById(organizationId, hotelId, po.vendorId, tx);
      if (!vendor || !vendor.isApproved) {
        throw new UnprocessableEntityError(
          'Vendor must be approved before submitting purchase order'
        );
      }

      const next = await this.repo.updatePurchaseOrder(
        po.id,
        {
          status: 'PENDING_APPROVAL',
          ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        },
        tx
      );

      await this.repo.createOutboxEvent(
        'inventory.purchase_order_submitted',
        'PURCHASE_ORDER',
        po.id,
        asJson({
          organizationId,
          hotelId,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          submittedBy: actorId,
          submittedAt: new Date().toISOString(),
          total: this.repo.toApiNumber(next.total),
        }),
        tx
      );

      return next;
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Approves a pending purchase order and emits approval outbox event.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID to approve.
   * @param input - Approval payload with optional notes.
   * @param userId - Optional actor ID recorded as approver.
   * @returns API-mapped approved purchase order.
   * @throws {NotFoundError} When purchase order does not exist.
   * @throws {InvalidStatusTransitionError} When order is not in `'PENDING_APPROVAL'`.
   */
  async approvePurchaseOrder(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: ApprovePurchaseOrderInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      if (po.status !== 'PENDING_APPROVAL') {
        throw new InvalidStatusTransitionError('Only pending purchase orders can be approved', {
          currentStatus: po.status,
          targetStatus: 'APPROVED',
        });
      }

      const next = await this.repo.updatePurchaseOrder(
        po.id,
        {
          status: 'APPROVED',
          approvedBy: actorId,
          approvedAt: new Date(),
          ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        },
        tx
      );

      await this.repo.createOutboxEvent(
        'inventory.purchase_order_approved',
        'PURCHASE_ORDER',
        po.id,
        asJson({
          organizationId,
          hotelId,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          approvedBy: actorId,
          approvedAt: new Date().toISOString(),
          total: this.repo.toApiNumber(next.total),
        }),
        tx
      );

      return next;
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Receives goods against purchase-order lines and updates inventory and PO state.
   *
   * The method validates receivable status, checks line-level over-receipt constraints,
   * applies stock/cost updates per line, records purchase transactions, updates PO status,
   * updates vendor spend metrics, and emits a receipt outbox event.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID being received.
   * @param input - Receipt payload containing received lines and optional date.
   * @param userId - Optional actor ID recorded on inventory transactions and outbox events.
   * @returns Receipt result with status, total cost, and per-line update details.
   * @throws {NotFoundError} When purchase order, PO line, or inventory item cannot be found.
   * @throws {ProcurementPurchaseOrderClosedError} When PO status disallows receiving.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When PO is not in receivable states.
   * @throws {ProcurementOverReceiptError} When line receipt exceeds ordered quantity.
   * @remarks Complexity: O(l + i) in number of received lines and loaded inventory items.
   * @example
   * const receipt = await service.receivePurchaseOrder(organizationId, hotelId, purchaseOrderId, {
   *   lines: [{ poItemId, receivedQty: 5 }],
   * });
   */
  async receivePurchaseOrder(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: ReceivePurchaseOrderInput,
    userId?: string
  ): Promise<ReceiveGoodsResult> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    return this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      if (['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status)) {
        throw new ProcurementPurchaseOrderClosedError(
          `Cannot receive purchase order in ${po.status} status`,
          {
            purchaseOrderId,
            status: po.status,
          }
        );
      }

      if (
        !PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(
          po.status as (typeof PURCHASE_ORDER_RECEIVABLE_STATUSES)[number]
        )
      ) {
        throw new ProcurementInvalidPurchaseOrderStatusError(
          'Purchase order is not ready for receiving',
          {
            currentStatus: po.status,
            allowedStatuses: PURCHASE_ORDER_RECEIVABLE_STATUSES,
          }
        );
      }

      const poItemById = new Map(po.items.map((item) => [item.id, item]));

      for (const line of input.lines) {
        const poItem = poItemById.get(line.poItemId);
        if (!poItem) {
          throw new NotFoundError(`PO line ${line.poItemId} not found on purchase order`);
        }

        const nextReceivedQty = poItem.receivedQty + line.receivedQty;
        if (nextReceivedQty > poItem.quantity) {
          throw new ProcurementOverReceiptError(
            'Received quantity exceeds ordered quantity for PO line',
            {
              poItemId: poItem.id,
              orderedQty: poItem.quantity,
              currentReceivedQty: poItem.receivedQty,
              requestedReceiveQty: line.receivedQty,
            }
          );
        }
      }

      const receivedDate = input.receivedDate
        ? asDateOnly(input.receivedDate)
        : asDateOnly(new Date());

      const itemIds = input.lines
        .map((line) => poItemById.get(line.poItemId)?.itemId)
        .filter((itemId): itemId is string => Boolean(itemId));

      const inventoryItems = await this.repo.findInventoryItemsByIds(
        organizationId,
        hotelId,
        itemIds,
        tx
      );
      const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

      const updatedLines: ReceiveGoodsResult['updatedLines'] = [];
      let receiptTotalCost = ZERO;

      for (const line of input.lines) {
        const poItem = poItemById.get(line.poItemId);
        if (!poItem) {
          throw new NotFoundError(`PO line ${line.poItemId} not found on purchase order`);
        }

        const item = inventoryById.get(poItem.itemId);
        if (!item || item.deletedAt || !item.isActive) {
          throw new NotFoundError(`Inventory item ${poItem.itemId} not found or inactive`);
        }

        const receiveQty = line.receivedQty;
        const unitCost = line.unitCost !== undefined ? asDecimal(line.unitCost) : poItem.unitPrice;
        const lineTotalCost = unitCost.mul(receiveQty);

        const nextCurrentStock = item.currentStock + receiveQty;
        const nextAvailableStock = nextCurrentStock - item.reservedStock;
        const nextAvgUnitCost =
          nextCurrentStock === 0
            ? item.avgUnitCost
            : item.avgUnitCost
                .mul(item.currentStock)
                .plus(unitCost.mul(receiveQty))
                .div(nextCurrentStock);

        await this.repo.updateInventoryItem(
          item.id,
          {
            currentStock: nextCurrentStock,
            availableStock: nextAvailableStock,
            avgUnitCost: nextAvgUnitCost,
            lastUnitCost: unitCost,
          },
          tx
        );

        const nextReceivedQty = poItem.receivedQty + receiveQty;

        await this.repo.updatePurchaseOrderItem(
          poItem.id,
          {
            receivedQty: nextReceivedQty,
          },
          tx
        );

        await this.repo.createInventoryTransaction(
          {
            itemId: item.id,
            type: 'PURCHASE',
            quantity: receiveQty,
            unitCost,
            totalCost: lineTotalCost,
            refType: 'PURCHASE_ORDER',
            refId: po.id,
            notes: line.notes ?? `Received against ${po.poNumber}`,
            performedBy: actorId,
            batchNumber: line.batchNumber ?? null,
            expiryDate: line.expiryDate ?? null,
          },
          tx
        );

        receiptTotalCost = receiptTotalCost.plus(lineTotalCost);

        updatedLines.push({
          poItemId: poItem.id,
          itemId: item.id,
          receivedQty: receiveQty,
          cumulativeReceivedQty: nextReceivedQty,
          unitCost: this.repo.toApiNumber(unitCost),
          totalCost: this.repo.toApiNumber(lineTotalCost),
        });
      }

      const reloadedPoItems = await this.repo.listPurchaseOrderItems(po.id, tx);
      const allReceived = reloadedPoItems.every((line) => line.receivedQty >= line.quantity);
      const nextStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      await this.repo.updatePurchaseOrder(
        po.id,
        {
          status: nextStatus,
          receivedDate,
        },
        tx
      );

      await this.repo.updateVendor(
        po.vendorId,
        {
          lastOrderDate: receivedDate,
          totalSpend: {
            increment: receiptTotalCost,
          },
          ...(allReceived
            ? {
                totalOrders: {
                  increment: 1,
                },
              }
            : {}),
        },
        tx
      );

      await this.repo.createOutboxEvent(
        'inventory.purchase_order_received',
        'PURCHASE_ORDER',
        po.id,
        asJson({
          organizationId,
          hotelId,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          receivedDate: receivedDate.toISOString(),
          status: nextStatus,
          receiptTotalCost: this.repo.toApiNumber(receiptTotalCost),
          lines: updatedLines,
        }),
        tx
      );

      return {
        purchaseOrderId: po.id,
        status: nextStatus,
        receivedDate,
        receiptTotalCost: this.repo.toApiNumber(receiptTotalCost),
        updatedLines,
      };
    });
  }

  /**
   * Cancels an open purchase order and emits cancellation outbox event.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID where purchase order exists.
   * @param purchaseOrderId - Purchase order UUID to cancel.
   * @param input - Cancellation payload containing reason text.
   * @param userId - Optional actor ID recorded in outbox payload.
   * @returns API-mapped cancelled purchase order.
   * @throws {NotFoundError} When purchase order does not exist.
   * @throws {ProcurementPurchaseOrderClosedError} When status disallows cancellation.
   */
  async cancelPurchaseOrder(
    organizationId: string,
    hotelId: string,
    purchaseOrderId: string,
    input: CancelPurchaseOrderInput,
    userId?: string
  ) {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const updated = await this.repo.runInTransaction(async (tx) => {
      const po = await this.repo.findPurchaseOrderById(
        organizationId,
        hotelId,
        purchaseOrderId,
        tx
      );
      if (!po) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      if (['RECEIVED', 'CLOSED', 'CANCELLED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw new ProcurementPurchaseOrderClosedError(
          `Cannot cancel purchase order in ${po.status} status`,
          {
            purchaseOrderId,
            status: po.status,
          }
        );
      }

      const next = await this.repo.updatePurchaseOrder(
        po.id,
        {
          status: 'CANCELLED',
          notes: this.mergeNotes(po.notes, `Cancelled: ${input.reason}`),
        },
        tx
      );

      await this.repo.createOutboxEvent(
        'inventory.purchase_order_cancelled',
        'PURCHASE_ORDER',
        po.id,
        asJson({
          organizationId,
          hotelId,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          cancelledBy: actorId,
          cancelledAt: new Date().toISOString(),
          reason: input.reason,
        }),
        tx
      );

      return next;
    });

    return this.toApiPurchaseOrder(updated);
  }

  /**
   * Builds inventory dashboard aggregates for the selected day.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose dashboard is computed.
   * @param query - Dashboard query with optional date override.
   * @returns Inventory dashboard totals, stock valuation, PO metrics, and top low-stock items.
   * @remarks Complexity: O(n) in stock-level and low-stock result sizes plus parallel aggregates.
   */
  async getDashboard(
    organizationId: string,
    hotelId: string,
    query: InventoryDashboardQueryInput
  ): Promise<InventoryDashboardResponse> {
    await this.assertHotelScope(organizationId, hotelId);

    const asOfDate = query.date ?? new Date();
    const dayStart = startOfDayUtc(asOfDate);
    const dayEnd = endOfDayUtc(asOfDate);

    const [
      totalItems,
      lowStockItems,
      activeVendors,
      draftPurchaseOrders,
      pendingApprovalPurchaseOrders,
      openPurchaseOrders,
      receivedPurchaseOrdersToday,
      stockLevels,
      pendingOrders,
      receivedTransactions,
      topLowStock,
    ] = await Promise.all([
      this.repo.runInTransaction((tx) =>
        tx.inventoryItem.count({
          where: {
            organizationId,
            hotelId,
            deletedAt: null,
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.inventoryItem.count({
          where: {
            organizationId,
            hotelId,
            deletedAt: null,
            isActive: true,
            availableStock: {
              lte: tx.inventoryItem.fields.reorderPoint,
            },
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.vendor.count({
          where: {
            organizationId,
            hotelId,
            isActive: true,
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.purchaseOrder.count({
          where: {
            organizationId,
            hotelId,
            status: 'DRAFT',
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.purchaseOrder.count({
          where: {
            organizationId,
            hotelId,
            status: 'PENDING_APPROVAL',
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.purchaseOrder.count({
          where: {
            organizationId,
            hotelId,
            status: {
              in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
            },
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.purchaseOrder.count({
          where: {
            organizationId,
            hotelId,
            status: 'RECEIVED',
            receivedDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.inventoryItem.findMany({
          where: {
            organizationId,
            hotelId,
            deletedAt: null,
          },
          select: {
            currentStock: true,
            availableStock: true,
            avgUnitCost: true,
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.purchaseOrder.aggregate({
          where: {
            organizationId,
            hotelId,
            status: {
              in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'],
            },
          },
          _sum: {
            total: true,
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.inventoryTransaction.aggregate({
          where: {
            type: 'PURCHASE',
            performedAt: {
              gte: dayStart,
              lte: dayEnd,
            },
            item: {
              organizationId,
              hotelId,
            },
          },
          _sum: {
            totalCost: true,
          },
        })
      ),
      this.repo.runInTransaction((tx) =>
        tx.inventoryItem.findMany({
          where: {
            organizationId,
            hotelId,
            deletedAt: null,
            isActive: true,
            availableStock: {
              lte: tx.inventoryItem.fields.reorderPoint,
            },
          },
          select: {
            id: true,
            sku: true,
            name: true,
            availableStock: true,
            reorderPoint: true,
            reorderQty: true,
          },
          orderBy: [{ availableStock: 'asc' }, { name: 'asc' }],
          take: 5,
        })
      ),
    ]);

    const totalUnitsOnHand = stockLevels.reduce((acc, item) => acc + item.currentStock, 0);
    const totalUnitsAvailable = stockLevels.reduce((acc, item) => acc + item.availableStock, 0);
    const totalValuation = stockLevels.reduce(
      (acc, item) => acc.plus(item.avgUnitCost.mul(item.currentStock)),
      ZERO
    );

    return {
      asOfDate: asOfDate.toISOString(),
      totals: {
        items: totalItems,
        lowStockItems,
        activeVendors,
        draftPurchaseOrders,
        pendingApprovalPurchaseOrders,
        openPurchaseOrders,
        receivedPurchaseOrdersToday,
      },
      stock: {
        totalUnitsOnHand,
        totalUnitsAvailable,
        totalValuation: this.repo.toApiNumber(totalValuation),
      },
      purchaseOrders: {
        pendingValue: this.repo.toApiNumber(pendingOrders._sum.total),
        receivedValueToday: this.repo.toApiNumber(receivedTransactions._sum.totalCost),
      },
      topLowStockItems: topLowStock.map((item) => ({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        availableStock: item.availableStock,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
      })),
    };
  }

  /**
   * Ensures the provided hotel belongs to the organization and translates repository sentinel errors.
   *
   * @param organizationId - Organization UUID expected to own the hotel.
   * @param hotelId - Hotel UUID to validate.
   * @returns Resolves when scope is valid.
   * @throws {NotFoundError} When repository returns `HOTEL_NOT_FOUND`.
   */
  private async assertHotelScope(organizationId: string, hotelId: string): Promise<void> {
    try {
      await this.repo.ensureHotelScope(organizationId, hotelId);
    } catch (error) {
      if (error instanceof Error && error.message === 'HOTEL_NOT_FOUND') {
        throw new NotFoundError(`Hotel ${hotelId} not found for organization ${organizationId}`);
      }

      throw error;
    }
  }

  /**
   * Validates that purchase order status is editable.
   *
   * @param status - Current purchase-order status.
   * @returns Resolves when status is allowed for edits.
   * @throws {ProcurementInvalidPurchaseOrderStatusError} When status is outside editable list.
   */
  private assertPurchaseOrderEditable(status: string): void {
    if (
      !PURCHASE_ORDER_EDITABLE_STATUSES.includes(
        status as (typeof PURCHASE_ORDER_EDITABLE_STATUSES)[number]
      )
    ) {
      throw new ProcurementInvalidPurchaseOrderStatusError(
        'Purchase order is not editable in current status',
        {
          currentStatus: status,
          allowedStatuses: PURCHASE_ORDER_EDITABLE_STATUSES,
        }
      );
    }
  }

  /**
   * Generates a purchase-order number using date, hotel code prefix, and sequence.
   *
   * @param hotelId - Hotel UUID used for PO prefix.
   * @param now - Timestamp used for date component.
   * @param sequence - Daily sequence number.
   * @returns Purchase-order number in `PO-YYYYMMDD-XXXX-####` style.
   */
  private generatePurchaseOrderNumber(hotelId: string, now: Date, sequence: number): string {
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hotelPart = hotelId.slice(0, 4).toUpperCase();
    return `PO-${datePart}-${hotelPart}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Appends an additional note line to existing notes.
   *
   * @param existing - Existing multi-line notes or `null`.
   * @param addition - New note fragment to append.
   * @returns Combined note text with newline separation when existing content is present.
   */
  private mergeNotes(existing: string | null, addition: string): string {
    if (!existing || existing.trim().length === 0) {
      return addition;
    }

    return `${existing}\n${addition}`;
  }

  /**
   * Maps persistence inventory item model to API-safe object.
   *
   * @param item - Inventory item persistence model with Decimal cost fields.
   * @returns API object with Decimal values converted to numbers.
   */
  private toApiInventoryItem(item: {
    id: string;
    organizationId: string;
    hotelId: string;
    sku: string;
    name: string;
    description: string | null;
    category: string;
    unitOfMeasure: string;
    parLevel: number;
    reorderPoint: number;
    reorderQty: number;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    avgUnitCost: Prisma.Decimal;
    lastUnitCost: Prisma.Decimal;
    trackExpiry: boolean;
    trackBatches: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): Record<string, unknown> {
    return {
      ...item,
      avgUnitCost: this.repo.toApiNumber(item.avgUnitCost),
      lastUnitCost: this.repo.toApiNumber(item.lastUnitCost),
    };
  }

  /**
   * Maps persistence vendor model to API-safe object.
   *
   * @param vendor - Vendor persistence model with Decimal spend field.
   * @returns API object with `totalSpend` converted to number.
   */
  private toApiVendor(vendor: {
    id: string;
    organizationId: string;
    hotelId: string;
    code: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: Prisma.JsonValue | null;
    paymentTerms: string | null;
    currencyCode: string;
    taxId: string | null;
    isApproved: boolean;
    isActive: boolean;
    rating: number | null;
    lastOrderDate: Date | null;
    totalOrders: number;
    totalSpend: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      ...vendor,
      totalSpend: this.repo.toApiNumber(vendor.totalSpend),
    };
  }

  /**
   * Maps persistence purchase-order model to API-safe object.
   *
   * @param po - Purchase-order persistence model with Decimal totals and line amounts.
   * @returns API object with order and line Decimal values converted to numbers.
   */
  private toApiPurchaseOrder(po: {
    id: string;
    organizationId: string;
    hotelId: string;
    vendorId: string;
    poNumber: string;
    status: string;
    orderDate: Date;
    expectedDelivery: Date | null;
    receivedDate: Date | null;
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    shippingCost: Prisma.Decimal;
    total: Prisma.Decimal;
    requestedBy: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    vendor: {
      id: string;
      code: string;
      name: string;
      isApproved: boolean;
      isActive: boolean;
    };
    items: Array<{
      id: string;
      poId: string;
      itemId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      receivedQty: number;
      item: {
        id: string;
        sku: string;
        name: string;
        unitOfMeasure: string;
      };
    }>;
  }): Record<string, unknown> {
    return {
      ...po,
      subtotal: this.repo.toApiNumber(po.subtotal),
      taxAmount: this.repo.toApiNumber(po.taxAmount),
      shippingCost: this.repo.toApiNumber(po.shippingCost),
      total: this.repo.toApiNumber(po.total),
      items: po.items.map((line) => ({
        ...line,
        unitPrice: this.repo.toApiNumber(line.unitPrice),
        totalPrice: this.repo.toApiNumber(line.totalPrice),
      })),
    };
  }
}

export const inventoryService = new InventoryService();
