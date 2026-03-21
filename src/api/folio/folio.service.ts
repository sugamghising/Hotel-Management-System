import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { logger } from '../../core/logger';
import { prisma } from '../../database/prisma';
import { type FolioRepository, folioRepository } from './folio.repository';
import type {
  CreateInvoiceInput,
  FolioItem,
  FolioResponse,
  Invoice,
  InvoiceResponse,
  Payment,
  PaymentMethod,
  PaymentResponse,
  PostBulkChargesInput,
  PostChargeInput,
  ProcessPaymentInput,
  RefundPaymentInput,
  TransferChargesInput,
} from './folio.types';

// Mock payment gateway - replace with actual integration
class PaymentGateway {
  async processPayment(params: {
    amount: number;
    currency: string;
    cardToken?: string;
    method: string;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    authCode?: string;
    error?: string;
  }> {
    // Integration with Stripe, Adyen, etc.
    // This is a mock implementation
    if (params.amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
    };
  }

  async refundPayment(_params: {
    transactionId: string;
    amount: number;
  }): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    return {
      success: true,
      refundId: `ref_${Date.now()}`,
    };
  }
}

const paymentGateway = new PaymentGateway();

export class FolioService {
  private folioRepo: FolioRepository;
  private paymentGateway: PaymentGateway;

  constructor(
    folioRepo: FolioRepository = folioRepository,
    gateway: PaymentGateway = paymentGateway
  ) {
    this.folioRepo = folioRepo;
    this.paymentGateway = gateway;
  }

  // ============================================================================
  // FOLIO MANAGEMENT
  // ============================================================================

