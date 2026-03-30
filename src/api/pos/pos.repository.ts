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

  async findOrderItem(orderId: string, itemId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;

    return db.pOSOrderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });
  }

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

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => fn(tx));
  }

  toApiNumber(value: Prisma.Decimal | number): number {
    return Number.parseFloat(value.toString());
  }

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
