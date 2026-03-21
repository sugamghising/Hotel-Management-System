import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';
import {
  AdjustChargeSchema,
  CreateInvoiceSchema,
  FolioItemIdParamSchema,
  HotelIdParamSchema,
  InvoiceIdParamSchema,
  OrganizationIdParamSchema,
  PaymentIdParamSchema,
  PostBulkChargesSchema,
  PostChargeSchema,
  ProcessPaymentSchema,
  RefundPaymentSchema,
  ReservationIdParamSchema,
  SendInvoiceSchema,
  TransferChargesSchema,
  VoidChargeSchema,
} from './folio.schema';

const OrgHotelParams = OrganizationIdParamSchema.merge(HotelIdParamSchema);
const ReservationParams = OrgHotelParams.merge(ReservationIdParamSchema);
const ItemParams = ReservationParams.merge(FolioItemIdParamSchema);
const PaymentParams = ReservationParams.merge(PaymentIdParamSchema);
const InvoiceParams = ReservationParams.merge(InvoiceIdParamSchema);

const FolioSchema = z.object({
  reservationId: z.string().uuid(),
  guestName: z.string(),
  roomNumber: z.string().nullable(),
  status: z.string(),
  summary: z.object({
    openingBalance: z.number(),
    chargesTotal: z.number(),
    paymentsTotal: z.number(),
    balance: z.number(),
    pendingAuthorizations: z.number(),
  }),
  charges: z.array(z.record(z.unknown())),
  payments: z.array(z.record(z.unknown())),
  invoices: z.array(z.record(z.unknown())),
});

const ChargeSchema = z.object({ id: z.string().uuid() }).and(z.record(z.unknown()));
const PaymentSchema = z.object({ id: z.string().uuid() }).and(z.record(z.unknown()));
const InvoiceSchema = z.object({ id: z.string().uuid() }).and(z.record(z.unknown()));
const CheckoutValidationSchema = z.object({
  canCheckout: z.boolean(),
  balance: z.number(),
  issues: z.array(z.string()),
});
const TransferResultSchema = z.object({});
const NightAuditResultSchema = z.object({ posted: z.number().int(), totalAmount: z.number() });
const InvoicePaymentBodySchema = z.object({
  amount: z.number().positive(),
  method: z.enum([
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BANK_TRANSFER',
    'CHECK',
    'MOBILE_PAYMENT',
    'GIFT_CARD',
    'LOYALTY_POINTS',
    'DIRECT_BILL',
    'DEPOSIT',
  ]),
});

export const folioRegistry = new OpenAPIRegistry();

folioRegistry.register('FolioResponse', FolioSchema);
folioRegistry.register('FolioCharge', ChargeSchema);
folioRegistry.register('FolioPayment', PaymentSchema);
folioRegistry.register('FolioInvoice', InvoiceSchema);

folioRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio',
  tags: ['Folio'],
  summary: 'Get reservation folio',
  request: { params: ReservationParams },
  responses: createApiResponse(z.object({ folio: FolioSchema }), 'Folio retrieved successfully'),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/charges',
  tags: ['Folio'],
  summary: 'Post a folio charge',
  request: {
    params: ReservationParams,
    body: { content: { 'application/json': { schema: PostChargeSchema } } },
  },
  responses: createApiResponse(
    z.object({ charge: ChargeSchema }),
    'Charge posted successfully',
    StatusCodes.CREATED
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/charges/bulk',
  tags: ['Folio'],
  summary: 'Post bulk folio charges',
  request: {
    params: ReservationParams,
    body: { content: { 'application/json': { schema: PostBulkChargesSchema } } },
  },
  responses: createApiResponse(
    z.object({ charges: z.array(ChargeSchema) }),
    'Bulk charges posted successfully',
    StatusCodes.CREATED
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/charges/{itemId}/void',
  tags: ['Folio'],
  summary: 'Void a folio charge',
  request: {
    params: ItemParams,
    body: { content: { 'application/json': { schema: VoidChargeSchema } } },
  },
  responses: createApiResponse(z.object({ charge: ChargeSchema }), 'Charge voided successfully'),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/charges/{itemId}/adjust',
  tags: ['Folio'],
  summary: 'Adjust a folio charge',
  request: {
    params: ItemParams,
    body: { content: { 'application/json': { schema: AdjustChargeSchema } } },
  },
  responses: createApiResponse(z.object({ charge: ChargeSchema }), 'Charge adjusted successfully'),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/payments',
  tags: ['Folio'],
  summary: 'Process a folio payment',
  request: {
    params: ReservationParams,
    body: { content: { 'application/json': { schema: ProcessPaymentSchema } } },
  },
  responses: createApiResponse(
    z.object({ payment: PaymentSchema }),
    'Payment processed successfully',
    StatusCodes.CREATED
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/payments/{paymentId}/refund',
  tags: ['Folio'],
  summary: 'Refund a payment',
  request: {
    params: PaymentParams,
    body: { content: { 'application/json': { schema: RefundPaymentSchema } } },
  },
  responses: createApiResponse(
    z.object({ refund: PaymentSchema }),
    'Refund processed successfully',
    StatusCodes.CREATED
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/transfer',
  tags: ['Folio'],
  summary: 'Transfer charges to another reservation',
  request: {
    params: ReservationParams,
    body: { content: { 'application/json': { schema: TransferChargesSchema } } },
  },
  responses: createApiResponse(TransferResultSchema, 'Charges transferred successfully'),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/invoices',
  tags: ['Folio'],
  summary: 'Create invoice from folio',
  request: {
    params: ReservationParams,
    body: { content: { 'application/json': { schema: CreateInvoiceSchema } } },
  },
  responses: createApiResponse(
    z.object({ invoice: InvoiceSchema }),
    'Invoice created successfully',
    StatusCodes.CREATED
  ),
});

folioRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/invoices/{invoiceId}',
  tags: ['Folio'],
  summary: 'Get invoice',
  request: { params: InvoiceParams },
  responses: createApiResponse(
    z.object({ invoice: InvoiceSchema }),
    'Invoice retrieved successfully'
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/invoices/{invoiceId}/send',
  tags: ['Folio'],
  summary: 'Send invoice via email',
  request: {
    params: InvoiceParams,
    body: { content: { 'application/json': { schema: SendInvoiceSchema } } },
  },
  responses: createApiResponse(z.object({}), 'Invoice sent successfully'),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/invoices/{invoiceId}/payment',
  tags: ['Folio'],
  summary: 'Record invoice payment',
  request: {
    params: InvoiceParams,
    body: {
      content: {
        'application/json': {
          schema: InvoicePaymentBodySchema,
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ invoice: InvoiceSchema }),
    'Payment recorded successfully'
  ),
});

folioRegistry.registerPath({
  method: 'get',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/reservations/{reservationId}/folio/checkout-validation',
  tags: ['Folio'],
  summary: 'Validate checkout eligibility',
  request: { params: ReservationParams },
  responses: createApiResponse(
    z.object({ validation: CheckoutValidationSchema }),
    'Checkout validation successful'
  ),
});

folioRegistry.registerPath({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/hotels/{hotelId}/night-audit/room-charges',
  tags: ['Folio'],
  summary: 'Post night-audit room charges',
  request: {
    params: OrgHotelParams,
    body: {
      content: {
        'application/json': {
          schema: z.object({ businessDate: z.coerce.date() }),
        },
      },
    },
  },
  responses: createApiResponse(
    z.object({ result: NightAuditResultSchema }),
    'Room charges posted successfully',
    StatusCodes.CREATED
  ),
});
