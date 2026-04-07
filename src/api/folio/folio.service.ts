import { config } from '../../config';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { logger } from '../../core/logger';
import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
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

// Mock payment gateway - replace with actual integration (e.g., Stripe, Adyen)
// Card payments are explicitly unsupported until a real gateway is configured
class PaymentGateway {
  /**
   * Simulates payment processing for non-card methods and blocks unsupported card methods.
   *
   * @param params - Payment execution request containing amount, currency, method, and optional token.
   * @returns Success payload with transaction metadata or failure details.
   */
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
    if (params.amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    if (['CREDIT_CARD', 'DEBIT_CARD'].includes(params.method)) {
      return {
        success: false,
        error:
          'Card payment gateway not configured. Please integrate a payment provider (e.g., Stripe, Adyen) before accepting card payments.',
      };
    }

    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
    };
  }

  /**
   * Simulates a successful refund response for gateway-integrated refunds.
   *
   * @param _params - Refund request payload containing transaction and amount.
   * @returns A successful mock refund result with a generated refund identifier.
   */
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

  /**
   * Creates a folio service with repository and gateway dependencies.
   *
   * @param folioRepo - Repository implementation used for folio persistence.
   * @param gateway - Payment gateway abstraction for capture/refund flows.
   */
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

  /**
   * Returns a full folio snapshot for a reservation.
   *
   * The method verifies reservation scope access, loads charges/payments/invoices/summary
   * in parallel, and maps raw financial rows into a UI-oriented response structure.
   *
   * @param reservationId - Reservation UUID whose folio is requested.
   * @param organizationId - Organization UUID used for access control.
   * @param hotelId - Optional hotel UUID for stricter scope matching.
   * @returns Normalized folio response containing summary, charges, payments, and invoices.
   * @remarks Complexity: O(c + p + i) in returned charge/payment/invoice counts.
   */
  async getFolio(
    reservationId: string,
    organizationId: string,
    hotelId?: string
  ): Promise<FolioResponse> {
    // Verify access
    const reservation = await this.verifyReservationAccess(reservationId, organizationId, hotelId);

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

  /**
   * Posts a single folio charge for a reservation.
   *
   * @param reservationId - Reservation UUID receiving the charge.
   * @param organizationId - Organization UUID used for access validation.
   * @param input - Charge payload including type, amounts, and optional source metadata.
   * @param postedBy - Optional actor ID; falls back to system user when omitted.
   * @param hotelId - Optional hotel UUID for stricter reservation scope checks.
   * @returns The created folio item.
   * @throws {BadRequestError} When reservation status does not permit new charges.
   */
  async postCharge(
    reservationId: string,
    organizationId: string,
    input: PostChargeInput,
    postedBy?: string,
    hotelId?: string
  ): Promise<FolioItem> {
    const actorId = postedBy ?? config.system.userId;
    const reservation = await this.verifyReservationAccess(reservationId, organizationId, hotelId);

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
      postedBy: actorId,
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

  /**
   * Posts multiple folio charges in sequence for a reservation.
   *
   * @param reservationId - Reservation UUID receiving the charges.
   * @param organizationId - Organization UUID used for access validation.
   * @param input - Bulk payload containing individual charge lines.
   * @param postedBy - Optional actor ID; falls back to system user when omitted.
   * @param hotelId - Optional hotel UUID for stricter reservation scope checks.
   * @returns Created folio charge records in request order.
   * @remarks Complexity: O(n) in number of input charge lines.
   */
  async postBulkCharges(
    reservationId: string,
    organizationId: string,
    input: PostBulkChargesInput,
    postedBy?: string,
    hotelId?: string
  ): Promise<FolioItem[]> {
    const actorId = postedBy ?? config.system.userId;
    const reservation = await this.verifyReservationAccess(reservationId, organizationId, hotelId);
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
        postedBy: actorId,
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

  /**
   * Voids a folio charge after scope and invoice-payment checks.
   *
   * @param itemId - Folio item UUID to void.
   * @param organizationId - Organization UUID used for access validation.
   * @param reason - Business reason stored with void audit metadata.
   * @param voidedBy - Optional actor ID; falls back to system user when omitted.
   * @returns The voided folio item.
   * @throws {NotFoundError} When charge does not exist.
   * @throws {ConflictError} When charge is already voided.
   * @throws {BadRequestError} When charge has already been invoiced and paid.
   */
  async voidCharge(
    itemId: string,
    organizationId: string,
    reason: string,
    voidedBy?: string
  ): Promise<FolioItem> {
    const actorId = voidedBy ?? config.system.userId;
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

    const voided = await this.folioRepo.voidFolioItem(itemId, actorId, reason);

    logger.warn(`Charge voided: ${item.description}`, {
      folioItemId: itemId,
      amount: item.amount.toString(),
      reason,
    });

    return voided as FolioItem;
  }

  /**
   * Voids the most recent active charge by source reference for a reservation.
   *
   * @param reservationId - Reservation UUID that owns the charge.
   * @param organizationId - Organization UUID used for access validation.
   * @param sourceRef - Source reference used to find the targeted charge.
   * @param reason - Business reason recorded on voided charge.
   * @param voidedBy - Optional actor ID used for audit metadata.
   * @param options - Optional source and hotel filters for charge lookup/scope.
   * @returns The voided folio item.
   * @throws {NotFoundError} When no active matching charge is found.
   */
  async voidChargeBySourceRef(
    reservationId: string,
    organizationId: string,
    sourceRef: string,
    reason: string,
    voidedBy?: string,
    options?: {
      source?: string;
      hotelId?: string;
    }
  ): Promise<FolioItem> {
    await this.verifyReservationAccess(reservationId, organizationId, options?.hotelId);

    const item = await prisma.folioItem.findFirst({
      where: {
        reservationId,
        sourceRef,
        isVoided: false,
        ...(options?.source ? { source: options.source } : {}),
      },
      orderBy: {
        postedAt: 'desc',
      },
    });

    if (!item) {
      throw new NotFoundError(
        `No active folio charge found for reservation ${reservationId} and sourceRef ${sourceRef}`
      );
    }

    return this.voidCharge(item.id, organizationId, reason, voidedBy);
  }

  /**
   * Adjusts a charge amount by creating a balancing adjustment folio entry.
   *
   * @param itemId - Original folio item UUID to adjust.
   * @param organizationId - Organization UUID used for access validation.
   * @param newAmount - Target amount used to compute adjustment delta.
   * @param reason - Reason used in generated adjustment description.
   * @param adjustedBy - Optional actor ID used as posting user.
   * @returns The created adjustment folio item.
   * @throws {NotFoundError} When target folio item does not exist.
   * @throws {BadRequestError} When target folio item is already voided.
   */
  async adjustCharge(
    itemId: string,
    organizationId: string,
    newAmount: number,
    reason: string,
    adjustedBy?: string
  ): Promise<FolioItem> {
    const actorId = adjustedBy ?? config.system.userId;
    const item = await this.folioRepo.findFolioItemById(itemId);

    if (!item) {
      throw new NotFoundError(`Folio item not found with id: ${itemId}`);
    }

    await this.verifyReservationAccess(item.reservationId, organizationId);

    if (item.isVoided) {
      throw new BadRequestError('Cannot adjust voided charge');
    }

    return this.folioRepo.adjustFolioItem(itemId, newAmount, reason, actorId);
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  /**
   * Processes a reservation payment and returns normalized payment response data.
   *
   * The method verifies scope, creates a pending payment record, routes card methods
   * through the payment gateway, updates final status, and maps persisted payment output.
   *
   * @param reservationId - Reservation UUID receiving the payment.
   * @param organizationId - Organization UUID used for access validation.
   * @param input - Payment payload including amount, method, and optional card data.
   * @param processedBy - Optional actor ID; falls back to system user when omitted.
   * @param hotelId - Optional hotel UUID for stricter scope checks.
   * @returns Final payment state mapped to API response shape.
   * @throws {BadRequestError} When gateway processing fails or persisted payment cannot be reloaded.
   * @remarks Complexity: O(1) application work with a fixed number of repository/gateway operations.
   * @example
   * const payment = await service.processPayment(reservationId, organizationId, {
   *   amount: 120.5,
   *   method: 'CASH',
   * });
   */
  async processPayment(
    reservationId: string,
    organizationId: string,
    input: ProcessPaymentInput,
    processedBy?: string,
    hotelId?: string
  ): Promise<PaymentResponse> {
    const actorId = processedBy ?? config.system.userId;
    const reservation = await this.verifyReservationAccess(reservationId, organizationId, hotelId);

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
      createdBy: actorId,
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

  /**
   * Creates a refund against a captured payment and records it in folio payments.
   *
   * @param paymentId - Original captured payment UUID.
   * @param organizationId - Organization UUID used for access validation.
   * @param input - Refund payload containing refund amount and reason.
   * @param processedBy - Optional actor ID; falls back to system user when omitted.
   * @returns Created refund payment mapped to API response shape.
   * @throws {NotFoundError} When original payment cannot be found.
   * @throws {BadRequestError} When original payment is not refundable or amount is invalid.
   */
  async refundPayment(
    paymentId: string,
    organizationId: string,
    input: RefundPaymentInput,
    processedBy?: string
  ): Promise<PaymentResponse> {
    const actorId = processedBy ?? config.system.userId;
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
      createdBy: actorId,
    });

    logger.info(`Payment refunded: ${input.amount}`, {
      originalPaymentId: paymentId,
      refundId: refund.id,
    });

    return this.mapPaymentToResponse(refund);
  }

  /**
   * Voids a non-captured payment record.
   *
   * @param paymentId - Payment UUID to void.
   * @param organizationId - Organization UUID used for access validation.
   * @param _voidedBy - Optional actor ID used for log context.
   * @returns Resolves when void operation completes.
   * @throws {NotFoundError} When payment does not exist.
   * @throws {ConflictError} When payment is already voided.
   * @throws {BadRequestError} When captured gateway-backed payments are voided instead of refunded.
   */
  async voidPayment(paymentId: string, organizationId: string, _voidedBy?: string): Promise<void> {
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

  /**
   * Creates an invoice from unpaid reservation folio charges.
   *
   * @param reservationId - Reservation UUID to invoice.
   * @param organizationId - Organization UUID used for access validation.
   * @param input - Invoice payload including optional charge selection and billing overrides.
   * @param _createdBy - Optional actor ID reserved for future auditing hooks.
   * @param hotelId - Optional hotel UUID for stricter scope checks.
   * @returns The created invoice mapped to API response shape.
   * @throws {BadRequestError} When no invoiceable charges are available.
   */
  async createInvoice(
    reservationId: string,
    organizationId: string,
    input: CreateInvoiceInput,
    _createdBy?: string,
    hotelId?: string
  ): Promise<InvoiceResponse> {
    const reservation = await this.verifyReservationAccess(reservationId, organizationId, hotelId);

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
      billToAddress:
        input.billToAddress != null
          ? (input.billToAddress as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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

  /**
   * Retrieves a single invoice with organization-scope validation.
   *
   * @param invoiceId - Invoice UUID to fetch.
   * @param organizationId - Organization UUID expected to own the invoice.
   * @returns Invoice response payload.
   * @throws {NotFoundError} When invoice does not exist.
   * @throws {ForbiddenError} When invoice organization does not match caller scope.
   */
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

  /**
   * Marks an invoice as sent after access checks.
   *
   * @param invoiceId - Invoice UUID to mark as sent.
   * @param organizationId - Organization UUID expected to own the invoice.
   * @param email - Optional destination email used for logging context.
   * @returns Resolves when invoice send marker is persisted.
   * @throws {NotFoundError} When invoice does not exist.
   * @throws {ForbiddenError} When invoice organization does not match caller scope.
   */
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

  /**
   * Records payment against an invoice and mirrors payment into reservation folio.
   *
   * @param invoiceId - Invoice UUID receiving payment.
   * @param organizationId - Organization UUID used for access validation.
   * @param amount - Payment amount to apply.
   * @param method - Payment method string forwarded to payment processing.
   * @param recordedBy - Optional actor ID used for downstream payment audit.
   * @returns Updated invoice response with revised paid amount and status.
   * @throws {NotFoundError} When invoice does not exist.
   * @throws {ForbiddenError} When invoice organization does not match caller scope.
   * @throws {BadRequestError} When payment would exceed invoice balance.
   */
  async recordInvoicePayment(
    invoiceId: string,
    organizationId: string,
    amount: number,
    method: string,
    recordedBy?: string
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

  /**
   * Transfers selected charges from one reservation folio to another.
   *
   * @param fromReservationId - Source reservation UUID.
   * @param organizationId - Organization UUID used for scope validation.
   * @param input - Transfer payload containing target reservation and charge IDs.
   * @param transferredBy - Optional actor ID; falls back to system user when omitted.
   * @param hotelId - Optional hotel UUID for source reservation scope checks.
   * @returns Resolves when transfer completes.
   * @throws {BadRequestError} When source and target reservations belong to different hotels.
   */
  async transferCharges(
    fromReservationId: string,
    organizationId: string,
    input: TransferChargesInput,
    transferredBy?: string,
    hotelId?: string
  ): Promise<void> {
    const actorId = transferredBy ?? config.system.userId;
    // Verify both reservations exist and user has access
    const fromRes = await this.verifyReservationAccess(fromReservationId, organizationId, hotelId);
    const toRes = await this.verifyReservationAccess(input.targetReservationId, organizationId);

    if (fromRes.hotelId !== toRes.hotelId) {
      throw new BadRequestError('Cannot transfer charges between different hotels');
    }

    await this.folioRepo.transferCharges(
      input.chargeIds,
      fromReservationId,
      input.targetReservationId,
      actorId,
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

  /**
   * Validates whether a reservation folio is ready for checkout.
   *
   * @param reservationId - Reservation UUID to validate.
   * @param organizationId - Organization UUID used for access validation.
   * @param hotelId - Optional hotel UUID for stricter scope checks.
   * @returns Checkout eligibility, current folio balance, and blocking issues.
   * @remarks Complexity: O(p) in number of reservation payments due pending-authorization scan.
   */
  async validateCheckout(
    reservationId: string,
    organizationId: string,
    hotelId?: string
  ): Promise<{
    canCheckout: boolean;
    balance: number;
    issues: string[];
  }> {
    await this.verifyReservationAccess(reservationId, organizationId, hotelId);
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

  /**
   * Returns the current folio balance for a reservation.
   *
   * @param reservationId - Reservation UUID to inspect.
   * @param organizationId - Organization UUID used for access validation.
   * @param hotelId - Optional hotel UUID for stricter scope checks.
   * @returns Net folio balance where positive means amount due and negative means credit.
   */
  async getFolioBalance(
    reservationId: string,
    organizationId: string,
    hotelId?: string
  ): Promise<number> {
    await this.verifyReservationAccess(reservationId, organizationId, hotelId);
    const summary = await this.folioRepo.getFolioSummary(reservationId);
    return summary.balance;
  }

  /**
   * Posts room charges for night audit processing.
   *
   * @param hotelId - Hotel UUID running night audit posting.
   * @param _organizationId - Reserved organization parameter for interface consistency.
   * @param businessDate - Business date to post room charges for.
   * @param postedBy - Optional actor ID; falls back to system user when omitted.
   * @param sourceRef - Optional idempotency reference for deduplication support.
   * @returns Count and total amount of posted room charges.
   */
  async postRoomCharges(
    hotelId: string,
    _organizationId: string,
    businessDate: Date,
    postedBy?: string,
    sourceRef?: string
  ): Promise<{ posted: number; totalAmount: number }> {
    const actorId = postedBy ?? config.system.userId;
    // Verify hotel access
    // TODO: Add hotel access verification

    return this.folioRepo.postRoomChargesForNightAudit(hotelId, businessDate, actorId, sourceRef);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Loads reservation with guest/room relations and validates organization/hotel scope.
   *
   * @param reservationId - Reservation UUID to fetch.
   * @param organizationId - Organization UUID expected to own the reservation.
   * @param hotelId - Optional hotel UUID that must match reservation ownership.
   * @returns Reservation record including guest and room relations.
   * @throws {NotFoundError} When reservation does not exist or hotel scope mismatches.
   * @throws {ForbiddenError} When reservation belongs to a different organization.
   */
  private async verifyReservationAccess(
    reservationId: string,
    organizationId: string,
    hotelId?: string
  ) {
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

    if (hotelId && reservation.hotelId !== hotelId) {
      throw new NotFoundError(`Reservation not found with id: ${reservationId}`);
    }

    return reservation;
  }

  /**
   * Maps internal payment model into API response format.
   *
   * @param payment - Persisted payment model.
   * @returns Payment response with numeric values and optional card info object.
   */
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

  /**
   * Maps internal invoice model into API response format.
   *
   * @param invoice - Persisted invoice model.
   * @returns Invoice response including computed balance fields.
   */
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
