// src/api/folio/folio.repository.ts

import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  FolioItem,
  FolioItemType,
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentStatus,
} from './folio.types';

export type FolioItemWhereInput = Prisma.FolioItemWhereInput;
export type FolioItemCreateInput = Prisma.FolioItemCreateInput;
export type PaymentCreateInput = Prisma.PaymentCreateInput;
export type InvoiceCreateInput = Prisma.InvoiceCreateInput;

// ============ Type Mapping Functions ============

function mapFolioItem(item: unknown): FolioItem {
  const record = item as unknown as FolioItem;
  return {
    ...record,
    amount: Number.parseFloat((record.amount as unknown as Prisma.Decimal).toString()),
    taxAmount: Number.parseFloat((record.taxAmount as unknown as Prisma.Decimal).toString()),
    unitPrice: Number.parseFloat((record.unitPrice as unknown as Prisma.Decimal).toString()),
  };
}

function mapPayment(payment: unknown): Payment {
  const record = payment as unknown as Payment;
  return {
    ...record,
    amount: Number.parseFloat((record.amount as unknown as Prisma.Decimal).toString()),
  };
}

function mapInvoice(invoice: unknown): Invoice {
  const record = invoice as unknown as Invoice;
  return {
    ...record,
    subtotal: Number.parseFloat((record.subtotal as unknown as Prisma.Decimal).toString()),
    taxTotal: Number.parseFloat((record.taxTotal as unknown as Prisma.Decimal).toString()),
    total: Number.parseFloat((record.total as unknown as Prisma.Decimal).toString()),
    amountPaid: Number.parseFloat((record.amountPaid as unknown as Prisma.Decimal).toString()),
  };
}

export class FolioRepository {
  // ============================================================================
  // FOLIO ITEMS (CHARGES)
  // ============================================================================

  async findFolioItemById(id: string): Promise<FolioItem | null> {
    const item = await prisma.folioItem.findUnique({
      where: { id },
    });
    return item ? mapFolioItem(item) : null;
  }

  async findFolioItemsByReservation(
    reservationId: string,
    filters?: {
      businessDateFrom?: Date;
      businessDateTo?: Date;
      itemTypes?: FolioItemType[];
      includeVoided?: boolean;
    }
  ): Promise<FolioItem[]> {
    const where: Prisma.FolioItemWhereInput = {
      reservationId,
    };

    if (!filters?.includeVoided) {
      where.isVoided = false;
    }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters?.businessDateFrom) {
      dateFilter.gte = filters.businessDateFrom;
    }
    if (filters?.businessDateTo) {
      dateFilter.lte = filters.businessDateTo;
    }
    if (Object.keys(dateFilter).length > 0) {
      where.businessDate = dateFilter;
    }

    if (filters?.itemTypes?.length) {
      where.itemType = { in: filters.itemTypes };
    }

    const items = await prisma.folioItem.findMany({
      where,
      orderBy: { postedAt: 'desc' },
    });

