import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const FolioItemTypeSchema = z.enum([
  'ROOM_CHARGE',
  'TAX',
  'SERVICE_CHARGE',
  'POS_CHARGE',
  'MINIBAR',
  'LAUNDRY',
  'SPA',
  'TRANSPORT',
  'PHONE',
  'ADJUSTMENT',
  'DISCOUNT',
  'PAYMENT',
  'REFUND',
  'NO_SHOW_FEE',
]);

export const PaymentMethodSchema = z.enum([
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
]);

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'VOIDED',
]);

export const RevenueCodeSchema = z.string().max(20);

export const DepartmentSchema = z.enum([
  'ROOMS',
  'F&B',
  'SPA',
  'MINIBAR',
  'LAUNDRY',
  'TRANSPORT',
  'PHONE',
  'RETAIL',
  'OTHER',
]);

// ============================================================================
// POST CHARGE SCHEMAS
// ============================================================================

export const PostChargeSchema = z.object({
  itemType: FolioItemTypeSchema,
  description: z.string().min(1).max(255),
  amount: z.number().finite(),
  taxAmount: z.number().min(0).default(0),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().optional(),
  revenueCode: RevenueCodeSchema.default('ROOM'),
  department: DepartmentSchema.default('ROOMS'),
  source: z.string().max(50).optional(),
  sourceRef: z.string().max(100).optional(),
  businessDate: z.coerce.date().optional(),
});

export const PostBulkChargesSchema = z.object({
  items: z
    .array(
      z.object({
        itemType: FolioItemTypeSchema,
        description: z.string().min(1).max(255),
        amount: z.number().finite(),
        taxAmount: z.number().min(0).default(0),
        quantity: z.number().int().min(1).default(1),
        unitPrice: z.number().optional(),
      })
    )
    .min(1)
    .max(50),
});

// ============================================================================
// VOID & ADJUSTMENT SCHEMAS
// ============================================================================

export const VoidChargeSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const AdjustChargeSchema = z.object({
  newAmount: z.number().finite(),
  reason: z.string().min(1).max(500),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const ProcessPaymentSchema = z
  .object({
    amount: z.number().positive(),
    currencyCode: z.string().length(3).default('USD'),
    method: PaymentMethodSchema,

    // Card fields (required if method is CREDIT_CARD or DEBIT_CARD)
    cardToken: z.string().optional(),
    cardLastFour: z.string().length(4).optional(),
    cardBrand: z.string().max(20).optional(),
    cardExpiryMonth: z.string().length(2).optional(),
    cardExpiryYear: z.string().length(4).optional(),

    // Other methods
    checkNumber: z.string().max(50).optional(),
    bankReference: z.string().max(100).optional(),

    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      const cardMethods = ['CREDIT_CARD', 'DEBIT_CARD'];
      if (cardMethods.includes(data.method)) {
        return data.cardToken || (data.cardLastFour && data.cardBrand);
      }
      return true;
    },
    {
      message: 'Card details required for credit/debit card payments',
      path: ['cardToken'],
    }
  );

export const RefundPaymentSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

export const CapturePaymentSchema = z.object({
  amount: z.number().positive().optional(), // Partial capture amount
});

// ============================================================================
// TRANSFER & SPLIT SCHEMAS
// ============================================================================

export const TransferChargesSchema = z.object({
  targetReservationId: z.string().uuid(),
  chargeIds: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1).max(500),
});

export const SplitFolioSchema = z
  .object({
    splitType: z.enum(['PERCENTAGE', 'AMOUNT', 'ITEM']),
    splits: z
      .array(
        z.object({
          reservationId: z.string().uuid(),
          percentage: z.number().min(0).max(100).optional(),
          amount: z.number().positive().optional(),
          itemIds: z.array(z.string().uuid()).optional(),
        })
      )
      .min(2),
  })
  .refine(
    (data) => {
      if (data.splitType === 'PERCENTAGE') {
        const total = data.splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
        return total === 100;
      }
      if (data.splitType === 'AMOUNT') {
        return data.splits.every((s) => s.amount !== undefined);
      }
      if (data.splitType === 'ITEM') {
        return data.splits.every((s) => s.itemIds && s.itemIds.length > 0);
      }
      return true;
    },
    {
      message: 'Invalid split configuration',
      path: ['splits'],
    }
  );

// ============================================================================
// INVOICE SCHEMAS
// ============================================================================

export const CreateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  billToName: z.string().max(255).optional(),
  billToAddress: z.record(z.any()).optional(),
  chargeIds: z.array(z.string().uuid()).optional(),
});

export const SendInvoiceSchema = z.object({
  email: z.string().email().optional(),
});

export const PostToCityLedgerSchema = z.object({
  companyId: z.string().uuid(),
  amount: z.number().positive(),
  invoiceNumber: z.string().max(50),
  dueDate: z.coerce.date(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const FolioQuerySchema = z.object({
  businessDateFrom: z.coerce.date().optional(),
  businessDateTo: z.coerce.date().optional(),
  itemTypes: z.array(FolioItemTypeSchema).optional(),
  departments: z.array(DepartmentSchema).optional(),
  includeVoided: z.coerce.boolean().default(false),
});

export const RevenueReportSchema = z.object({
  businessDateFrom: z.coerce.date(),
  businessDateTo: z.coerce.date(),
  groupBy: z.enum(['DAY', 'DEPARTMENT', 'REVENUE_CODE']).default('DAY'),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const ReservationIdParamSchema = z.object({
  reservationId: z.string().uuid(),
});

export const FolioItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
});

export const PaymentIdParamSchema = z.object({
  paymentId: z.string().uuid(),
});

export const InvoiceIdParamSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostChargeInput = z.infer<typeof PostChargeSchema>;
export type PostBulkChargesInput = z.infer<typeof PostBulkChargesSchema>;
export type VoidChargeInput = z.infer<typeof VoidChargeSchema>;
export type AdjustChargeInput = z.infer<typeof AdjustChargeSchema>;
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type TransferChargesInput = z.infer<typeof TransferChargesSchema>;
export type SplitFolioInput = z.infer<typeof SplitFolioSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type PostToCityLedgerInput = z.infer<typeof PostToCityLedgerSchema>;
export type FolioQueryInput = z.infer<typeof FolioQuerySchema>;
export type RevenueReportInput = z.infer<typeof RevenueReportSchema>;