  async getFolio(reservationId: string, organizationId: string): Promise<FolioResponse> {
    // Verify access
    const reservation = await this.verifyReservationAccess(reservationId, organizationId);

    const [charges, payments, invoices, summary] = await Promise.all([
      this.folioRepo.findFolioItemsByReservation(reservationId),
      this.folioRepo.findPaymentsByReservation(reservationId),
      this.folioRepo.findInvoicesByReservation(reservationId),
      this.folioRepo.getFolioSummary(reservationId),
    ]);

    return {
      reservationId,
      guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      roomNumber: reservation.rooms[0]?.room?.roomNumber || null,
      status: reservation.status,

      summary: {
        openingBalance: 0, // Would track from previous stays
        chargesTotal: summary.chargesTotal,
        paymentsTotal: summary.paymentsTotal,
        balance: summary.balance,
        pendingAuthorizations: payments
          .filter((p) => p.status === 'AUTHORIZED')
          .reduce((sum, p) => sum + Number.parseFloat(p.amount.toString()), 0),
      },

      charges: charges.map((c) => {
        const voidInfo =
          c.isVoided && c.voidedAt && c.voidedBy && c.voidReason
            ? {
                voidedAt: c.voidedAt,
                voidedBy: c.voidedBy,
                reason: c.voidReason,
              }
            : undefined;
        return {
          id: c.id,
          itemType: c.itemType,
          description: c.description,
          amount: Number.parseFloat(c.amount.toString()),
          taxAmount: Number.parseFloat(c.taxAmount.toString()),
          total: Number.parseFloat(c.amount.toString()) + Number.parseFloat(c.taxAmount.toString()),
          quantity: c.quantity,
          unitPrice: Number.parseFloat(c.unitPrice.toString()),
          postedAt: c.postedAt,
          postedBy: c.postedBy,
          isVoided: c.isVoided,
          ...(voidInfo !== undefined ? { voidInfo } : {}),
          ...(c.source ? { source: c.source } : {}),
        };
      }),

      payments: payments.map((p) => {
        const cardInfo =
          p.cardLastFour && p.cardBrand
            ? {
                lastFour: p.cardLastFour,
                brand: p.cardBrand,
              }
            : undefined;
        return {
          id: p.id,
          amount: Number.parseFloat(p.amount.toString()),
          method: p.method,
          status: p.status,
          ...(cardInfo !== undefined ? { cardInfo } : {}),
          processedAt: p.processedAt,
          isRefund: p.isRefund,
        };
      }),

      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        total: Number.parseFloat(i.total.toString()),
        amountPaid: Number.parseFloat(i.amountPaid.toString()),
        balance: Number.parseFloat(i.total.toString()) - Number.parseFloat(i.amountPaid.toString()),
        dueDate: i.dueDate,
      })),
    };
  }

  // ============================================================================
  // CHARGE OPERATIONS
  // ============================================================================

  async postCharge(
    reservationId: string,
    organizationId: string,
    input: PostChargeInput,
    postedBy: string
  ): Promise<FolioItem> {
    const reservation = await this.verifyReservationAccess(reservationId, organizationId);

    // Validate reservation can accept charges
    const invalidStatuses = ['CANCELLED', 'NO_SHOW'];
    if (invalidStatuses.includes(reservation.status)) {
      throw new BadRequestError(`Cannot post charges to ${reservation.status} reservation`);
    }

    const businessDate = input.businessDate || new Date();
    businessDate.setHours(0, 0, 0, 0);

    const charge = await this.folioRepo.createFolioItem({
      organizationId,
      hotelId: reservation.hotelId,
      reservation: { connect: { id: reservationId } },
      itemType: input.itemType,
      description: input.description,
      amount: input.amount,
      taxAmount: input.taxAmount || 0,
      quantity: input.quantity || 1,
      unitPrice: input.unitPrice || input.amount,
      revenueCode: input.revenueCode || 'OTHER',
      department: input.department || 'OTHER',
      postedAt: new Date(),
      postedBy,
      businessDate,
      isVoided: false,
      source: input.source || null,
      sourceRef: input.sourceRef || null,
    });

    logger.info(`Charge posted: ${input.description} - ${input.amount}`, {
      reservationId,
      folioItemId: charge.id,
    });

    return charge as FolioItem;
  }

  async postBulkCharges(
    reservationId: string,
    organizationId: string,
    input: PostBulkChargesInput,
    postedBy: string
  ): Promise<FolioItem[]> {
    const reservation = await this.verifyReservationAccess(reservationId, organizationId);
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);

    const charges: FolioItem[] = [];

    for (const item of input.items) {
      const charge = await this.folioRepo.createFolioItem({
        organizationId,
        hotelId: reservation.hotelId,
        reservation: { connect: { id: reservationId } },
        itemType: item.itemType,
        description: item.description,
        amount: item.amount,
        taxAmount: item.taxAmount || 0,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.amount,
        revenueCode: 'OTHER',
        department: 'OTHER',
        postedAt: new Date(),
        postedBy,
        businessDate,
        isVoided: false,
        source: 'BULK',
        sourceRef: null,
      });
      charges.push(charge as FolioItem);
    }

    logger.info(`Bulk charges posted: ${charges.length} items`, {
      reservationId,
      totalAmount: charges.reduce((sum, c) => sum + Number.parseFloat(c.amount.toString()), 0),
    });

    return charges;
  }

  async voidCharge(
    itemId: string,
    organizationId: string,
    reason: string,
    voidedBy: string
  ): Promise<FolioItem> {
    const item = await this.folioRepo.findFolioItemById(itemId);

    if (!item) {
      throw new NotFoundError(`Folio item not found with id: ${itemId}`);
    }

    // Verify access through reservation
    await this.verifyReservationAccess(item.reservationId, organizationId);

    if (item.isVoided) {
      throw new ConflictError('Charge is already voided');
    }

    // Check if item is part of a paid invoice
    const invoices = await this.folioRepo.findInvoicesByReservation(item.reservationId);
    const paidInvoice = invoices.find(
      (i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) > item.postedAt
    );

    if (paidInvoice) {
      throw new BadRequestError('Cannot void charge that has been paid on an invoice');
    }

    const voided = await this.folioRepo.voidFolioItem(itemId, voidedBy, reason);

    logger.warn(`Charge voided: ${item.description}`, {
      folioItemId: itemId,
      amount: item.amount.toString(),
      reason,
    });

    return voided as FolioItem;
  }

  async adjustCharge(
    itemId: string,
    organizationId: string,
    newAmount: number,
    reason: string,
    adjustedBy: string
  ): Promise<FolioItem> {
    const item = await this.folioRepo.findFolioItemById(itemId);

    if (!item) {
      throw new NotFoundError(`Folio item not found with id: ${itemId}`);
    }

    await this.verifyReservationAccess(item.reservationId, organizationId);

    if (item.isVoided) {
      throw new BadRequestError('Cannot adjust voided charge');
    }

    return this.folioRepo.adjustFolioItem(itemId, newAmount, reason, adjustedBy);
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  async processPayment(
    reservationId: string,
    organizationId: string,
    input: ProcessPaymentInput,
    processedBy: string
  ): Promise<PaymentResponse> {
    const reservation = await this.verifyReservationAccess(reservationId, organizationId);

    // Check for existing authorization if using card
    if (['CREDIT_CARD', 'DEBIT_CARD'].includes(input.method)) {
      const existingAuths = await this.folioRepo.findPaymentsByReservation(reservationId);
      const pendingAuth = existingAuths.find((p) => p.status === 'AUTHORIZED');

      if (pendingAuth) {
        // Offer to capture existing instead of new charge
        logger.info('Existing authorization found', { paymentId: pendingAuth.id });
      }
    }

    // Create payment record
    const payment = await this.folioRepo.createPayment({
      organizationId,
      hotelId: reservation.hotelId,
      reservation: { connect: { id: reservationId } },
      amount: input.amount,
      currencyCode: input.currencyCode || 'USD',
      method: input.method,
      status: 'PENDING',
      cardLastFour: input.cardLastFour || null,
      cardBrand: input.cardBrand || null,
      transactionId: null,
      authCode: null,
      processedAt: null,
      parentPaymentId: null,
      isRefund: false,
      notes: input.notes || null,
      createdAt: new Date(),
      createdBy: processedBy,
    });

    // Process through gateway for card payments
    if (['CREDIT_CARD', 'DEBIT_CARD'].includes(input.method)) {
      const gatewayParams: {
        amount: number;
        currency: string;
        cardToken?: string;
        method: string;
      } = {
        amount: input.amount,
        currency: input.currencyCode || 'USD',
        method: input.method as string,
      };
      if (input.cardToken) {
        gatewayParams.cardToken = input.cardToken;
      }
      const gatewayResult = await this.paymentGateway.processPayment(gatewayParams);

      if (!gatewayResult.success) {
        await this.folioRepo.updatePaymentStatus(payment.id, 'FAILED');
        throw new BadRequestError(gatewayResult.error || 'Payment processing failed');
      }

      await this.folioRepo.updatePaymentStatus(
        payment.id,
        'CAPTURED',
        gatewayResult.transactionId,
        gatewayResult.authCode
      );
    } else {
      // Non-card payments are marked as captured immediately
      await this.folioRepo.updatePaymentStatus(payment.id, 'CAPTURED');
    }

    const updated = await this.folioRepo.findPaymentById(payment.id);
    if (!updated) {
      throw new BadRequestError('Payment was created but could not be retrieved');
    }

    logger.info(`Payment processed: ${input.method} - ${input.amount}`, {
      reservationId,
      paymentId: payment.id,
    });

    return this.mapPaymentToResponse(updated);
  }

  async refundPayment(
    paymentId: string,
    organizationId: string,
    input: RefundPaymentInput,
    processedBy: string
  ): Promise<PaymentResponse> {
    const originalPayment = await this.folioRepo.findPaymentById(paymentId);

    if (!originalPayment) {
      throw new NotFoundError(`Payment not found with id: ${paymentId}`);
    }

    await this.verifyReservationAccess(originalPayment.reservationId, organizationId);

    if (originalPayment.status !== 'CAPTURED') {
      throw new BadRequestError('Can only refund captured payments');
    }

    // Check refund amount
    const originalAmount = Number.parseFloat(originalPayment.amount.toString());
    if (input.amount > originalAmount) {
      throw new BadRequestError('Refund amount cannot exceed original payment');
    }

    // Process refund through gateway
    let refundTransactionId: string | null = null;
    if (originalPayment.transactionId) {
      const refundResult = await this.paymentGateway.refundPayment({
        transactionId: originalPayment.transactionId,
        amount: input.amount,
      });

      if (!refundResult.success) {
        throw new BadRequestError(refundResult.error || 'Refund processing failed');
      }
      refundTransactionId = refundResult.refundId || null;
    }

    // Create refund record
    const refund = await this.folioRepo.createRefund(paymentId, {
      organizationId: originalPayment.organizationId,
      hotelId: originalPayment.hotelId,
      reservation: { connect: { id: originalPayment.reservationId } },
      amount: input.amount,
      currencyCode: originalPayment.currencyCode,
      method: originalPayment.method,
      status: 'CAPTURED',
      cardLastFour: originalPayment.cardLastFour,
      cardBrand: originalPayment.cardBrand,
      transactionId: refundTransactionId,
      authCode: null,
      processedAt: new Date(),
      notes: `Refund: ${input.reason}`,
      createdAt: new Date(),
      createdBy: processedBy,
    });

    logger.info(`Payment refunded: ${input.amount}`, {
      originalPaymentId: paymentId,
      refundId: refund.id,
    });

    return this.mapPaymentToResponse(refund);
  }

  async voidPayment(paymentId: string, organizationId: string, _voidedBy: string): Promise<void> {
    const payment = await this.folioRepo.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundError(`Payment not found with id: ${paymentId}`);
    }

    await this.verifyReservationAccess(payment.reservationId, organizationId);

    if (payment.status === 'VOIDED') {
      throw new ConflictError('Payment is already voided');
    }

    if (payment.status === 'CAPTURED' && payment.transactionId) {
      // Would need to void/refund through gateway first
      throw new BadRequestError('Captured payments must be refunded, not voided');
    }

    await this.folioRepo.voidPayment(paymentId);

    logger.warn('Payment voided', { paymentId: paymentId, voidedBy: _voidedBy });
  }

  // ============================================================================
  // INVOICE OPERATIONS
  // ============================================================================

  async createInvoice(
    reservationId: string,
    organizationId: string,
    input: CreateInvoiceInput,
    _createdBy: string
  ): Promise<InvoiceResponse> {
    const reservation = await this.verifyReservationAccess(reservationId, organizationId);

    // Get unpaid charges
    const charges = await this.folioRepo.findFolioItemsByReservation(reservationId, {
      includeVoided: false,
    });

    const unpaidCharges = input.chargeIds
      ? charges.filter((c) => (input.chargeIds as string[]).includes(c.id))
      : charges.filter((c) => c.itemType !== 'PAYMENT' && c.itemType !== 'REFUND');

    if (unpaidCharges.length === 0) {
      throw new BadRequestError('No charges to invoice');
    }

    const subtotal = unpaidCharges.reduce(
      (sum, c) => sum + Number.parseFloat(c.amount.toString()),
      0
    );
    const taxTotal = unpaidCharges.reduce(
      (sum, c) => sum + Number.parseFloat(c.taxAmount.toString()),
      0
    );

    const invoiceNumber = await this.folioRepo.generateInvoiceNumber(reservation.hotelId);

    const dueDate = input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await this.folioRepo.createInvoice({
      organizationId,
      hotelId: reservation.hotelId,
      reservation: { connect: { id: reservationId } },
      invoiceNumber,
      issueDate: new Date(),
      dueDate,
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
      amountPaid: 0,
      status: 'OPEN',
      billToName:
        input.billToName || `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      billToAddress: input.billToAddress ? JSON.stringify(input.billToAddress) : JSON.stringify({}),
      documentUrl: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
    });

    logger.info(`Invoice created: ${invoiceNumber}`, {
      reservationId,
      invoiceId: invoice.id,
      total: subtotal + taxTotal,
    });

    return this.mapInvoiceToResponse(invoice);
  }

  async getInvoice(invoiceId: string, organizationId: string): Promise<InvoiceResponse> {
    const invoice = await this.folioRepo.findInvoiceById(invoiceId);

    if (!invoice) {
      throw new NotFoundError(`Invoice not found with id: ${invoiceId}`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return this.mapInvoiceToResponse(invoice);
  }

  async sendInvoice(invoiceId: string, organizationId: string, email?: string): Promise<void> {
    const invoice = await this.folioRepo.findInvoiceById(invoiceId);

    if (!invoice) {
      throw new NotFoundError(`Invoice not found with id: ${invoiceId}`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Generate PDF and send email
    // TODO: Implement document generation and email service

    await this.folioRepo.markInvoiceSent(invoiceId);

    logger.info(`Invoice sent: ${invoice.invoiceNumber}`, { invoiceId, email });
  }

  async recordInvoicePayment(
    invoiceId: string,
    organizationId: string,
    amount: number,
    method: string,
    recordedBy: string
  ): Promise<InvoiceResponse> {
    const invoice = await this.folioRepo.findInvoiceById(invoiceId);

    if (!invoice) {
      throw new NotFoundError(`Invoice not found with id: ${invoiceId}`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const currentPaid = Number.parseFloat(invoice.amountPaid.toString());
    const total = Number.parseFloat(invoice.total.toString());
    const newPaid = currentPaid + amount;

    if (newPaid > total) {
      throw new BadRequestError('Payment exceeds invoice balance');
    }

    const status = newPaid >= total ? 'PAID' : 'OPEN';

    const updated = await this.folioRepo.updateInvoiceStatus(invoiceId, status, newPaid);

    // Also record payment on reservation folio
    await this.processPayment(
      invoice.reservationId,
      organizationId,
      {
        amount,
        method: method as PaymentMethod,
        notes: `Payment for invoice ${invoice.invoiceNumber}`,
      },
      recordedBy
    );

    return this.mapInvoiceToResponse(updated);
  }

  // ============================================================================
  // TRANSFERS & SPLITS
  // ============================================================================

  async transferCharges(
    fromReservationId: string,
    organizationId: string,
    input: TransferChargesInput,
    transferredBy: string
  ): Promise<void> {
    // Verify both reservations exist and user has access
    const fromRes = await this.verifyReservationAccess(fromReservationId, organizationId);
    const toRes = await this.verifyReservationAccess(input.targetReservationId, organizationId);

    if (fromRes.hotelId !== toRes.hotelId) {
      throw new BadRequestError('Cannot transfer charges between different hotels');
    }

    await this.folioRepo.transferCharges(
      input.chargeIds,
      fromReservationId,
      input.targetReservationId,
      transferredBy,
      input.reason
    );

    logger.info(`Charges transferred: ${input.chargeIds.length} items`, {
      from: fromReservationId,
      to: input.targetReservationId,
    });
  }

  // ============================================================================
  // CHECKOUT VALIDATION
  // ============================================================================

  async validateCheckout(
    reservationId: string,
    organizationId: string
  ): Promise<{
    canCheckout: boolean;
    balance: number;
    issues: string[];
  }> {
    await this.verifyReservationAccess(reservationId, organizationId);
    const summary = await this.folioRepo.getFolioSummary(reservationId);

    const issues: string[] = [];

    if (summary.balance > 0) {
      issues.push(`Outstanding balance: ${summary.balance.toFixed(2)}`);
    }

    if (summary.balance < -0.01) {
      issues.push(`Credit balance: ${Math.abs(summary.balance).toFixed(2)} - refund required`);
    }

    // Check for unprocessed authorizations
    const payments = await this.folioRepo.findPaymentsByReservation(reservationId);
    const pendingAuths = payments.filter((p) => p.status === 'AUTHORIZED');
    if (pendingAuths.length > 0) {
      issues.push(`${pendingAuths.length} pending payment authorization(s)`);
    }

    return {
      canCheckout: issues.length === 0,
      balance: summary.balance,
      issues,
    };
  }

  // ============================================================================
  // NIGHT AUDIT SUPPORT
  // ============================================================================

  async postRoomCharges(
    hotelId: string,
    _organizationId: string,
    businessDate: Date,
    postedBy: string
  ): Promise<{ posted: number; totalAmount: number }> {
    // Verify hotel access
    // TODO: Add hotel access verification

    return this.folioRepo.postRoomChargesForNightAudit(hotelId, businessDate, postedBy);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async verifyReservationAccess(reservationId: string, organizationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        rooms: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!reservation || reservation.deletedAt) {
      throw new NotFoundError(`Reservation not found with id: ${reservationId}`);
    }

    if (reservation.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this reservation');
    }

    return reservation;
  }

  private mapPaymentToResponse(payment: Payment): PaymentResponse {
    const cardInfo =
      payment.cardLastFour && payment.cardBrand
        ? {
            lastFour: payment.cardLastFour,
            brand: payment.cardBrand,
          }
        : undefined;
    return {
      id: payment.id,
      amount: Number.parseFloat(payment.amount.toString()),
      currencyCode: payment.currencyCode,
      method: payment.method,
      status: payment.status,
      ...(cardInfo !== undefined ? { cardInfo } : {}),
      transactionId: payment.transactionId,
      authCode: payment.authCode,
      processedAt: payment.processedAt,
      isRefund: payment.isRefund,
      parentPaymentId: payment.parentPaymentId,
      notes: payment.notes,
      createdAt: payment.createdAt,
      createdBy: payment.createdBy,
    };
  }

  private mapInvoiceToResponse(invoice: Invoice): InvoiceResponse {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      amounts: {
        subtotal: Number.parseFloat(invoice.subtotal.toString()),
        taxTotal: Number.parseFloat(invoice.taxTotal.toString()),
        total: Number.parseFloat(invoice.total.toString()),
        amountPaid: Number.parseFloat(invoice.amountPaid.toString()),
        balance:
          Number.parseFloat(invoice.total.toString()) -
          Number.parseFloat(invoice.amountPaid.toString()),
      },
      billing: {
        name: invoice.billToName,
        address: invoice.billToAddress,
      },
      items: [], // Would populate from folio items
      documentUrl: invoice.documentUrl,
      sentAt: invoice.sentAt,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
    };
  }
}

export const folioService = new FolioService();
