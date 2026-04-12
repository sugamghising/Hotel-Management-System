// src/api/folio/folio.controller.ts

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import { folioService } from './folio.service';

/**
 * Controller transport handlers for folio and billing operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId.
 */
export class FolioController {
  /**
   * Handles get folio requests for folio and billing operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getFolio = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const folio = await folioService.getFolio(reservationId, organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ folio }, 'Folio retrieved successfully'), res);
  });

  /**
   * Handles post charge requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  postCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body;

    const charge = await folioService.postCharge(
      reservationId,
      organizationId,
      input,
      req.user?.sub,
      hotelId
    );

    handleServiceResponse(
      ServiceResponse.success({ charge }, 'Charge posted successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles post bulk charges requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/bulk
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  postBulkCharges = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body;

    const charges = await folioService.postBulkCharges(
      reservationId,
      organizationId,
      input,
      req.user?.sub,
      hotelId
    );

    handleServiceResponse(
      ServiceResponse.success({ charges }, 'Bulk charges posted successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles void charge requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/:itemId/void
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  voidCharge = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, itemId } = req.params as { organizationId: string; itemId: string };
    const { reason } = req.body;

    const charge = await folioService.voidCharge(itemId, organizationId, reason, req.user?.sub);

    handleServiceResponse(ServiceResponse.success({ charge }, 'Charge voided successfully'), res);
  });

  /**
   * Handles adjust charge requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/charges/:itemId/adjust
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles process payment requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/payments
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  processPayment = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body;

    const payment = await folioService.processPayment(
      reservationId,
      organizationId,
      input,
      req.user?.sub,
      hotelId
    );

    handleServiceResponse(
      ServiceResponse.success({ payment }, 'Payment processed successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles refund payment requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/payments/:paymentId/refund
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles transfer charges requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/transfer
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  transferCharges = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body;

    await folioService.transferCharges(
      reservationId,
      organizationId,
      input,
      req.user?.sub,
      hotelId
    );

    handleServiceResponse(ServiceResponse.success({}, 'Charges transferred successfully'), res);
  });

  /**
   * Handles create invoice requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body;

    const invoice = await folioService.createInvoice(
      reservationId,
      organizationId,
      input,
      req.user?.sub,
      hotelId
    );

    handleServiceResponse(
      ServiceResponse.success({ invoice }, 'Invoice created successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles get invoice requests for folio and billing operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles send invoice requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId/send
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles record invoice payment requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/invoices/:invoiceId/payment
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
   * Handles validate checkout requests for folio and billing operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/folio/checkout-validation
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  validateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const validation = await folioService.validateCheckout(reservationId, organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ validation }, 'Checkout validation successful'),
      res
    );
  });

  /**
   * Handles post room charges requests for folio and billing operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/night-audit/room-charges
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
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
