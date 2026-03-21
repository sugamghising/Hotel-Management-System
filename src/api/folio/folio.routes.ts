import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../core';
import { authMiddleware } from '../../core/middleware/auth';
import { requirePermission } from '../../core/middleware/requirePermission';
import { folioController } from './folio.controller';
import {
  AdjustChargeSchema,
  CreateInvoiceSchema,
  FolioItemIdParamSchema,
  HotelIdParamSchema,
  InvoiceIdParamSchema,
  OrganizationIdParamSchema,
  PaymentIdParamSchema,
  PaymentMethodSchema,
  PostBulkChargesSchema,
  PostChargeSchema,
  ProcessPaymentSchema,
  RefundPaymentSchema,
  ReservationIdParamSchema,
  SendInvoiceSchema,
  TransferChargesSchema,
  VoidChargeSchema,
} from './folio.schema';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const ReservationParams = OrgHotelParams.merge(ReservationIdParamSchema);
const InvoicePaymentBodySchema = z.object({
  amount: z.number().positive(),
  method: PaymentMethodSchema,
});

router.get(
  '/reservations/:reservationId/folio',
  requirePermission('FOLIO.READ'),
  validate({ params: ReservationParams }),
  folioController.getFolio
);

router.post(
  '/reservations/:reservationId/folio/charges',
  requirePermission('FOLIO.CHARGE'),
  validate({ params: ReservationParams, body: PostChargeSchema }),
  folioController.postCharge
);

router.post(
  '/reservations/:reservationId/folio/charges/bulk',
  requirePermission('FOLIO.CHARGE'),
  validate({ params: ReservationParams, body: PostBulkChargesSchema }),
  folioController.postBulkCharges
);

router.post(
  '/reservations/:reservationId/folio/charges/:itemId/void',
  requirePermission('FOLIO.CHARGE'),
  validate({ params: ReservationParams.merge(FolioItemIdParamSchema), body: VoidChargeSchema }),
  folioController.voidCharge
);

router.post(
  '/reservations/:reservationId/folio/charges/:itemId/adjust',
  requirePermission('FOLIO.CHARGE'),
  validate({ params: ReservationParams.merge(FolioItemIdParamSchema), body: AdjustChargeSchema }),
  folioController.adjustCharge
);

router.post(
  '/reservations/:reservationId/folio/payments',
  requirePermission('FOLIO.PAYMENT'),
  validate({ params: ReservationParams, body: ProcessPaymentSchema }),
  folioController.processPayment
);

router.post(
  '/reservations/:reservationId/folio/payments/:paymentId/refund',
  requirePermission('FOLIO.PAYMENT'),
  validate({ params: ReservationParams.merge(PaymentIdParamSchema), body: RefundPaymentSchema }),
  folioController.refundPayment
);

router.post(
  '/reservations/:reservationId/folio/transfer',
  requirePermission('FOLIO.TRANSFER'),
  validate({ params: ReservationParams, body: TransferChargesSchema }),
  folioController.transferCharges
);

router.post(
  '/reservations/:reservationId/folio/invoices',
  requirePermission('FOLIO.INVOICE'),
  validate({ params: ReservationParams, body: CreateInvoiceSchema }),
  folioController.createInvoice
);

router.get(
  '/reservations/:reservationId/folio/invoices/:invoiceId',
  requirePermission('FOLIO.INVOICE'),
  validate({ params: ReservationParams.merge(InvoiceIdParamSchema) }),
  folioController.getInvoice
);

router.post(
  '/reservations/:reservationId/folio/invoices/:invoiceId/send',
  requirePermission('FOLIO.INVOICE'),
  validate({ params: ReservationParams.merge(InvoiceIdParamSchema), body: SendInvoiceSchema }),
  folioController.sendInvoice
);

router.post(
  '/reservations/:reservationId/folio/invoices/:invoiceId/payment',
  requirePermission('FOLIO.INVOICE'),
  validate({
    params: ReservationParams.merge(InvoiceIdParamSchema),
    body: InvoicePaymentBodySchema,
  }),
  folioController.recordInvoicePayment
);

router.get(
  '/reservations/:reservationId/folio/checkout-validation',
  requirePermission('FOLIO.READ'),
  validate({ params: ReservationParams }),
  folioController.validateCheckout
);

router.post(
  '/night-audit/room-charges',
  requirePermission('NIGHT_AUDIT.RUN'),
  validate({
    params: OrgHotelParams,
    body: PostChargeSchema.pick({ businessDate: true }),
  }),
  folioController.postRoomCharges
);

export default router;
