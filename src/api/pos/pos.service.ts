import { config } from '../../config';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  PosCreditStopError,
  PosDirectBillNotAllowedError,
  PosOrderAlreadyVoidedError,
  PosOrderNotOpenError,
  PosReopenWindowExpiredError,
  PosRoomPostingNotAllowedError,
  PosSplitValidationError,
  PosTransferValidationError,
  UnprocessableEntityError,
} from '../../core/errors';
import { prisma } from '../../database/prisma';
import { type POSOrderStatus, type PaymentMethod, Prisma } from '../../generated/prisma';
import {
  type POSOrderWithRelations,
  type PosRepositoryType,
  posRepository,
} from './pos.repository';
import type {
  AddOrderItemsInput,
  CloseOrderInput,
  CreateMenuItemInput,
  CreateOrderInput,
  CreateOutletInput,
  ListMenuItemsQueryInput,
  ListOrdersQueryInput,
  ListOutletsQueryInput,
  PosDashboardQueryInput,
  PosSalesReportQueryInput,
  PostToRoomInput,
  ReopenOrderInput,
  SplitOrderInput,
  TransferOrderInput,
  UpdateMenuItemInput,
  UpdateOrderItemInput,
  UpdateOutletInput,
  VoidOrderInput,
  VoidOrderItemInput,
} from './pos.schema';
import type {
  PosDashboardResponse,
  PosPaginatedResponse,
  PosSalesReportResponse,
  PosSplitResult,
  PosTransferResult,
} from './pos.types';

const ZERO = new Prisma.Decimal(0);
const REOPEN_WINDOW_MINUTES = 15;

/**
 * Normalizes numeric-like inputs into Prisma Decimal instances.
 *
 * @param value - Decimal, number, or numeric string value.
 * @returns Decimal instance preserving currency precision semantics.
 */
const asDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

/**
 * Converts a timestamp to a UTC date-only value at midnight.
 *
 * @param value - Source date-time value.
 * @returns UTC date truncated to year-month-day.
 */
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/**
 * Computes the inclusive UTC start boundary for a business day.
 *
 * @param value - Any date within the target UTC day.
 * @returns Date representing `00:00:00.000` UTC.
 */
const startOfDayUtc = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));

/**
 * Computes the inclusive UTC end boundary for a business day.
 *
 * @param value - Any date within the target UTC day.
 * @returns Date representing `23:59:59.999` UTC.
 */
const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

/**
 * Serializes arbitrary values into Prisma-compatible JSON payloads.
 *
 * @param value - Value to serialize for outbox event payloads.
 * @returns JSON-safe value accepted by `Prisma.InputJsonValue`.
 */
