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

/**
 * Converts a Prisma folio item record to API-safe numeric fields.
 *
 * @param item - Raw folio item record that may contain Decimal values.
 * @returns A folio item with decimal monetary fields converted to JavaScript numbers.
 */
function mapFolioItem(item: unknown): FolioItem {
  const record = item as unknown as FolioItem;
  return {
    ...record,
    amount: Number.parseFloat((record.amount as unknown as Prisma.Decimal).toString()),
    taxAmount: Number.parseFloat((record.taxAmount as unknown as Prisma.Decimal).toString()),
    unitPrice: Number.parseFloat((record.unitPrice as unknown as Prisma.Decimal).toString()),
  };
}

/**
 * Converts a Prisma payment record to API-safe numeric fields.
 *
 * @param payment - Raw payment record that may contain Decimal values.
 * @returns A payment with `amount` normalized to a JavaScript number.
 */
function mapPayment(payment: unknown): Payment {
  const record = payment as unknown as Payment;
  return {
    ...record,
    amount: Number.parseFloat((record.amount as unknown as Prisma.Decimal).toString()),
  };
}

/**
 * Converts a Prisma invoice record to API-safe numeric fields.
 *
 * @param invoice - Raw invoice record that may contain Decimal values.
 * @returns An invoice with monetary totals normalized to JavaScript numbers.
 */
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

  /**
   * Finds a folio item by identifier.
   *
   * @param id - Folio item UUID.
   * @returns The mapped folio item or `null` if no item matches.
   */
  async findFolioItemById(id: string): Promise<FolioItem | null> {
    const item = await prisma.folioItem.findUnique({
      where: { id },
    });
    return item ? mapFolioItem(item) : null;
  }

  /**
   * Lists folio items for a reservation with optional date/type/void filters.
   *
   * @param reservationId - Reservation UUID whose folio lines are requested.
   * @param filters - Optional business-date, item-type, and void-inclusion filters.
   * @returns Matching folio items ordered by `postedAt` descending.
   * @remarks Complexity: O(n) in number of matching folio items for mapping.
   */
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

  /**
   * Creates a new folio item record.
   *
   * @param data - Prisma create input for a folio charge/adjustment/payment line.
   * @returns The created folio item with mapped numeric values.
   */
  async createFolioItem(data: FolioItemCreateInput): Promise<FolioItem> {
    const item = await prisma.folioItem.create({ data });
    return mapFolioItem(item);
  }

  /**
   * Marks a folio item as voided with audit metadata.
   *
   * @param id - Folio item UUID to void.
   * @param voidedBy - User ID performing the void action.
   * @param reason - Business reason persisted with the void audit trail.
   * @returns The updated folio item in voided state.
   */
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

  /**
   * Creates an adjustment folio line that offsets an existing folio item amount.
   *
   * @param id - Original folio item UUID being adjusted.
   * @param newAmount - Target amount used to compute adjustment delta.
   * @param reason - Adjustment reason appended to generated description.
   * @param adjustedBy - User ID recorded as the posting actor.
   * @returns The newly created adjustment folio line.
   * @throws {Error} When the original folio item cannot be found.
   * @remarks Complexity: O(1) with one lookup and one transactional insert.
   */
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

  /**
   * Aggregates reservation-level folio totals for charges, payments, and balance.
   *
   * @param reservationId - Reservation UUID used for aggregation.
   * @returns Charge totals, payment totals, and computed balance.
   * @remarks Complexity: O(1) application work with 2 aggregate DB queries.
   */
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

  /**
   * Finds a payment by identifier.
   *
   * @param id - Payment UUID.
   * @returns The mapped payment or `null` when not found.
   */
  async findPaymentById(id: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
    });
    return payment ? mapPayment(payment) : null;
  }

  /**
   * Lists payments recorded for a reservation.
   *
   * @param reservationId - Reservation UUID whose payments are requested.
   * @returns Payments ordered by creation timestamp descending.
   */
  async findPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(mapPayment);
  }

  /**
   * Creates a payment record.
   *
   * @param data - Prisma payment create payload.
   * @returns The created payment mapped to API-friendly numeric fields.
   */
  async createPayment(data: PaymentCreateInput): Promise<Payment> {
    const payment = await prisma.payment.create({ data });
    return mapPayment(payment);
  }

  /**
   * Updates payment status and optional gateway identifiers.
   *
   * @param id - Payment UUID to update.
   * @param status - New payment status value.
   * @param transactionId - Optional external transaction identifier.
   * @param authCode - Optional authorization code from payment provider.
   * @returns The updated payment record.
   */
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

  /**
   * Voids a payment by setting status to `'VOIDED'`.
   *
   * @param id - Payment UUID to void.
   * @returns The updated payment record in voided status.
   */
  async voidPayment(id: string): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { id },
      data: { status: 'VOIDED' as PaymentStatus },
    });
    return mapPayment(payment);
  }

  /**
   * Creates a refund payment linked to an existing parent payment.
   *
   * @param parentPaymentId - Parent payment UUID being refunded.
   * @param data - Refund payload excluding `parentPaymentId` and `isRefund`.
   * @returns The created refund payment.
   */
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

  /**
   * Aggregates captured/authorized payments by payment method for a reservation.
   *
   * @param reservationId - Reservation UUID used for grouping.
   * @returns A method-to-amount map with decimal sums normalized to numbers.
   * @remarks Complexity: O(m) in number of grouped payment methods.
   */
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

  /**
   * Finds an invoice by identifier including reservation relation.
   *
   * @param id - Invoice UUID.
   * @returns The mapped invoice or `null` when not found.
   */
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

  /**
   * Lists invoices for a reservation ordered by issue date descending.
   *
   * @param reservationId - Reservation UUID whose invoices are requested.
   * @returns Reservation invoices mapped to API-friendly numeric fields.
   */
  async findInvoicesByReservation(reservationId: string): Promise<Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { reservationId },
      orderBy: { issueDate: 'desc' },
    });
    return invoices.map(mapInvoice);
  }

  /**
   * Creates a new invoice.
   *
   * @param data - Prisma invoice create payload.
   * @returns The created invoice mapped to API-friendly numeric fields.
   */
  async createInvoice(data: InvoiceCreateInput): Promise<Invoice> {
    const invoice = await prisma.invoice.create({ data });
    return mapInvoice(invoice);
  }

  /**
   * Updates invoice status and optional paid amount metadata.
   *
   * @param id - Invoice UUID to update.
   * @param status - Target invoice status.
   * @param paidAmount - Optional cumulative amount paid.
   * @returns The updated invoice record.
   */
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

  /**
   * Marks an invoice as sent by setting `sentAt` to current time.
   *
   * @param id - Invoice UUID to mark as sent.
   * @returns The updated invoice record.
   */
  async markInvoiceSent(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { sentAt: new Date() },
    });
    return mapInvoice(invoice);
  }

  /**
   * Voids an invoice by setting status to `'VOID'`.
   *
   * @param id - Invoice UUID to void.
   * @returns The updated invoice record.
   */
  async voidInvoice(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' as InvoiceStatus },
    });
    return mapInvoice(invoice);
  }

  /**
   * Generates the next invoice number for a hotel and month prefix.
   *
   * @param hotelId - Hotel UUID whose invoice sequence is generated.
   * @returns An invoice number formatted as `INV-YYYYMM-#####`.
   * @remarks Complexity: O(1) with one transactional count query.
   */
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

  /**
   * Transfers selected charges between reservations by voiding originals and cloning lines.
   *
   * @param chargeIds - Folio item UUIDs requested for transfer.
   * @param fromReservationId - Source reservation UUID.
   * @param toReservationId - Target reservation UUID.
   * @param transferredBy - User ID recorded in void/create audit fields.
   * @param reason - Business reason stored on voided source charges.
   * @returns Resolves when transfer transaction completes.
   * @throws {Error} When one or more requested charges do not belong to source reservation.
   * @remarks Complexity: O(n) in number of transferred charges.
   */
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

  /**
   * Posts nightly room charges for in-house reservations during night audit.
   *
   * The method loads in-house reservations, optionally skips already-posted reservations
   * for the same `sourceRef`, then creates one `ROOM_CHARGE` folio line per qualifying stay.
   *
   * @param hotelId - Hotel UUID running night audit posting.
   * @param businessDate - Business date the room charge is posted for.
   * @param postedBy - User ID recorded as posting actor.
   * @param sourceRef - Optional idempotency-style reference used to avoid duplicate postings.
   * @returns Count of posted lines and cumulative posted amount.
   * @remarks Complexity: O(r) in number of in-house reservations processed.
   * @example
   * const summary = await repository.postRoomChargesForNightAudit(
   *   hotelId,
   *   businessDate,
   *   userId,
   *   'night-audit-2026-04-07'
   * );
   */
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

  /**
   * Groups non-payment folio revenue by department within a business-date range.
   *
   * @param hotelId - Hotel UUID whose folio revenue is aggregated.
   * @param businessDateFrom - Inclusive start business date.
   * @param businessDateTo - Inclusive end business date.
   * @returns Department-level revenue and tax totals.
   */
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

  /**
   * Aggregates same-day revenue and payment totals for operational reporting.
   *
   * @param hotelId - Hotel UUID whose daily totals are requested.
   * @param businessDate - Business date used for folio and payment time windows.
   * @returns Room revenue, other revenue placeholder, tax, and captured payments totals.
   * @remarks Complexity: O(1) application work with 2 aggregate DB queries.
   */
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