    return items.map(mapFolioItem);
  }

  async createFolioItem(data: FolioItemCreateInput): Promise<FolioItem> {
    const item = await prisma.folioItem.create({ data });
    return mapFolioItem(item);
  }

  async voidFolioItem(id: string, voidedBy: string, reason: string): Promise<FolioItem> {
    const item = await prisma.folioItem.update({
      where: { id },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidedBy,
        voidReason: reason,
      },
    });
    return mapFolioItem(item);
  }

  async adjustFolioItem(
    id: string,
    newAmount: number,
    reason: string,
    adjustedBy: string
  ): Promise<FolioItem> {
    // Create adjustment entry rather than modifying original
    const original = await prisma.folioItem.findUnique({ where: { id } });
    if (!original) throw new Error('Folio item not found');

    const adjustmentAmount = newAmount - Number.parseFloat(original.amount.toString());

    return prisma.$transaction(async (tx) => {
      // Create adjustment entry
      const adjustment = await tx.folioItem.create({
        data: {
          organizationId: original.organizationId,
          hotelId: original.hotelId,
          reservationId: original.reservationId,
          itemType: 'ADJUSTMENT',
          description: `Adjustment to ${original.description}: ${reason}`,
          amount: adjustmentAmount,
          taxAmount: 0,
          quantity: 1,
          unitPrice: adjustmentAmount,
          revenueCode: original.revenueCode,
          department: original.department,
          postedAt: new Date(),
          postedBy: adjustedBy,
          businessDate: new Date(),
          isVoided: false,
        },
      });

      return mapFolioItem(adjustment);
    });
  }

  async getFolioSummary(reservationId: string): Promise<{
    chargesTotal: number;
    paymentsTotal: number;
    balance: number;
  }> {
    const [charges, payments] = await Promise.all([
      prisma.folioItem.aggregate({
        where: {
          reservationId,
          isVoided: false,
        },
        _sum: {
          amount: true,
          taxAmount: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          reservationId,
          status: { in: ['CAPTURED', 'AUTHORIZED'] },
          isRefund: false,
        },
        _sum: { amount: true },
      }),
    ]);

    const chargesTotal =
      Number.parseFloat(charges._sum.amount?.toString() || '0') +
      Number.parseFloat(charges._sum.taxAmount?.toString() || '0');
    const paymentsTotal = Number.parseFloat(payments._sum.amount?.toString() || '0');

    return {
      chargesTotal,
      paymentsTotal,
      balance: chargesTotal - paymentsTotal,
    };
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async findPaymentById(id: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
    });
    return payment ? mapPayment(payment) : null;
  }

  async findPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(mapPayment);
  }

  async createPayment(data: PaymentCreateInput): Promise<Payment> {
    const payment = await prisma.payment.create({ data });
    return mapPayment(payment);
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    transactionId?: string,
    authCode?: string
  ): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(transactionId !== undefined ? { transactionId } : {}),
        ...(authCode !== undefined ? { authCode } : {}),
        processedAt: new Date(),
      },
    });
    return mapPayment(payment);
  }

  async voidPayment(id: string): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { id },
      data: { status: 'VOIDED' as PaymentStatus },
    });
    return mapPayment(payment);
  }

  async createRefund(
    parentPaymentId: string,
    data: Omit<PaymentCreateInput, 'parentPaymentId' | 'isRefund'>
  ): Promise<Payment> {
    const payment = await prisma.payment.create({
      data: {
        ...data,
        parentPaymentId,
        isRefund: true,
      },
    });
    return mapPayment(payment);
  }

  async getPaymentMethodsSummary(reservationId: string): Promise<Record<string, number>> {
    const results = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        reservationId,
        status: { in: ['CAPTURED', 'AUTHORIZED'] },
        isRefund: false,
      },
      _sum: { amount: true },
    });

    return results.reduce(
      (acc, curr) => {
        acc[curr.method] = Number.parseFloat(curr._sum.amount?.toString() || '0');
        return acc;
      },
      {} as Record<string, number>
    );
  }

  // ============================================================================
  // INVOICES
  // ============================================================================

  async findInvoiceById(id: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        reservation: true,
      },
    });

    if (!invoice) {
      return null;
    }

    return mapInvoice(invoice);
  }

  async findInvoicesByReservation(reservationId: string): Promise<Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { reservationId },
      orderBy: { issueDate: 'desc' },
    });
    return invoices.map(mapInvoice);
  }

  async createInvoice(data: InvoiceCreateInput): Promise<Invoice> {
    const invoice = await prisma.invoice.create({ data });
    return mapInvoice(invoice);
  }

  async updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    paidAmount?: number
  ): Promise<Invoice> {
    const updateData: Prisma.InvoiceUpdateInput = { status };

    if (paidAmount !== undefined) {
      updateData.amountPaid = paidAmount;
    }

    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });
    return mapInvoice(invoice);
  }

  async markInvoiceSent(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { sentAt: new Date() },
    });
    return mapInvoice(invoice);
  }

  async voidInvoice(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' as InvoiceStatus },
    });
    return mapInvoice(invoice);
  }

  async generateInvoiceNumber(hotelId: string): Promise<string> {
    const date = new Date();
    const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

    return prisma.$transaction(
      async (tx) => {
        const count = await tx.invoice.count({
          where: {
            hotelId,
            invoiceNumber: { startsWith: prefix },
          },
        });

        return `${prefix}-${String(count + 1).padStart(5, '0')}`;
      },
      { isolationLevel: 'Serializable' }
    );
  }

  // ============================================================================
  // TRANSFERS
  // ============================================================================

  async transferCharges(
    chargeIds: string[],
    fromReservationId: string,
    toReservationId: string,
    transferredBy: string,
    reason: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Get charges to transfer, scoped to the source reservation
      const charges = await tx.folioItem.findMany({
        where: {
          id: { in: chargeIds },
          reservationId: fromReservationId,
        },
      });

      // Ensure all requested charges belong to the source reservation
      if (charges.length !== chargeIds.length) {
        throw new Error('One or more charges were not found for the source reservation.');
      }

      // Void original charges
      await tx.folioItem.updateMany({
        where: {
          id: { in: chargeIds },
          reservationId: fromReservationId,
        },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedBy: transferredBy,
          voidReason: `Transferred to ${toReservationId}: ${reason}`,
        },
      });

      // Create new charges on target reservation
      for (const charge of charges) {
        await tx.folioItem.create({
          data: {
            organizationId: charge.organizationId,
            hotelId: charge.hotelId,
            reservationId: toReservationId,
            itemType: charge.itemType,
            description: `${charge.description} (Transferred from ${fromReservationId})`,
            amount: charge.amount,
            taxAmount: charge.taxAmount,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            revenueCode: charge.revenueCode,
            department: charge.department,
            postedAt: new Date(),
            postedBy: transferredBy,
            businessDate: new Date(),
            isVoided: false,
            source: 'TRANSFER',
            sourceRef: charge.id,
          },
        });
      }
    });
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async postRoomChargesForNightAudit(
    hotelId: string,
    businessDate: Date,
    postedBy: string,
    sourceRef?: string
  ): Promise<{ posted: number; totalAmount: number }> {
    // Find all in-house reservations
    const inHouseReservations = await prisma.reservation.findMany({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        checkOutDate: { gt: businessDate },
        deletedAt: null,
      },
      include: {
        ratePlan: true,
        rooms: {
          include: {
            roomType: true,
          },
        },
      },
    });

    let posted = 0;
    let totalAmount = 0;

    // Pre-fetch all existing NIGHT_AUDIT room charges for this sourceRef in one query
    // to avoid an N+1 pattern inside the transaction loop.
    const alreadyPostedReservationIds = sourceRef
      ? new Set(
          (
            await prisma.folioItem.findMany({
              where: {
                hotelId,
                itemType: 'ROOM_CHARGE',
                businessDate,
                source: 'NIGHT_AUDIT',
                sourceRef,
                isVoided: false,
              },
              select: { reservationId: true },
            })
          ).map((item) => item.reservationId)
        )
      : null;

    await prisma.$transaction(async (tx) => {
      for (const reservation of inHouseReservations) {
        const roomRate = Number.parseFloat(reservation.averageRate.toString());

        if (roomRate > 0) {
          if (alreadyPostedReservationIds?.has(reservation.id)) {
            continue;
          }

          await tx.folioItem.create({
            data: {
              organizationId: reservation.organizationId,
              hotelId,
              reservationId: reservation.id,
              itemType: 'ROOM_CHARGE',
              description: `Room Charge - ${reservation.rooms[0]?.roomType?.name || 'Room'} - Night of ${businessDate.toISOString().split('T')[0]}`,
              amount: roomRate,
              taxAmount: 0, // Calculate based on hotel tax rules
              quantity: 1,
              unitPrice: roomRate,
              revenueCode: 'ROOM',
              department: 'ROOMS',
              postedAt: new Date(),
              postedBy,
              businessDate,
              isVoided: false,
              source: 'NIGHT_AUDIT',
              sourceRef: sourceRef ?? null,
            },
          });

          posted++;
          totalAmount += roomRate;
        }
      }
    });

    return { posted, totalAmount };
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  async getRevenueByDepartment(
    hotelId: string,
    businessDateFrom: Date,
    businessDateTo: Date
  ): Promise<Array<{ department: string; revenue: number; tax: number }>> {
    const results = await prisma.folioItem.groupBy({
      by: ['department'],
      where: {
        hotelId,
        businessDate: { gte: businessDateFrom, lte: businessDateTo },
        isVoided: false,
        itemType: { notIn: ['PAYMENT', 'REFUND'] },
      },
      _sum: {
        amount: true,
        taxAmount: true,
      },
    });

    return results.map((r) => ({
      department: r.department,
      revenue: Number.parseFloat(r._sum.amount?.toString() || '0'),
      tax: Number.parseFloat(r._sum.taxAmount?.toString() || '0'),
    }));
  }

  async getDailyRevenue(
    hotelId: string,
    businessDate: Date
  ): Promise<{
    roomRevenue: number;
    otherRevenue: number;
    taxTotal: number;
    payments: number;
  }> {
    const [revenue, payments] = await Promise.all([
      prisma.folioItem.aggregate({
        where: {
          hotelId,
          businessDate,
          isVoided: false,
        },
        _sum: {
          amount: true,
          taxAmount: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          hotelId,
          createdAt: {
            gte: businessDate,
            lt: new Date(businessDate.getTime() + 24 * 60 * 60 * 1000),
          },
          status: { in: ['CAPTURED'] },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalAmount = Number.parseFloat(revenue._sum.amount?.toString() || '0');

    return {
      roomRevenue: totalAmount, // Simplified - would filter by department
      otherRevenue: 0,
      taxTotal: Number.parseFloat(revenue._sum.taxAmount?.toString() || '0'),
      payments: Number.parseFloat(payments._sum.amount?.toString() || '0'),
    };
  }
}

export const folioRepository = new FolioRepository();
