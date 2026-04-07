import { config } from '../../config';
import { BadRequestError, InsufficientStockError, NotFoundError } from '../../core';
import type { Prisma } from '../../generated/prisma';

export interface StockCheckResult {
  itemId: string;
  sku: string;
  name: string;
  availableStock: number;
  reorderPoint: number;
  sufficient: boolean;
}

export interface ConsumeStockInput {
  itemId: string;
  qty: number;
  organizationId: string;
  hotelId: string;
  performedBy?: string;
  refType: string;
  refId: string;
  notes?: string;
}

export interface ConsumeStockResult {
  itemId: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  remainingStock: number;
}

export class InventoryService {
  /**
   * Checks whether an active inventory item can satisfy a requested quantity.
   *
   * Reads one scoped inventory item and returns stock sufficiency without mutating state.
   *
   * @param tx - Active transaction client used for scoped inventory reads.
   * @param itemId - Inventory item UUID to evaluate.
   * @param qty - Requested consumption quantity to compare against available stock.
   * @param organizationId - Organization UUID used for scope enforcement.
   * @param hotelId - Hotel UUID used for scope enforcement.
   * @returns Stock snapshot and boolean sufficiency flag for the requested quantity.
   * @throws {NotFoundError} When no active inventory item exists for the supplied scope and ID.
   */
  async checkStock(
    tx: Prisma.TransactionClient,
    itemId: string,
    qty: number,
    organizationId: string,
    hotelId: string
  ): Promise<StockCheckResult> {
    const item = await tx.inventoryItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        hotelId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        availableStock: true,
        reorderPoint: true,
      },
    });

    if (!item) {
      throw new NotFoundError(`Inventory item '${itemId}' not found`);
    }

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      availableStock: item.availableStock,
      reorderPoint: item.reorderPoint,
      sufficient: item.availableStock >= qty,
    };
  }

  /**
   * Consumes inventory stock for a maintenance reference and records cost/audit side effects.
   *
   * Validates requested quantity, performs a guarded `updateMany` decrement to prevent oversell races,
   * writes a `CONSUMPTION` transaction ledger record, re-reads remaining stock, and conditionally
   * emits an `inventory.low_stock` outbox event when reorder thresholds are crossed.
   *
   * @param tx - Active transaction client used to keep stock, ledger, and outbox writes atomic.
   * @param input - Consumption payload with scoped item identity, quantity, and reference metadata.
   * @returns Consumed quantity, resolved unit/total costs, and resulting remaining available stock.
   * @throws {NotFoundError} When the inventory item is missing or inactive in the provided scope.
   * @throws {BadRequestError} When `input.qty` is not a positive integer.
   * @throws {InsufficientStockError} When available/current stock cannot satisfy the requested quantity.
   * @remarks Complexity: O(1) local logic plus constant-count database operations per call.
   */
  async consumeStock(
    tx: Prisma.TransactionClient,
    input: ConsumeStockInput
  ): Promise<ConsumeStockResult> {
    const item = await tx.inventoryItem.findFirst({
      where: {
        id: input.itemId,
        organizationId: input.organizationId,
        hotelId: input.hotelId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        availableStock: true,
        currentStock: true,
        reorderPoint: true,
        avgUnitCost: true,
      },
    });

    if (!item) {
      throw new NotFoundError(`Inventory item '${input.itemId}' not found`);
    }

    if (!Number.isInteger(input.qty) || input.qty <= 0) {
      throw new BadRequestError('Quantity must be a positive integer', {
        itemId: item.id,
        sku: item.sku,
        requestedQty: input.qty,
      });
    }

    const qty = input.qty;

    if (item.availableStock < qty) {
      throw new InsufficientStockError('Insufficient stock for requested part consumption', {
        itemId: item.id,
        sku: item.sku,
        requestedQty: qty,
        availableStock: item.availableStock,
      });
    }

    const unitCost = item.avgUnitCost;
    const totalCost = unitCost.mul(qty);

    const updatedCount = await tx.inventoryItem.updateMany({
      where: {
        id: item.id,
        organizationId: input.organizationId,
        hotelId: input.hotelId,
        availableStock: {
          gte: qty,
        },
        currentStock: {
          gte: qty,
        },
      },
      data: {
        currentStock: {
          decrement: qty,
        },
        availableStock: {
          decrement: qty,
        },
      },
    });

    if (updatedCount.count !== 1) {
      throw new InsufficientStockError('Insufficient stock for requested part consumption', {
        itemId: item.id,
        sku: item.sku,
        requestedQty: qty,
        availableStock: item.availableStock,
      });
    }

    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'CONSUMPTION',
        quantity: -qty,
        unitCost,
        totalCost,
        refType: input.refType,
        refId: input.refId,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        performedBy: input.performedBy ?? config.system.userId,
      },
    });

    const updated = await tx.inventoryItem.findUnique({
      where: {
        id: item.id,
      },
      select: {
        availableStock: true,
        reorderPoint: true,
      },
    });

    const remainingStock = updated?.availableStock ?? item.availableStock - input.qty;
    const crossedLowStockThreshold =
      item.availableStock > item.reorderPoint && remainingStock <= item.reorderPoint;

    if (crossedLowStockThreshold) {
      await tx.outboxEvent.create({
        data: {
          eventType: 'inventory.low_stock',
          aggregateType: 'INVENTORY_ITEM',
          aggregateId: item.id,
          payload: {
            organizationId: input.organizationId,
            hotelId: input.hotelId,
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            reorderPoint: item.reorderPoint,
            availableStock: remainingStock,
            refType: input.refType,
            refId: input.refId,
          },
        },
      });
    }

    return {
      itemId: item.id,
      qty: input.qty,
      unitCost: Number(unitCost.toString()),
      totalCost: Number(totalCost.toString()),
      remainingStock,
    };
  }
}

export const inventoryService = new InventoryService();
