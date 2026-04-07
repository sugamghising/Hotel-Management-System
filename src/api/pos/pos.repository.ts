import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  ListMenuItemsQueryInput,
  ListOrdersQueryInput,
  ListOutletsQueryInput,
} from './pos.schema';

const POS_ORDER_INCLUDE = {
  outletRef: {
    select: {
      id: true,
      code: true,
      name: true,
      allowRoomPosting: true,
      allowDirectBill: true,
      isActive: true,
    },
  },
  items: {
    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.POSOrderInclude;

export type POSOrderWithRelations = Prisma.POSOrderGetPayload<{
  include: typeof POS_ORDER_INCLUDE;
}>;

export class PosRepository {
  /**
   * Verifies that a hotel exists within the provided organization scope.
   *
   * Executes a scoped lookup against non-deleted hotels and raises a sentinel
   * error used by the service layer to translate scope failures into API errors.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID to validate.
   * @returns Resolves when the hotel is in scope.
   * @throws {Error} Throws `HOTEL_NOT_FOUND` when the hotel does not exist in scope.
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
   * Lists POS outlets for a hotel with optional active-state filtering.
   *
   * Builds a dynamic Prisma `where` clause from query filters, then runs list and
   * count queries in one transaction to keep page data and totals consistent.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param query - Pagination and optional active filter input.
   * @returns Paginated outlet rows and total matching outlet count.
   * @remarks Complexity: O(p) mapping for page size `p` plus two DB operations (`findMany` + `count`).
   */
  async listOutlets(
    organizationId: string,
    hotelId: string,
    query: ListOutletsQueryInput
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const where: Prisma.POSOutletWhereInput = {
      organizationId,
      hotelId,
      ...(query.active !== undefined ? { isActive: query.active } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.pOSOutlet.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.pOSOutlet.count({ where }),
    ]);

    return {
      items: items as Array<Record<string, unknown>>,
      total,
    };
  }

  /**
   * Finds a single POS outlet in organization and hotel scope.
   *
   * Uses the provided transaction client when available so callers can compose
   * this lookup into broader transactional workflows.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param outletId - Outlet UUID to load.
   * @param tx - Optional transaction client for transactional reads.
   * @returns The matching outlet row, or `null` when not found.
   */
  async findOutletById(
    organizationId: string,
    hotelId: string,
    outletId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.pOSOutlet.findFirst({
      where: {
        id: outletId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Lists menu items with outlet/category/search/activity lifecycle filters.
   *
   * Compiles optional filters into one `where` clause (including SKU/name search),
   * then returns a paginated list and total count from a transactional read pair.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param query - Pagination and optional menu-item filters.
   * @returns Paginated menu item rows and total matching count.
   * @remarks Complexity: O(p) for page mapping and O(1) application work with two DB queries.
   */
  async listMenuItems(
    organizationId: string,
    hotelId: string,
    query: ListMenuItemsQueryInput
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const where: Prisma.POSMenuItemWhereInput = {
      organizationId,
      hotelId,
      ...(query.outletId ? { outletId: query.outletId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.active !== undefined ? { isActive: query.active } : {}),
      ...(query.includeDeleted ? {} : { isDeleted: false }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.pOSMenuItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.pOSMenuItem.count({ where }),
    ]);

    return {
      items: items as Array<Record<string, unknown>>,
      total,
    };
  }

  /**
   * Finds a menu item by ID within organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param menuItemId - Menu item UUID to load.
   * @param tx - Optional transaction client for transactional reads.
   * @returns The menu item when found, otherwise `null`.
   */
  async findMenuItemById(
    organizationId: string,
    hotelId: string,
    menuItemId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.pOSMenuItem.findFirst({
      where: {
        id: menuItemId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Finds a POS order and eagerly loads outlet metadata and order items.
   *
   * Uses a shared include definition so all service flows receive a stable order
   * shape with deterministic item ordering.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param orderId - Order UUID to load.
   * @param tx - Optional transaction client for transactional reads.
   * @returns Full order aggregate with outlet and item relations, or `null`.
   */
  async findOrderById(
    organizationId: string,
    hotelId: string,
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<POSOrderWithRelations | null> {
    const db = tx ?? prisma;

    return db.pOSOrder.findFirst({
      where: {
        id: orderId,
        organizationId,
        hotelId,
      },
      include: POS_ORDER_INCLUDE,
    });
  }

  /**
   * Lists POS orders with status, outlet, room, and date-range filters.
   *
   * Materializes rich order payloads (with relations) and total count using a
   * transactional query pair so pagination metadata matches returned rows.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param query - Order list filters and pagination input.
   * @returns Paginated order aggregates plus total count.
   * @remarks Complexity: O(p + i) where `p` is page size and `i` is total included order items in the page.
   */
  async listOrders(
    organizationId: string,
    hotelId: string,
    query: ListOrdersQueryInput
  ): Promise<{ items: POSOrderWithRelations[]; total: number }> {
    const where: Prisma.POSOrderWhereInput = {
      organizationId,
      hotelId,
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.outletId ? { outletId: query.outletId } : {}),
      ...(query.roomNumber ? { roomNumber: query.roomNumber } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.pOSOrder.findMany({
        where,
        include: POS_ORDER_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.pOSOrder.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Finds a specific order item by its ID under a parent order.
   *
   * @param orderId - Parent order UUID.
   * @param itemId - Order item UUID.
   * @param tx - Optional transaction client for transactional reads.
   * @returns Matching order item, or `null` when not found.
   */
  async findOrderItem(orderId: string, itemId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;

    return db.pOSOrderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });
  }

  /**
   * Finds the active checked-in reservation currently occupying a room.
   *
   * Constrains by organization/hotel/status and room-assignment states, then
   * returns guest credit-stop fields used by POS room-posting validations.
   *
   * @param organizationId - Organization UUID used for scoping.
   * @param hotelId - Hotel UUID used for scoping.
   * @param roomNumber - Room number to resolve to an active reservation.
   * @param tx - Optional transaction client for transactional reads.
   * @returns The latest matching reservation with guest credit flags, or `null`.
   */
  async findReservationByRoom(
    organizationId: string,
    hotelId: string,
    roomNumber: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.reservation.findFirst({
      where: {
        organizationId,
        hotelId,
        status: 'CHECKED_IN',
        deletedAt: null,
        rooms: {
          some: {
            status: {
              in: ['ASSIGNED', 'OCCUPIED'],
            },
            room: {
              roomNumber,
              deletedAt: null,
            },
          },
        },
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isCreditStopped: true,
            creditStopReason: true,
          },
        },
      },
      orderBy: [{ checkInDate: 'desc' }],
    });
  }

  /**
   * Finds the latest captured direct-bill payment associated with an order.
   *
   * Uses reservation scope plus note text matching on order ID to locate the
   * source payment so void flows can chain a refund via `parentPaymentId`.
   *
   * @param reservationId - Reservation UUID holding the direct-bill payment.
   * @param orderId - POS order UUID embedded in payment notes.
   * @param tx - Optional transaction client for transactional reads.
   * @returns The most recent matching non-refund direct-bill payment, or `null`.
   */
  async findDirectBillPaymentByOrder(
    reservationId: string,
    orderId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.payment.findFirst({
      where: {
        reservationId,
        method: 'DIRECT_BILL',
        isRefund: false,
        notes: {
          contains: orderId,
          mode: 'insensitive',
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Persists an outbox event for asynchronous POS integrations.
   *
   * @param eventType - Event name emitted by the POS workflow.
   * @param aggregateType - Aggregate category, such as `POS_ORDER`.
   * @param aggregateId - Aggregate identifier linked to the event.
   * @param payload - JSON payload stored with the event.
   * @param tx - Optional transaction client to keep event write atomic with business writes.
   * @returns The created outbox event row.
   */
  async createOutboxEvent(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;

    return db.outboxEvent.create({
      data: {
        eventType,
        aggregateType,
        aggregateId,
        payload,
      },
    });
  }

  /**
   * Executes callback logic inside a Prisma transaction boundary.
   *
   * @param fn - Callback that receives a transaction client.
   * @returns Result returned by the callback after transaction commit.
   */
  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => fn(tx));
  }

  /**
   * Converts Prisma Decimal-like values to JSON-safe numbers for API responses.
   *
   * @param value - Decimal-compatible value from persistence models.
   * @returns Numeric representation suitable for REST payloads.
   */
  toApiNumber(value: Prisma.Decimal | number): number {
    return Number.parseFloat(value.toString());
  }

  /**
   * Maps a persisted POS order aggregate into the public API contract shape.
   *
   * Converts all Decimal money fields to numbers and flattens outlet metadata
   * plus nested order items for stable transport serialization.
   *
   * @param order - Persisted order aggregate with included relations.
   * @returns API-safe order object with numeric monetary fields.
   * @remarks Complexity: O(i) where `i` is `order.items.length` due item mapping.
   */
  toApiOrder(order: POSOrderWithRelations) {
    return {
      id: order.id,
      organizationId: order.organizationId,
      hotelId: order.hotelId,
      outletId: order.outletId,
      reservationId: order.reservationId,
      orderNumber: order.orderNumber,
      outlet: order.outlet,
      tableNumber: order.tableNumber,
      roomNumber: order.roomNumber,
      status: order.status,
      subtotal: this.toApiNumber(order.subtotal),
      taxTotal: this.toApiNumber(order.taxTotal),
      discountTotal: this.toApiNumber(order.discountTotal),
      serviceCharge: this.toApiNumber(order.serviceCharge),
      total: this.toApiNumber(order.total),
      paymentMethod: order.paymentMethod,
      paidAmount: this.toApiNumber(order.paidAmount),
      postedToRoom: order.postedToRoom,
      postedToFolioAt: order.postedToFolioAt,
      serverId: order.serverId,
      createdAt: order.createdAt,
      closedAt: order.closedAt,
      outletMeta: {
        id: order.outletRef.id,
        code: order.outletRef.code,
        name: order.outletRef.name,
      },
      items: order.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        itemName: item.itemName,
        itemCode: item.itemCode,
        quantity: item.quantity,
        unitPrice: this.toApiNumber(item.unitPrice),
        totalPrice: this.toApiNumber(item.totalPrice),
        modifications: item.modifications,
        specialInstructions: item.specialInstructions,
        isVoided: item.isVoided,
        voidReason: item.voidReason,
      })),
    };
  }

  /**
   * Builds pagination metadata for paginated API responses.
   *
   * @param total - Total number of records matching current filters.
   * @param page - Current 1-based page index.
   * @param limit - Maximum rows requested per page.
   * @returns Pagination metadata including derived `totalPages`.
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

export type PosRepositoryType = PosRepository;
export const posRepository = new PosRepository();
