// src/features/folio/folio.controller.ts

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { folioService } from './folio.service';

export class FolioController {
  /**
   * GET /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio
   */
  getFolio = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };

    const folio = await folioService.getFolio(reservationId, organizationId);

    handleServiceResponse(ServiceResponse.success({ folio }, 'Folio retrieved successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges
   */
  postCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };
    const input = req.body;

    const charge = await folioService.postCharge(
      reservationId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ charge }, 'Charge posted successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/bulk
   */
  postBulkCharges = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };
    const input = req.body;

    const charges = await folioService.postBulkCharges(
      reservationId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ charges }, 'Bulk charges posted successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/:itemId/void
   */
  voidCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, itemId } = req.params as { organizationId: string; itemId: string };
    const { reason } = req.body;

    const charge = await folioService.voidCharge(itemId, organizationId, reason, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ charge }, 'Charge voided successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/:itemId/adjust
   */
  adjustCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, itemId } = req.params as { organizationId: string; itemId: string };
    const { newAmount, reason } = req.body;

    const charge = await folioService.adjustCharge(
      itemId,
      organizationId,
      newAmount,
      reason,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ charge }, 'Charge adjusted successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/payments
   */
  processPayment = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };
    const input = req.body;

    const payment = await folioService.processPayment(
      reservationId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ payment }, 'Payment processed successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/payments/:paymentId/refund
   */
  refundPayment = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, paymentId } = req.params as {
      organizationId: string;
      paymentId: string;
    };
    const input = req.body;

    const refund = await folioService.refundPayment(
      paymentId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ refund }, 'Refund processed successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/transfer
   */
  transferCharges = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };
    const input = req.body;

    await folioService.transferCharges(reservationId, organizationId, input, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({}, 'Charges transferred successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices
   */
  createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };
    const input = req.body;

    const invoice = await folioService.createInvoice(
      reservationId,
      organizationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ invoice }, 'Invoice created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId
   */
  getInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, invoiceId } = req.params as {
      organizationId: string;
      invoiceId: string;
    };

    const invoice = await folioService.getInvoice(invoiceId, organizationId);

    handleServiceResponse(
      ServiceResponse.success({ invoice }, 'Invoice retrieved successfully'),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId/send
   */
  sendInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, invoiceId } = req.params as {
      organizationId: string;
      invoiceId: string;
    };
    const { email } = req.body;

    await folioService.sendInvoice(invoiceId, organizationId, email);

    handleServiceResponse(ServiceResponse.success({}, 'Invoice sent successfully'), res);
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId/payment
   */
  recordInvoicePayment = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, invoiceId } = req.params as {
      organizationId: string;
      invoiceId: string;
    };
    const { amount, method } = req.body;

    const invoice = await folioService.recordInvoicePayment(
      invoiceId,
      organizationId,
      amount,
      method,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ invoice }, 'Payment recorded successfully'),
      res
    );
  });

  /**
   * GET /organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/checkout-validation
   */
  validateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, reservationId } = req.params as {
      organizationId: string;
      reservationId: string;
    };

    const validation = await folioService.validateCheckout(reservationId, organizationId);

    handleServiceResponse(
      ServiceResponse.success({ validation }, 'Checkout validation successful'),
      res
    );
  });

  /**
   * POST /organizations/:organizationId/hotels/:hotelId/night-audit/room-charges
   */
  postRoomCharges = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const { businessDate } = req.body;

    const result = await folioService.postRoomCharges(
      hotelId,
      organizationId,
      new Date(businessDate),
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ result }, 'Room charges posted successfully', StatusCodes.CREATED),
      res
    );
  });
}

export const folioController = new FolioController();