const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class PosService {
  private readonly repo: PosRepositoryType;

  /**
   * Creates a POS service with an overridable repository implementation.
   *
   * @param repository - Repository dependency used for persistence operations.
   */
  constructor(repository: PosRepositoryType = posRepository) {
    this.repo = repository;
  }

  /**
   * Creates a new POS outlet under an organization and hotel scope.
   *
   * Validates hotel access, normalizes the outlet code for uniqueness checks,
   * parses optional opening hours, and persists the outlet record.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the outlet.
   * @param input - Outlet profile, posting capabilities, and operating hours.
   * @returns The created outlet payload.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   * @throws {ConflictError} When another outlet already uses the normalized code.
   * @throws {BadRequestError} When provided time fields are not valid `HH:mm[:ss]` values.
   * @remarks Complexity: O(1) service work with two reads and one write.
   */
  async createOutlet(
    organizationId: string,
    hotelId: string,
    input: CreateOutletInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const normalizedCode = input.code.trim().toUpperCase();

    const existing = await prisma.pOSOutlet.findFirst({
      where: {
        organizationId,
        hotelId,
        code: normalizedCode,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError(`Outlet code ${normalizedCode} already exists for this hotel`);
    }

    const outlet = await prisma.pOSOutlet.create({
      data: {
        organizationId,
        hotelId,
        code: normalizedCode,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        allowRoomPosting: input.allowRoomPosting,
        allowDirectBill: input.allowDirectBill,
        isActive: input.isActive,
        openTime: this.parseTime(input.openTime),
        closeTime: this.parseTime(input.closeTime),
      },
    });

    return {
      ...outlet,
    };
  }

  /**
   * Lists POS outlets with pagination metadata.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose outlets are requested.
   * @param query - Outlet list filters and pagination controls.
   * @returns Outlet page plus pagination metadata.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   */
  async listOutlets(
    organizationId: string,
    hotelId: string,
    query: ListOutletsQueryInput
  ): Promise<PosPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listOutlets(organizationId, hotelId, query);

    return {
      items,
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Updates mutable outlet attributes in organization and hotel scope.
   *
   * Applies partial updates only for supplied fields, including parsed opening
   * and closing times when present.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the outlet.
   * @param outletId - Outlet UUID to update.
   * @param input - Partial outlet fields to mutate.
   * @returns Updated outlet payload.
   * @throws {NotFoundError} When the hotel or outlet cannot be found in scope.
   * @throws {BadRequestError} When provided time fields are not valid `HH:mm[:ss]` values.
   */
  async updateOutlet(
    organizationId: string,
    hotelId: string,
    outletId: string,
    input: UpdateOutletInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const existing = await this.repo.findOutletById(organizationId, hotelId, outletId);
    if (!existing) {
      throw new NotFoundError(`POS outlet ${outletId} not found`);
    }

    const updated = await prisma.pOSOutlet.update({
      where: { id: outletId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() ?? null }
          : {}),
        ...(input.allowRoomPosting !== undefined
          ? { allowRoomPosting: input.allowRoomPosting }
          : {}),
        ...(input.allowDirectBill !== undefined ? { allowDirectBill: input.allowDirectBill } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.openTime !== undefined ? { openTime: this.parseTime(input.openTime) } : {}),
        ...(input.closeTime !== undefined ? { closeTime: this.parseTime(input.closeTime) } : {}),
      },
    });

    return {
      ...updated,
    };
  }

  /**
   * Creates a POS menu item for an outlet.
   *
   * Verifies outlet availability in scope, enforces hotel-level SKU uniqueness,
   * and persists Decimal-safe pricing and tax configuration.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the menu item.
   * @param input - Menu item details, outlet link, and monetary fields.
   * @returns Created menu item with numeric API-safe monetary values.
   * @throws {NotFoundError} When the hotel or outlet cannot be found in scope.
   * @throws {ConflictError} When another menu item already uses the normalized SKU.
   */
  async createMenuItem(
    organizationId: string,
    hotelId: string,
    input: CreateMenuItemInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const outlet = await this.repo.findOutletById(organizationId, hotelId, input.outletId);
    if (!outlet) {
      throw new NotFoundError(`POS outlet ${input.outletId} not found`);
    }

    const existing = await prisma.pOSMenuItem.findFirst({
      where: {
        organizationId,
        hotelId,
        sku: input.sku.trim().toUpperCase(),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError(`Menu item SKU ${input.sku} already exists for this hotel`);
    }

    const item = await prisma.pOSMenuItem.create({
      data: {
        organizationId,
        hotelId,
        outletId: input.outletId,
        sku: input.sku.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        category: input.category.trim(),
        unitPrice: asDecimal(input.unitPrice),
        taxRate: asDecimal(input.taxRate),
        isActive: input.isActive,
      },
    });

    return {
      ...item,
      unitPrice: this.repo.toApiNumber(item.unitPrice),
      taxRate: this.repo.toApiNumber(item.taxRate),
    };
  }

  /**
   * Lists menu items with filter-aware pagination.
   *
   * Converts Decimal fields from repository results into number fields expected
   * by the POS API contract.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose menu items are requested.
   * @param query - Menu item filters and pagination controls.
   * @returns Paginated menu items with converted monetary fields.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   */
  async listMenuItems(
    organizationId: string,
    hotelId: string,
    query: ListMenuItemsQueryInput
  ): Promise<PosPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listMenuItems(organizationId, hotelId, query);

    return {
      items: items.map((item) => {
        const typed = item as {
          unitPrice: Prisma.Decimal;
          taxRate: Prisma.Decimal;
        };

        return {
          ...item,
          unitPrice: this.repo.toApiNumber(typed.unitPrice),
          taxRate: this.repo.toApiNumber(typed.taxRate),
        };
      }),
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Updates mutable fields of a POS menu item.
   *
   * Supports partial field updates, including Decimal-safe pricing changes and
   * lifecycle flags used by order-entry validation.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the menu item.
   * @param menuItemId - Menu item UUID to update.
   * @param input - Partial menu item updates.
   * @returns Updated menu item with numeric API-safe monetary values.
   * @throws {NotFoundError} When the hotel or menu item cannot be found in scope.
   */
  async updateMenuItem(
    organizationId: string,
    hotelId: string,
    menuItemId: string,
    input: UpdateMenuItemInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const existing = await this.repo.findMenuItemById(organizationId, hotelId, menuItemId);
    if (!existing) {
      throw new NotFoundError(`POS menu item ${menuItemId} not found`);
    }

    const updated = await prisma.pOSMenuItem.update({
      where: { id: menuItemId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() ?? null }
          : {}),
        ...(input.category !== undefined ? { category: input.category.trim() } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: asDecimal(input.unitPrice) } : {}),
        ...(input.taxRate !== undefined ? { taxRate: asDecimal(input.taxRate) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isDeleted !== undefined ? { isDeleted: input.isDeleted } : {}),
      },
    });

    return {
      ...updated,
      unitPrice: this.repo.toApiNumber(updated.unitPrice),
      taxRate: this.repo.toApiNumber(updated.taxRate),
    };
  }

  /**
   * Creates a POS order and its initial item set in one transaction.
   *
   * The flow validates outlet availability, generates a unique order number,
   * resolves menu/custom item pricing rules, computes subtotal/tax/total, writes
   * order + line items, and emits a `pos.order.created` outbox event before
   * reloading the full order aggregate for API mapping.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param input - Order header details and requested line items.
   * @param userId - Optional actor ID; falls back to system user when omitted.
   * @returns Newly created order in API response shape.
   * @throws {NotFoundError} When scope validation fails, outlet is inactive, or the persisted order cannot be reloaded.
   * @throws {BadRequestError} When custom item payloads are incomplete.
   * @remarks Complexity: O(i + a) where `i` is `input.items.length` and `a` is order-number attempts (max 10); DB writes dominate.
   * @example
   * const order = await service.createOrder(organizationId, hotelId, {
   *   outletId,
   *   items: [{ menuItemId, quantity: 2 }],
   *   discountTotal: 0,
   *   serviceCharge: 0,
   * });
   */
  async createOrder(
    organizationId: string,
    hotelId: string,
    input: CreateOrderInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const order = await this.repo.runInTransaction(async (tx) => {
      const outlet = await this.repo.findOutletById(organizationId, hotelId, input.outletId, tx);
      if (!outlet || !outlet.isActive) {
        throw new NotFoundError(`POS outlet ${input.outletId} not found or inactive`);
      }

      const orderNumber = await this.generateOrderNumber(tx);
      const resolvedItems = await this.resolveItemsForWrite(
        tx,
        organizationId,
        hotelId,
        input.outletId,
        input.items
      );

      const discountTotal = asDecimal(input.discountTotal);
      const serviceCharge = asDecimal(input.serviceCharge);

      const totals = this.computeTotalsFromItems(resolvedItems, discountTotal, serviceCharge);

      const createdOrder = await tx.pOSOrder.create({
        data: {
          organizationId,
          hotelId,
          outletId: input.outletId,
          reservationId: null,
          orderNumber,
          outlet: outlet.name,
          tableNumber: input.tableNumber ?? null,
          roomNumber: input.roomNumber ?? null,
          status: 'OPEN',
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          discountTotal,
          serviceCharge,
          total: totals.total,
          paymentMethod: null,
          paidAmount: ZERO,
          postedToRoom: false,
          postedToFolioAt: null,
          serverId: actorId,
        },
      });

      await tx.pOSOrderItem.createMany({
        data: resolvedItems.map((item) => ({
          orderId: createdOrder.id,
          itemName: item.itemName,
          itemCode: item.itemCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          modifications: item.modifications,
          specialInstructions: item.specialInstructions,
          isVoided: false,
          voidReason: null,
        })),
      });

      await this.repo.createOutboxEvent(
        'pos.order.created',
        'POS_ORDER',
        createdOrder.id,
        asJson({
          organizationId,
          hotelId,
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          outletId: createdOrder.outletId,
          status: createdOrder.status,
          createdAt: createdOrder.createdAt.toISOString(),
        }),
        tx
      );

      const fullOrder = await this.repo.findOrderById(organizationId, hotelId, createdOrder.id, tx);
      if (!fullOrder) {
        throw new NotFoundError(`POS order ${createdOrder.id} not found after creation`);
      }

      return fullOrder;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Retrieves a single POS order in organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID.
   * @returns Order payload mapped to API response shape.
   * @throws {NotFoundError} When the hotel or order is not found in scope.
   */
  async getOrder(
    organizationId: string,
    hotelId: string,
    orderId: string
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const order = await this.repo.findOrderById(organizationId, hotelId, orderId);
    if (!order) {
      throw new NotFoundError(`POS order ${orderId} not found`);
    }

    return this.repo.toApiOrder(order);
  }

  /**
   * Lists POS orders with pagination metadata.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose orders are requested.
   * @param query - Order filters and pagination controls.
   * @returns Paginated orders mapped into API response shape.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   */
  async listOrders(
    organizationId: string,
    hotelId: string,
    query: ListOrdersQueryInput
  ): Promise<PosPaginatedResponse<Record<string, unknown>>> {
    await this.assertHotelScope(organizationId, hotelId);

    const { items, total } = await this.repo.listOrders(organizationId, hotelId, query);

    return {
      items: items.map((order) => this.repo.toApiOrder(order)),
      meta: this.repo.toPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Appends additional line items to an existing open POS order.
   *
   * Runs under one transaction: validates order state, resolves incoming item
   * definitions against menu/custom rules, inserts order items, recomputes totals,
   * and emits an outbox event for downstream integrations.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to mutate.
   * @param input - New line items to append.
   * @returns Updated order mapped to API response shape.
   * @throws {NotFoundError} When the hotel/order is not found in scope.
   * @throws {PosOrderNotOpenError} When the order status is not `'OPEN'`.
   * @throws {BadRequestError} When custom item payloads are incomplete.
   * @remarks Complexity: O(i + m) where `i` is added item count and `m` is recomputed active item count.
   */
  async addOrderItems(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: AddOrderItemsInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const order = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      this.assertOrderOpen(existing);

      const resolvedItems = await this.resolveItemsForWrite(
        tx,
        organizationId,
        hotelId,
        existing.outletId,
        input.items
      );

      await tx.pOSOrderItem.createMany({
        data: resolvedItems.map((item) => ({
          orderId: existing.id,
          itemName: item.itemName,
          itemCode: item.itemCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          modifications: item.modifications,
          specialInstructions: item.specialInstructions,
          isVoided: false,
          voidReason: null,
        })),
      });

      const updated = await this.recomputeOrderTotals(tx, organizationId, hotelId, existing.id);

      await this.repo.createOutboxEvent(
        'pos.order.items_added',
        'POS_ORDER',
        existing.id,
        asJson({
          organizationId,
          hotelId,
          orderId: existing.id,
          addedItems: input.items.length,
        }),
        tx
      );

      return updated;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Updates quantity, pricing, or notes for an existing order item.
   *
   * Ensures the parent order is open, rejects voided line edits, applies changes,
   * recomputes aggregate order totals, and publishes an item-updated outbox event.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID that contains the item.
   * @param itemId - POS order item UUID to update.
   * @param input - Partial item updates for quantity/pricing/notes.
   * @returns Updated order mapped to API response shape.
   * @throws {NotFoundError} When the hotel, order, or item cannot be found.
   * @throws {PosOrderNotOpenError} When the order status is not `'OPEN'`.
   * @throws {ConflictError} When the target item is already voided.
   */
  async updateOrderItem(
    organizationId: string,
    hotelId: string,
    orderId: string,
    itemId: string,
    input: UpdateOrderItemInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const order = await this.repo.runInTransaction(async (tx) => {
      const existingOrder = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existingOrder) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      this.assertOrderOpen(existingOrder);

      const existingItem = await this.repo.findOrderItem(orderId, itemId, tx);
      if (!existingItem) {
        throw new NotFoundError(`POS order item ${itemId} not found`);
      }

      if (existingItem.isVoided) {
        throw new ConflictError('Cannot update a voided item');
      }

      const quantity = input.quantity ?? existingItem.quantity;
      const unitPrice = asDecimal(input.unitPrice ?? existingItem.unitPrice);

      await tx.pOSOrderItem.update({
        where: { id: itemId },
        data: {
          quantity,
          unitPrice,
          totalPrice: unitPrice.mul(quantity),
          ...(input.modifications !== undefined ? { modifications: input.modifications } : {}),
          ...(input.specialInstructions !== undefined
            ? { specialInstructions: input.specialInstructions }
            : {}),
        },
      });

      const updated = await this.recomputeOrderTotals(tx, organizationId, hotelId, orderId);

      await this.repo.createOutboxEvent(
        'pos.order.item_updated',
        'POS_ORDER',
        orderId,
        asJson({
          organizationId,
          hotelId,
          orderId,
          itemId,
          quantity,
          unitPrice: unitPrice.toString(),
        }),
        tx
      );

      return updated;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Voids an order item and recomputes its parent order totals.
   *
   * Marks the item void (idempotently), recalculates order subtotal/tax/total, and
   * emits a `pos.order.item_voided` outbox event with reason metadata.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID that contains the item.
   * @param itemId - POS order item UUID to void.
   * @param input - Optional void reason payload.
   * @returns Updated order mapped to API response shape.
   * @throws {NotFoundError} When the hotel, order, or item cannot be found.
   * @throws {PosOrderNotOpenError} When the order status is not `'OPEN'`.
   */
  async removeOrderItem(
    organizationId: string,
    hotelId: string,
    orderId: string,
    itemId: string,
    input: VoidOrderItemInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const order = await this.repo.runInTransaction(async (tx) => {
      const existingOrder = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existingOrder) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      this.assertOrderOpen(existingOrder);

      const existingItem = await this.repo.findOrderItem(orderId, itemId, tx);
      if (!existingItem) {
        throw new NotFoundError(`POS order item ${itemId} not found`);
      }

      if (!existingItem.isVoided) {
        await tx.pOSOrderItem.update({
          where: { id: itemId },
          data: {
            isVoided: true,
            voidReason: input?.reason ?? 'Removed from order',
          },
        });
      }

      const updated = await this.recomputeOrderTotals(tx, organizationId, hotelId, orderId);

      await this.repo.createOutboxEvent(
        'pos.order.item_voided',
        'POS_ORDER',
        orderId,
        asJson({
          organizationId,
          hotelId,
          orderId,
          itemId,
          reason: input?.reason ?? 'Removed from order',
        }),
        tx
      );

      return updated;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Closes an order, settles optional direct-bill payment, and optionally posts to room.
   *
   * Inside one transaction, the method validates order state, recomputes totals,
   * enforces outlet billing policy, optionally captures a direct-bill payment to a
   * checked-in reservation, sets final status (`'CLOSED'` or `'PAID'`), emits
   * `pos.order.closed`, and optionally chains into room posting.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to close.
   * @param input - Closure options including payment details and room-posting flag.
   * @param userId - Optional actor ID used for payment/folio attribution.
   * @returns Closed or paid order mapped to API response shape.
   * @throws {NotFoundError} When the hotel/order/reservation cannot be found.
   * @throws {PosOrderAlreadyVoidedError} When attempting to close a voided order.
   * @throws {UnprocessableEntityError} When all order items are voided.
   * @throws {PosDirectBillNotAllowedError} When outlet policy disallows direct billing.
   * @throws {BadRequestError} When direct billing is requested without `roomNumber`.
   * @throws {ConflictError} When outlet is inactive during close processing.
   * @remarks Complexity: O(n + m) where `n` is active item count and `m` is room-posting side effects when `autoPostToRoom` is enabled.
   */
  async closeOrder(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: CloseOrderInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const closed = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (existing.status === 'VOID') {
        throw new PosOrderAlreadyVoidedError('Cannot close a voided order');
      }

      if (existing.status === 'CLOSED' || existing.status === 'PAID') {
        return existing;
      }

      const activeItems = existing.items.filter((item) => !item.isVoided);
      if (activeItems.length === 0) {
        throw new UnprocessableEntityError('Cannot close order with no active items');
      }

      const recomputed = await this.recomputeOrderTotals(tx, organizationId, hotelId, existing.id);

      const outlet = await this.repo.findOutletById(
        organizationId,
        hotelId,
        recomputed.outletId,
        tx
      );

      if (!outlet || !outlet.isActive) {
        throw new ConflictError('Cannot close order for inactive outlet');
      }

      let reservationId = recomputed.reservationId;
      const roomNumber = input.roomNumber ?? recomputed.roomNumber;
      const paymentMethod: PaymentMethod | null = input.paymentMethod ?? recomputed.paymentMethod;
      let paidAmount =
        input.paidAmount !== undefined ? asDecimal(input.paidAmount) : recomputed.paidAmount;

      if (paymentMethod === 'DIRECT_BILL') {
        if (!outlet.allowDirectBill) {
          throw new PosDirectBillNotAllowedError();
        }

        if (!roomNumber) {
          throw new BadRequestError('roomNumber is required when paymentMethod is DIRECT_BILL');
        }

        const reservation = await this.repo.findReservationByRoom(
          organizationId,
          hotelId,
          roomNumber,
          tx
        );

        if (!reservation) {
          throw new NotFoundError(`No checked-in reservation found for room ${roomNumber}`);
        }

        reservationId = reservation.id;
        paidAmount = recomputed.total;

        await tx.payment.create({
          data: {
            organizationId,
            hotelId,
            reservationId: reservation.id,
            amount: recomputed.total,
            currencyCode: 'USD',
            method: 'DIRECT_BILL',
            status: 'CAPTURED',
            notes: `POS DIRECT_BILL settlement for order ${recomputed.id}`,
            createdBy: actorId,
            processedAt: new Date(),
          },
        });
      }

      const finalStatus =
        paymentMethod && paidAmount.greaterThanOrEqualTo(recomputed.total) ? 'PAID' : 'CLOSED';

      const updated = await tx.pOSOrder.update({
        where: { id: recomputed.id },
        data: {
          status: finalStatus,
          paymentMethod,
          paidAmount,
          reservationId,
          roomNumber,
          closedAt: new Date(),
        },
      });

      await this.repo.createOutboxEvent(
        'pos.order.closed',
        'POS_ORDER',
        updated.id,
        asJson({
          organizationId,
          hotelId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          status: updated.status,
          paymentMethod: updated.paymentMethod,
          paidAmount: updated.paidAmount.toString(),
          total: updated.total.toString(),
          closedAt: updated.closedAt?.toISOString(),
        }),
        tx
      );

      const finalOrder = await this.repo.findOrderById(organizationId, hotelId, updated.id, tx);
      if (!finalOrder) {
        throw new NotFoundError(`POS order ${updated.id} not found after close`);
      }

      if (input.autoPostToRoom) {
        return this.postToRoomInternal(
          tx,
          organizationId,
          hotelId,
          finalOrder,
          {
            roomNumber: roomNumber ?? undefined,
            force: false,
          },
          actorId
        );
      }

      return finalOrder;
    });

    return this.repo.toApiOrder(closed);
  }

  /**
   * Posts a closed/paid order charge to an in-house room folio.
   *
   * Loads the order in a transaction, enforces status preconditions, and delegates
   * posting semantics to `postToRoomInternal` for idempotent folio integration.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to post.
   * @param input - Room target and optional force flag for credit-stop override.
   * @param userId - Optional actor ID used for folio attribution.
   * @returns Updated order mapped to API response shape.
   * @throws {NotFoundError} When hotel/order/reservation lookups fail.
   * @throws {ConflictError} When the order is still `'OPEN'`.
   * @throws {PosOrderAlreadyVoidedError} When attempting to post a voided order.
   * @throws {PosRoomPostingNotAllowedError} When outlet policy disallows room posting.
   */
  async postToRoom(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: PostToRoomInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);
    const actorId = userId ?? config.system.userId;

    const posted = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (existing.status === 'VOID') {
        throw new PosOrderAlreadyVoidedError('Cannot post a voided order to room');
      }

      if (existing.status === 'OPEN') {
        throw new ConflictError('Order must be closed or paid before posting to room');
      }

      return this.postToRoomInternal(tx, organizationId, hotelId, existing, input, actorId);
    });

    return this.repo.toApiOrder(posted);
  }

  /**
   * Voids an order and reverses related room-posting and direct-bill artifacts.
   *
   * The transaction marks active items void, optionally voids linked folio charges,
   * optionally creates a direct-bill refund payment, updates order status to `'VOID'`,
   * emits `pos.order.voided`, and reloads the final order aggregate.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to void.
   * @param input - Void reason payload.
   * @param userId - Optional actor ID for audit attribution.
   * @returns Voided order mapped to API response shape.
   * @throws {NotFoundError} When the hotel/order cannot be found.
   * @remarks Complexity: O(f + 1) where `f` is affected folio row count; dominant cost is transactional DB writes.
   */
  async voidOrder(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: VoidOrderInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    const order = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (existing.status === 'VOID') {
        return existing;
      }

      await tx.pOSOrderItem.updateMany({
        where: {
          orderId,
          isVoided: false,
        },
        data: {
          isVoided: true,
          voidReason: input.reason,
        },
      });

      let voidedFolioCount = 0;

      if (existing.postedToRoom && existing.reservationId) {
        const voidedFolio = await tx.folioItem.updateMany({
          where: {
            reservationId: existing.reservationId,
            source: 'POS',
            sourceRef: { startsWith: existing.id },
            isVoided: false,
          },
          data: {
            isVoided: true,
            voidedAt: new Date(),
            voidedBy: actorId,
            voidReason: input.reason,
          },
        });

        voidedFolioCount = voidedFolio.count;
      }

      let refundPaymentId: string | null = null;
      if (
        existing.paymentMethod === 'DIRECT_BILL' &&
        existing.reservationId &&
        existing.paidAmount.greaterThan(0)
      ) {
        const parentPayment = await this.repo.findDirectBillPaymentByOrder(
          existing.reservationId,
          existing.id,
          tx
        );

        const refund = await tx.payment.create({
          data: {
            organizationId,
            hotelId,
            reservationId: existing.reservationId,
            amount: existing.paidAmount,
            currencyCode: 'USD',
            method: 'DIRECT_BILL',
            status: 'REFUNDED',
            parentPaymentId: parentPayment?.id ?? null,
            isRefund: true,
            notes: `POS void refund for order ${existing.id}`,
            createdBy: actorId,
            processedAt: new Date(),
          },
        });

        refundPaymentId = refund.id;
      }

      await tx.pOSOrder.update({
        where: { id: existing.id },
        data: {
          status: 'VOID',
          closedAt: new Date(),
        },
      });

      await this.repo.createOutboxEvent(
        'pos.order.voided',
        'POS_ORDER',
        existing.id,
        asJson({
          organizationId,
          hotelId,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          reason: input.reason,
          voidedFolioCount,
          refundPaymentId,
          voidedAt: new Date().toISOString(),
        }),
        tx
      );

      const finalOrder = await this.repo.findOrderById(organizationId, hotelId, existing.id, tx);
      if (!finalOrder) {
        throw new NotFoundError(`POS order ${existing.id} not found after void`);
      }

      return finalOrder;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Reopens a recently closed order within the configured reopen window.
   *
   * Rejects voided or already room-posted orders, validates elapsed minutes since
   * close, resets payment fields, emits `pos.order.reopened`, and reloads the order.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to reopen.
   * @param _input - Reserved reopen payload (currently unused).
   * @returns Reopened order mapped to API response shape.
   * @throws {NotFoundError} When the hotel/order cannot be found.
   * @throws {PosOrderAlreadyVoidedError} When the order status is `'VOID'`.
   * @throws {PosReopenWindowExpiredError} When elapsed close time exceeds `REOPEN_WINDOW_MINUTES`.
   * @throws {ConflictError} When order state does not satisfy reopen prerequisites.
   */
  async reopenOrder(
    organizationId: string,
    hotelId: string,
    orderId: string,
    _input: ReopenOrderInput
  ): Promise<Record<string, unknown>> {
    await this.assertHotelScope(organizationId, hotelId);

    const order = await this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (existing.status === 'OPEN') {
        return existing;
      }

      if (existing.status === 'VOID') {
        throw new PosOrderAlreadyVoidedError('Cannot reopen a voided order');
      }

      if (!existing.closedAt) {
        throw new ConflictError('Order does not have a closed timestamp');
      }

      if (existing.postedToRoom) {
        throw new ConflictError('Cannot reopen an order already posted to room');
      }

      const elapsedMinutes = (Date.now() - existing.closedAt.getTime()) / (1000 * 60);
      if (elapsedMinutes > REOPEN_WINDOW_MINUTES) {
        throw new PosReopenWindowExpiredError(REOPEN_WINDOW_MINUTES);
      }

      await tx.pOSOrder.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
          closedAt: null,
          paymentMethod: null,
          paidAmount: ZERO,
        },
      });

      await this.repo.createOutboxEvent(
        'pos.order.reopened',
        'POS_ORDER',
        existing.id,
        asJson({
          organizationId,
          hotelId,
          orderId: existing.id,
          reopenedAt: new Date().toISOString(),
        }),
        tx
      );

      const finalOrder = await this.repo.findOrderById(organizationId, hotelId, existing.id, tx);
      if (!finalOrder) {
        throw new NotFoundError(`POS order ${existing.id} not found after reopen`);
      }

      return finalOrder;
    });

    return this.repo.toApiOrder(order);
  }

  /**
   * Splits a settled order total across multiple room folios.
   *
   * Validates split total parity with the order total, resolves each destination
   * room to an active reservation, writes one folio charge per split, marks the
   * order as room-posted, and emits `pos.order.split`.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to split.
   * @param input - Split allocations including destination room numbers.
   * @param userId - Optional actor ID for folio posting attribution.
   * @returns Split summary containing created folio item identifiers.
   * @throws {NotFoundError} When the hotel/order/reservations cannot be found.
   * @throws {ConflictError} When order state does not permit splitting.
   * @throws {PosOrderAlreadyVoidedError} When the order status is `'VOID'`.
   * @throws {PosSplitValidationError} When split amounts do not equal the order total.
   * @throws {PosCreditStopError} When a destination room guest is credit-stopped.
   * @remarks Complexity: O(s) reservation lookups and folio writes, where `s` is `input.splits.length`.
   */
  async splitOrder(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: SplitOrderInput,
    userId?: string
  ): Promise<PosSplitResult> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    return this.repo.runInTransaction(async (tx) => {
      const order = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!order) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (order.status === 'VOID') {
        throw new PosOrderAlreadyVoidedError('Cannot split a voided order');
      }

      if (order.status === 'OPEN') {
        throw new ConflictError('Order must be closed or paid before splitting');
      }

      if (order.postedToRoom) {
        throw new ConflictError('Order already posted to room; split is no longer allowed');
      }

      const splitTotal = input.splits.reduce((sum, split) => sum + split.amount, 0);
      const orderTotal = this.repo.toApiNumber(order.total);

      if (Math.abs(splitTotal - orderTotal) > 0.01) {
        throw new PosSplitValidationError('Split total must match order total', {
          orderTotal,
          splitTotal,
        });
      }

      const businessDate = asDateOnly(new Date());
      const splitResults: PosSplitResult['splits'] = [];

      for (const [index, split] of input.splits.entries()) {
        const reservation = await this.repo.findReservationByRoom(
          organizationId,
          hotelId,
          split.roomNumber,
          tx
        );

        if (!reservation) {
          throw new NotFoundError(`No checked-in reservation found for room ${split.roomNumber}`);
        }

        if (reservation.guest?.isCreditStopped) {
          throw new PosCreditStopError(
            reservation.guest.creditStopReason ||
              `Room ${split.roomNumber} cannot accept charges due to guest credit stop`
          );
        }

        const folioItem = await tx.folioItem.create({
          data: {
            organizationId,
            hotelId,
            reservationId: reservation.id,
            itemType: 'POS_CHARGE',
            description: `POS split charge for order ${order.orderNumber}`,
            amount: asDecimal(split.amount),
            taxAmount: ZERO,
            quantity: 1,
            unitPrice: asDecimal(split.amount),
            revenueCode: 'POS',
            department: 'FNB',
            postedAt: new Date(),
            postedBy: actorId,
            isVoided: false,
            businessDate,
            source: 'POS',
            sourceRef: `${order.id}:split:${index + 1}`,
          },
        });

        splitResults.push({
          reservationId: reservation.id,
          roomNumber: split.roomNumber,
          amount: split.amount,
          folioItemId: folioItem.id,
        });
      }

      await tx.pOSOrder.update({
        where: { id: order.id },
        data: {
          postedToRoom: true,
          postedToFolioAt: new Date(),
          reservationId: splitResults[0]?.reservationId ?? null,
          roomNumber: splitResults[0]?.roomNumber ?? null,
        },
      });

      await this.repo.createOutboxEvent(
        'pos.order.split',
        'POS_ORDER',
        order.id,
        asJson({
          organizationId,
          hotelId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          splits: splitResults,
        }),
        tx
      );

      return {
        orderId: order.id,
        sourceOrderNumber: order.orderNumber,
        totalAmount: orderTotal,
        splitTotal,
        splits: splitResults,
      };
    });
  }

  /**
   * Transfers an already room-posted order charge to another room.
   *
   * The transaction validates transfer eligibility, resolves destination stay,
   * voids previous folio postings tied to the order, creates a replacement folio
   * charge on the target reservation, updates order room linkage, and emits
   * `pos.order.transferred`.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID that owns the order.
   * @param orderId - POS order UUID to transfer.
   * @param input - Transfer destination, optional amount, and reason.
   * @param userId - Optional actor ID for folio void/create attribution.
   * @returns Transfer summary with source/target reservation metadata.
   * @throws {NotFoundError} When the hotel/order/target reservation cannot be found.
   * @throws {ConflictError} When the order is not currently room-posted.
   * @throws {PosOrderAlreadyVoidedError} When the order status is `'VOID'`.
   * @throws {PosTransferValidationError} When transfer amount is not within `(0, order.total]`.
   * @remarks Complexity: O(f) where `f` is count of source folio rows matched by `updateMany`.
   */
  async transferOrder(
    organizationId: string,
    hotelId: string,
    orderId: string,
    input: TransferOrderInput,
    userId?: string
  ): Promise<PosTransferResult> {
    await this.assertHotelScope(organizationId, hotelId);

    const actorId = userId ?? config.system.userId;

    return this.repo.runInTransaction(async (tx) => {
      const order = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
      if (!order) {
        throw new NotFoundError(`POS order ${orderId} not found`);
      }

      if (!order.postedToRoom || !order.reservationId) {
        throw new ConflictError('Only room-posted orders can be transferred');
      }

      if (order.status === 'VOID') {
        throw new PosOrderAlreadyVoidedError('Cannot transfer a voided order');
      }

      const targetReservation = await this.repo.findReservationByRoom(
        organizationId,
        hotelId,
        input.toRoomNumber,
        tx
      );

      if (!targetReservation) {
        throw new NotFoundError(`No checked-in reservation found for room ${input.toRoomNumber}`);
      }

      const transferAmount = asDecimal(input.amount ?? this.repo.toApiNumber(order.total));

      if (transferAmount.lessThanOrEqualTo(0) || transferAmount.greaterThan(order.total)) {
        throw new PosTransferValidationError(
          'Transfer amount must be greater than 0 and <= order total',
          {
            transferAmount: transferAmount.toString(),
            orderTotal: order.total.toString(),
          }
        );
      }

      const voidedSource = await tx.folioItem.updateMany({
        where: {
          reservationId: order.reservationId,
          source: 'POS',
          sourceRef: { startsWith: order.id },
          isVoided: false,
        },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedBy: actorId,
          voidReason: input.reason || `Transferred to room ${input.toRoomNumber}`,
        },
      });

      const businessDate = asDateOnly(new Date());

      const targetFolio = await tx.folioItem.create({
        data: {
          organizationId,
          hotelId,
          reservationId: targetReservation.id,
          itemType: 'POS_CHARGE',
          description: `POS transfer charge for order ${order.orderNumber}`,
          amount: transferAmount,
          taxAmount: ZERO,
          quantity: 1,
          unitPrice: transferAmount,
          revenueCode: 'POS',
          department: 'FNB',
          postedAt: new Date(),
          postedBy: actorId,
          isVoided: false,
          businessDate,
          source: 'POS',
          sourceRef: `${order.id}:transfer`,
        },
      });

      await tx.pOSOrder.update({
        where: { id: order.id },
        data: {
          reservationId: targetReservation.id,
          roomNumber: input.toRoomNumber,
          postedToRoom: true,
          postedToFolioAt: new Date(),
        },
      });

      await this.repo.createOutboxEvent(
        'pos.order.transferred',
        'POS_ORDER',
        order.id,
        asJson({
          organizationId,
          hotelId,
          orderId: order.id,
          fromReservationId: order.reservationId,
          toReservationId: targetReservation.id,
          toRoomNumber: input.toRoomNumber,
          amount: transferAmount.toString(),
          sourceVoidedCount: voidedSource.count,
          targetFolioItemId: targetFolio.id,
        }),
        tx
      );

      return {
        orderId: order.id,
        sourceReservationId: order.reservationId,
        targetReservationId: targetReservation.id,
        toRoomNumber: input.toRoomNumber,
        amount: this.repo.toApiNumber(transferAmount),
        sourceVoidedCount: voidedSource.count,
        targetFolioItemId: targetFolio.id,
      };
    });
  }

  /**
   * Builds a POS operational dashboard snapshot for a single UTC business date.
   *
   * Fetches day-scoped orders and grouped top-item sales in parallel, then derives
   * status counts and monetary KPIs from non-void orders before returning the top
   * five items ranked by sold quantity.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose dashboard is requested.
   * @param query - Optional target date; defaults to current day in UTC.
   * @returns Dashboard counters, sales KPIs, and top-item performance rows.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   * @remarks Complexity: O(o + g log g) where `o` is order count and `g` is grouped item rows for the day.
   */
  async getDashboard(
    organizationId: string,
    hotelId: string,
    query: PosDashboardQueryInput
  ): Promise<PosDashboardResponse> {
    await this.assertHotelScope(organizationId, hotelId);

    const targetDate = query.date ? asDateOnly(query.date) : asDateOnly(new Date());
    const dayStart = startOfDayUtc(targetDate);
    const dayEnd = endOfDayUtc(targetDate);

    const [orders, topItems] = await Promise.all([
      prisma.pOSOrder.findMany({
        where: {
          organizationId,
          hotelId,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      }),
      prisma.pOSOrderItem.groupBy({
        by: ['itemCode', 'itemName'],
        where: {
          isVoided: false,
          order: {
            organizationId,
            hotelId,
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        },
        _sum: {
          quantity: true,
          totalPrice: true,
        },
      }),
    ]);

    const openOrders = orders.filter((order) => order.status === 'OPEN').length;
    const closedOrders = orders.filter((order) => order.status === 'CLOSED').length;
    const paidOrders = orders.filter((order) => order.status === 'PAID').length;
    const voidOrders = orders.filter((order) => order.status === 'VOID').length;

    const grossSales = orders
      .filter((order) => order.status !== 'VOID')
      .reduce((sum, order) => sum.plus(order.total), ZERO);

    const discountTotal = orders
      .filter((order) => order.status !== 'VOID')
      .reduce((sum, order) => sum.plus(order.discountTotal), ZERO);

    const netSales = grossSales.minus(discountTotal);
    const completedOrderCount = closedOrders + paidOrders;

    return {
      asOfDate: targetDate.toISOString(),
      openOrders,
      closedOrders,
      paidOrders,
      voidOrders,
      grossSales: this.repo.toApiNumber(grossSales),
      netSales: this.repo.toApiNumber(netSales),
      averageCheck:
        completedOrderCount > 0 ? this.repo.toApiNumber(netSales.div(completedOrderCount)) : 0,
      postedToRoomCount: orders.filter((order) => order.postedToRoom).length,
      topItems: topItems
        .map((item) => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item._sum.quantity ?? 0,
          revenue: Number.parseFloat((item._sum.totalPrice ?? ZERO).toString()),
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
    };
  }

  /**
   * Produces a POS sales report for a bounded date range.
   *
   * Loads order rows plus payment/outlet aggregates in parallel, narrows results
   * to completed statuses, computes summary totals, and emits either outlet or
   * day-level breakdowns based on the requested grouping mode.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID whose sales are reported.
   * @param query - Date range, optional outlet filter, and grouping mode.
   * @returns Sales summary with payment-method breakdown and optional outlet/day grouping.
   * @throws {NotFoundError} When the hotel is outside the provided scope.
   * @throws {BadRequestError} When `query.to` is earlier than `query.from`.
   * @remarks Complexity: O(o + p + b) where `o` is matched orders, `p` is payment groups, and `b` is selected breakdown group count.
   * @example
   * const report = await service.getSalesReport(organizationId, hotelId, {
   *   from: new Date('2026-01-01'),
   *   to: new Date('2026-01-31'),
   *   groupBy: 'DAY',
   * });
   */
  async getSalesReport(
    organizationId: string,
    hotelId: string,
    query: PosSalesReportQueryInput
  ): Promise<PosSalesReportResponse> {
    await this.assertHotelScope(organizationId, hotelId);

    const from = startOfDayUtc(query.from);
    const to = endOfDayUtc(query.to);

    if (to < from) {
      throw new BadRequestError('to must be greater than or equal to from');
    }

    const where: Prisma.POSOrderWhereInput = {
      organizationId,
      hotelId,
      createdAt: {
        gte: from,
        lte: to,
      },
      ...(query.outletId ? { outletId: query.outletId } : {}),
    };

    const completedStatuses: POSOrderStatus[] = ['CLOSED', 'PAID', 'COMPED'];

    const ordersQuery = prisma.pOSOrder.findMany({
      where,
      include: {
        outletRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const paymentGroupsQuery = prisma.pOSOrder.groupBy({
      by: ['paymentMethod'],
      where: {
        ...where,
        status: {
          in: completedStatuses,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    });

    const outletGroupsQuery =
      query.groupBy === 'OUTLET'
        ? prisma.pOSOrder.groupBy({
            by: ['outletId'],
            where: {
              ...where,
              status: {
                in: completedStatuses,
              },
            },
            _sum: {
              total: true,
            },
            _count: {
              _all: true,
            },
          })
        : Promise.resolve(null);

    const [orders, paymentGroups, outletGroups] = await Promise.all([
      ordersQuery,
      paymentGroupsQuery,
      outletGroupsQuery,
    ]);

    const completedOrders = orders.filter((order) =>
      ['CLOSED', 'PAID', 'COMPED'].includes(order.status)
    );

    const grossSales = completedOrders.reduce((sum, order) => sum.plus(order.total), ZERO);
    const discountTotal = completedOrders.reduce(
      (sum, order) => sum.plus(order.discountTotal),
      ZERO
    );
    const taxTotal = completedOrders.reduce((sum, order) => sum.plus(order.taxTotal), ZERO);
    const serviceChargeTotal = completedOrders.reduce(
      (sum, order) => sum.plus(order.serviceCharge),
      ZERO
    );
    const netSales = grossSales.minus(discountTotal);

    let byOutlet: PosSalesReportResponse['byOutlet'];
    let byDay: PosSalesReportResponse['byDay'];

    if (query.groupBy === 'OUTLET' && outletGroups) {
      const outletNameById = new Map<string, string>();
      for (const order of completedOrders) {
        outletNameById.set(order.outletId, order.outletRef.name);
      }

      byOutlet = outletGroups.map((group) => ({
        outletId: group.outletId,
        outletName: outletNameById.get(group.outletId) ?? 'Unknown outlet',
        amount: this.repo.toApiNumber(group._sum?.total ?? ZERO),
        count: typeof group._count === 'object' && group._count ? (group._count._all ?? 0) : 0,
      }));
    } else {
      const byDayMap = new Map<
        string,
        { grossSales: Prisma.Decimal; netSales: Prisma.Decimal; count: number }
      >();

      for (const order of completedOrders) {
        const dateKey = asDateOnly(order.createdAt).toISOString().slice(0, 10);
        const current = byDayMap.get(dateKey) ?? {
          grossSales: ZERO,
          netSales: ZERO,
          count: 0,
        };

        byDayMap.set(dateKey, {
          grossSales: current.grossSales.plus(order.total),
          netSales: current.netSales.plus(order.total.minus(order.discountTotal)),
          count: current.count + 1,
        });
      }

      byDay = Array.from(byDayMap.entries()).map(([date, value]) => ({
        date,
        grossSales: this.repo.toApiNumber(value.grossSales),
        netSales: this.repo.toApiNumber(value.netSales),
        count: value.count,
      }));
    }

    const response: PosSalesReportResponse = {
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        grossSales: this.repo.toApiNumber(grossSales),
        netSales: this.repo.toApiNumber(netSales),
        discountTotal: this.repo.toApiNumber(discountTotal),
        taxTotal: this.repo.toApiNumber(taxTotal),
        serviceChargeTotal: this.repo.toApiNumber(serviceChargeTotal),
        orderCount: completedOrders.length,
        averageCheck:
          completedOrders.length > 0
            ? this.repo.toApiNumber(netSales.div(completedOrders.length))
            : 0,
      },
      byPaymentMethod: paymentGroups.map((group) => ({
        method: group.paymentMethod ?? 'UNPAID',
        amount: this.repo.toApiNumber(group._sum?.total ?? ZERO),
        count: typeof group._count === 'object' && group._count ? (group._count._all ?? 0) : 0,
      })),
    };

    if (byOutlet) {
      response.byOutlet = byOutlet;
    }

    if (byDay) {
      response.byDay = byDay;
    }

    return response;
  }

  /**
   * Executes the transactional core of room posting for a POS order.
   *
   * Applies idempotency checks, validates outlet posting permissions, resolves the
   * destination reservation and optional credit-stop override, creates a folio
   * charge when one does not already exist, updates order posting flags, emits
   * `pos.order.posted_to_room`, and reloads the updated order aggregate.
   *
   * @param tx - Active transaction client from the calling workflow.
   * @param organizationId - Organization UUID used for scoped lookups.
   * @param hotelId - Hotel UUID used for scoped lookups.
   * @param order - Order aggregate to post.
   * @param input - Posting options with destination room and `force` override.
   * @param actorId - User/system actor attributed on folio operations.
   * @returns Updated order aggregate after room posting.
   * @throws {NotFoundError} When outlet/reservation/order lookups fail.
   * @throws {PosRoomPostingNotAllowedError} When outlet policy blocks room posting.
   * @throws {BadRequestError} When no room number can be resolved.
   * @throws {PosCreditStopError} When destination guest is credit-stopped and `force` is false.
   * @remarks Complexity: O(1) application work with fixed transactional reads/writes.
   */
  private async postToRoomInternal(
    tx: Prisma.TransactionClient,
    organizationId: string,
    hotelId: string,
    order: POSOrderWithRelations,
    input: PostToRoomInput,
    actorId: string
  ): Promise<POSOrderWithRelations> {
    if (order.postedToRoom) {
      const existing = await this.repo.findOrderById(organizationId, hotelId, order.id, tx);
      if (!existing) {
        throw new NotFoundError(`POS order ${order.id} not found`);
      }
      return existing;
    }

    const outlet = await this.repo.findOutletById(organizationId, hotelId, order.outletId, tx);
    if (!outlet) {
      throw new NotFoundError(`POS outlet ${order.outletId} not found`);
    }

    if (!outlet.allowRoomPosting) {
      throw new PosRoomPostingNotAllowedError();
    }

    const roomNumber = input.roomNumber ?? order.roomNumber;
    if (!roomNumber) {
      throw new BadRequestError('roomNumber is required to post order to room');
    }

    const reservation = await this.repo.findReservationByRoom(
      organizationId,
      hotelId,
      roomNumber,
      tx
    );
    if (!reservation) {
      throw new NotFoundError(`No checked-in reservation found for room ${roomNumber}`);
    }

    if (reservation.guest?.isCreditStopped && !input.force) {
      throw new PosCreditStopError(
        reservation.guest.creditStopReason ||
          `Guest in room ${roomNumber} is currently blocked from receiving charges`
      );
    }

    const existingFolio = await tx.folioItem.findFirst({
      where: {
        reservationId: reservation.id,
        source: 'POS',
        sourceRef: order.id,
        isVoided: false,
      },
      select: { id: true },
      orderBy: { postedAt: 'desc' },
    });

    let folioItemId = existingFolio?.id ?? null;

    if (!folioItemId) {
      const chargeAmount = order.total.minus(order.taxTotal);
      const businessDate = asDateOnly(new Date());

      const folioItem = await tx.folioItem.create({
        data: {
          organizationId,
          hotelId,
          reservationId: reservation.id,
          itemType: 'POS_CHARGE',
          description: `POS order ${order.orderNumber} (${order.outlet})`,
          amount: chargeAmount,
          taxAmount: order.taxTotal,
          quantity: 1,
          unitPrice: order.total,
          revenueCode: 'POS',
          department: 'FNB',
          postedAt: new Date(),
          postedBy: actorId,
          isVoided: false,
          businessDate,
          source: 'POS',
          sourceRef: order.id,
        },
      });

      folioItemId = folioItem.id;
    }

    await tx.pOSOrder.update({
      where: { id: order.id },
      data: {
        postedToRoom: true,
        postedToFolioAt: new Date(),
        reservationId: reservation.id,
        roomNumber,
      },
    });

    await this.repo.createOutboxEvent(
      'pos.order.posted_to_room',
      'POS_ORDER',
      order.id,
      asJson({
        organizationId,
        hotelId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reservationId: reservation.id,
        roomNumber,
        folioItemId,
        postedAt: new Date().toISOString(),
      }),
      tx
    );

    const posted = await this.repo.findOrderById(organizationId, hotelId, order.id, tx);
    if (!posted) {
      throw new NotFoundError(`POS order ${order.id} not found after room posting`);
    }

    return posted;
  }

  /**
   * Calculates subtotal, tax total, and final total for resolved order items.
   *
   * @param items - Resolved line items containing extended prices and tax rates.
   * @param discountTotal - Discount amount subtracted from gross totals.
   * @param serviceCharge - Service charge amount added to gross totals.
   * @returns Decimal totals with non-negative final `total`.
   * @remarks Complexity: O(i) where `i` is item count across two reduction passes.
   */
  private computeTotalsFromItems(
    items: Array<{
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      taxRate: Prisma.Decimal;
    }>,
    discountTotal: Prisma.Decimal,
    serviceCharge: Prisma.Decimal
  ) {
    const subtotal = items.reduce((sum, item) => sum.plus(item.totalPrice), ZERO);
    const taxTotal = items.reduce(
      (sum, item) => sum.plus(item.totalPrice.mul(item.taxRate).div(100)),
      ZERO
    );

    const total = subtotal.plus(taxTotal).plus(serviceCharge).minus(discountTotal);

    return {
      subtotal,
      taxTotal,
      total: total.greaterThanOrEqualTo(0) ? total : ZERO,
    };
  }

  /**
   * Normalizes incoming item input into persistence-ready order lines.
   *
   * Menu-backed entries are validated for outlet ownership and lifecycle status,
   * while custom entries must provide explicit name and unit price. Each output
   * row includes computed line totals and tax rates for downstream aggregation.
   *
   * @param tx - Transaction client used for menu-item lookups.
   * @param organizationId - Organization UUID used for scoped validation.
   * @param hotelId - Hotel UUID used for scoped validation.
   * @param outletId - Outlet UUID that menu items must belong to.
   * @param items - Raw input items from create/add order workflows.
   * @returns Normalized item rows ready for `pOSOrderItem` inserts.
   * @throws {NotFoundError} When a referenced menu item is unavailable for the outlet.
   * @throws {BadRequestError} When custom items are missing `itemName` or `unitPrice`.
   * @remarks Complexity: O(i) with up to one scoped menu lookup per input item.
   */
  private async resolveItemsForWrite(
    tx: Prisma.TransactionClient,
    organizationId: string,
    hotelId: string,
    outletId: string,
    items: CreateOrderInput['items']
  ): Promise<
    Array<{
      itemName: string;
      itemCode: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      modifications: string | null;
      specialInstructions: string | null;
      taxRate: Prisma.Decimal;
    }>
  > {
    const result: Array<{
      itemName: string;
      itemCode: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      modifications: string | null;
      specialInstructions: string | null;
      taxRate: Prisma.Decimal;
    }> = [];

    for (const item of items) {
      if (item.menuItemId) {
        const menu = await this.repo.findMenuItemById(organizationId, hotelId, item.menuItemId, tx);
        if (!menu || menu.outletId !== outletId || !menu.isActive || menu.isDeleted) {
          throw new NotFoundError(`Menu item ${item.menuItemId} is not available for this outlet`);
        }

        const unitPrice = asDecimal(item.unitPrice ?? menu.unitPrice);
        const totalPrice = unitPrice.mul(item.quantity);

        result.push({
          itemName: menu.name,
          itemCode: menu.sku,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          modifications: item.modifications ?? null,
          specialInstructions: item.specialInstructions ?? null,
          taxRate: menu.taxRate,
        });

        continue;
      }

      const itemName = item.itemName?.trim();
      if (!itemName || item.unitPrice === undefined) {
        throw new BadRequestError('Custom items require itemName and unitPrice');
      }

      const unitPrice = asDecimal(item.unitPrice);
      const totalPrice = unitPrice.mul(item.quantity);

      result.push({
        itemName,
        itemCode: item.itemCode?.trim() ?? null,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        modifications: item.modifications ?? null,
        specialInstructions: item.specialInstructions ?? null,
        taxRate: ZERO,
      });
    }

    return result;
  }

  /**
   * Recomputes and persists order totals from active (non-voided) items.
   *
   * Reloads the order aggregate, fetches menu tax rates for coded lines, derives
   * subtotal/tax/total values, updates the order row, and reloads the final
   * aggregate so callers receive the authoritative persisted state.
   *
   * @param tx - Transaction client used for all reads and writes.
   * @param organizationId - Organization UUID used for scoped order lookup.
   * @param hotelId - Hotel UUID used for scoped order lookup.
   * @param orderId - POS order UUID to recompute.
   * @returns Updated order aggregate with recalculated monetary totals.
   * @throws {NotFoundError} When the order cannot be found before or after update.
   * @remarks Complexity: O(n + m) where `n` is active item count and `m` is matched menu rows.
   */
  private async recomputeOrderTotals(
    tx: Prisma.TransactionClient,
    organizationId: string,
    hotelId: string,
    orderId: string
  ): Promise<POSOrderWithRelations> {
    const order = await this.repo.findOrderById(organizationId, hotelId, orderId, tx);
    if (!order) {
      throw new NotFoundError(`POS order ${orderId} not found`);
    }

    const activeItems = order.items.filter((item) => !item.isVoided);
    const itemCodes = activeItems
      .map((item) => item.itemCode)
      .filter((value): value is string => Boolean(value));

    const menuItems = itemCodes.length
      ? await tx.pOSMenuItem.findMany({
          where: {
            hotelId,
            sku: {
              in: itemCodes,
            },
          },
          select: {
            sku: true,
            taxRate: true,
          },
        })
      : [];

    const taxRateByCode = new Map(menuItems.map((item) => [item.sku, item.taxRate]));

    const subtotal = activeItems.reduce((sum, item) => sum.plus(item.totalPrice), ZERO);

    const taxTotal = activeItems.reduce((sum, item) => {
      const taxRate = item.itemCode ? (taxRateByCode.get(item.itemCode) ?? ZERO) : ZERO;
      return sum.plus(item.totalPrice.mul(taxRate).div(100));
    }, ZERO);

    const total = subtotal.plus(taxTotal).plus(order.serviceCharge).minus(order.discountTotal);

    await tx.pOSOrder.update({
      where: { id: order.id },
      data: {
        subtotal,
        taxTotal,
        total: total.greaterThanOrEqualTo(0) ? total : ZERO,
      },
    });

    const updated = await this.repo.findOrderById(organizationId, hotelId, order.id, tx);
    if (!updated) {
      throw new NotFoundError(`POS order ${order.id} not found after totals recompute`);
    }

    return updated;
  }

  /**
   * Enforces that mutable item operations run only on open orders.
   *
   * @param order - Order aggregate to validate.
   * @returns Nothing when the order is open.
   * @throws {PosOrderNotOpenError} When `order.status` is not `'OPEN'`.
   */
  private assertOrderOpen(order: POSOrderWithRelations): void {
    if (order.status !== 'OPEN') {
      throw new PosOrderNotOpenError(order.status);
    }
  }

  /**
   * Generates a unique POS order number with bounded collision retries.
   *
   * Builds a UTC date prefix and retries random 4-digit suffixes up to ten times;
   * if collisions persist, falls back to a timestamp-derived suffix.
   *
   * @param tx - Transaction client used to check order-number uniqueness.
   * @returns Unique order number in `POS-YYYYMMDD-XXXX` format.
   * @remarks Complexity: O(a) uniqueness lookups where `a <= 10`.
   */
  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const prefix = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}`;

    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
      const orderNumber = `POS-${prefix}-${suffix}`;

      const existing = await tx.pOSOrder.findUnique({
        where: { orderNumber },
        select: { id: true },
      });

      if (!existing) {
        return orderNumber;
      }
    }

    return `POS-${prefix}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Parses an `HH:mm[:ss]` string into a UTC time-only Date value.
   *
   * Empty inputs map to `null`. Non-empty inputs are range-validated for 24-hour
   * clock semantics and anchored to `1970-01-01` UTC for storage consistency.
   *
   * @param value - Optional time text.
   * @returns Parsed UTC time value or `null` when input is empty.
   * @throws {BadRequestError} When the value is not a valid 24-hour time string.
   */
  private parseTime(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const [hoursRaw, minutesRaw, secondsRaw] = value.split(':');
    const hours = Number.parseInt(hoursRaw || '0', 10);
    const minutes = Number.parseInt(minutesRaw || '0', 10);
    const seconds = Number.parseInt(secondsRaw || '0', 10);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      throw new BadRequestError(`Invalid time format: ${value}`);
    }

    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  }

  /**
   * Validates hotel scope and translates repository sentinel errors.
   *
   * @param organizationId - Organization UUID used for scope validation.
   * @param hotelId - Hotel UUID to validate.
   * @returns Resolves when hotel scope is valid.
   * @throws {NotFoundError} When the hotel cannot be found in organization scope.
   */
  private async assertHotelScope(organizationId: string, hotelId: string): Promise<void> {
    try {
      await this.repo.ensureHotelScope(organizationId, hotelId);
    } catch (error) {
      if (error instanceof Error && error.message === 'HOTEL_NOT_FOUND') {
        throw new NotFoundError(`Hotel ${hotelId} not found`);
      }

      throw error;
    }
  }
}

export const posService = new PosService();
