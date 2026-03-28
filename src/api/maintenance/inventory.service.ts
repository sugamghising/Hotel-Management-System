import { config } from '../../config';
import { InsufficientStockError, NotFoundError } from '../../core';
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

    if (item.availableStock < input.qty) {
      throw new InsufficientStockError('Insufficient stock for requested part consumption', {
        itemId: item.id,
        sku: item.sku,
        requestedQty: input.qty,
        availableStock: item.availableStock,
      });
    }

    const unitCost = item.avgUnitCost;
    const totalCost = unitCost.mul(input.qty);

    const updatedCount = await tx.inventoryItem.updateMany({
      where: {
        id: item.id,
        organizationId: input.organizationId,
        hotelId: input.hotelId,
        availableStock: {
          gte: input.qty,
        },
        currentStock: {
          gte: input.qty,
        },
      },
      data: {
        currentStock: {
          decrement: input.qty,
        },
        availableStock: {
          decrement: input.qty,
        },
      },
    });

    if (updatedCount.count !== 1) {
      throw new InsufficientStockError('Insufficient stock for requested part consumption', {
        itemId: item.id,
        sku: item.sku,
        requestedQty: input.qty,
        availableStock: item.availableStock,
      });
    }

    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'CONSUMPTION',
        quantity: -Math.abs(Math.trunc(input.qty)),
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
