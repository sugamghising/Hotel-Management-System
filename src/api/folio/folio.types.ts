// ============================================================================
// ENUMS (from Prisma schema)
// ============================================================================

export type FolioItemType =
  | 'ROOM_CHARGE'
  | 'TAX'
  | 'SERVICE_CHARGE'
  | 'POS_CHARGE'
  | 'MINIBAR'
  | 'LAUNDRY'
  | 'SPA'
  | 'TRANSPORT'
  | 'PHONE'
  | 'ADJUSTMENT'
  | 'DISCOUNT'
  | 'PAYMENT'
  | 'REFUND'
  | 'NO_SHOW_FEE';

export type PaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'MOBILE_PAYMENT'
  | 'GIFT_CARD'
  | 'LOYALTY_POINTS'
  | 'DIRECT_BILL'
  | 'DEPOSIT';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'VOIDED';

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID' | 'CREDIT_NOTE';

// ============================================================================
// DOMAIN ENTITIES
// ============================================================================

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  countryCode: string;
}

export interface FolioItem {
  id: string;
  organizationId: string;
  hotelId: string;
  reservationId: string;

  // Transaction details
  itemType: FolioItemType;
  description: string;
  amount: number; // Can be negative for discounts/adjustments
  taxAmount: number;
  quantity: number;
  unitPrice: number;

  // Accounting
  revenueCode: string; // For chart of accounts
  department: string; // Revenue center

  // Posting
  postedAt: Date;
  postedBy: string;
  businessDate: Date; // Night audit date

  // Void
  isVoided: boolean;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;

  // Source tracking
  source: string | null; // POS, MINIBAR, etc.
  sourceRef: string | null; // External reference

  // Audit
  createdAt: Date;
}

export interface Payment {
  id: string;
  organizationId: string;
  hotelId: string;
  reservationId: string;

  amount: number;
  currencyCode: string;
  method: PaymentMethod;
  status: PaymentStatus;

  // Card details (tokenized)
  cardLastFour: string | null;
  cardBrand: string | null;

  // Transaction
  transactionId: string | null; // Gateway reference
  authCode: string | null;
  processedAt: Date | null;

  // Refund linkage
  parentPaymentId: string | null;
  isRefund: boolean;

  // Metadata
  notes: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  hotelId: string;
  reservationId: string;

  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;

  // Amounts
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;

  status: InvoiceStatus;

  // Billing address
  billToName: string;
  billToAddress: BillingAddress; // JSON address

  // Document
  documentUrl: string | null;

  // Tracking
  sentAt: Date | null;
  paidAt: Date | null;

  createdAt: Date;
}

// ============================================================================
// API INPUTS/OUTPUTS
// ============================================================================

export interface PostChargeInput {
  itemType: FolioItemType;
  description: string;
  amount: number;
  taxAmount?: number;
  quantity?: number;
  unitPrice?: number;
  revenueCode?: string;
  department?: string;
  source?: string;
  sourceRef?: string;
  businessDate?: Date;
}

export interface PostBulkChargesInput {
  items: Array<{
    itemType: FolioItemType;
    description: string;
    amount: number;
    taxAmount?: number;
    quantity?: number;
    unitPrice?: number;
  }>;
}

export interface VoidChargeInput {
  reason: string;
}

export interface AdjustChargeInput {
  newAmount: number;
  reason: string;
}

export interface ProcessPaymentInput {
  amount: number;
  method: PaymentMethod;
  currencyCode?: string;

  // Card data (tokenized in production)
  cardToken?: string;
  cardLastFour?: string;
  cardBrand?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;

  // Other methods
  checkNumber?: string;
  bankReference?: string;

  notes?: string;
}

export interface RefundPaymentInput {
  amount: number;
  reason: string;
}

export interface TransferChargesInput {
  targetReservationId: string;
  chargeIds: string[];
  reason: string;
}

export interface SplitFolioInput {
  splitType: 'PERCENTAGE' | 'AMOUNT' | 'ITEM';
  splits: Array<{
    reservationId: string;
    percentage?: number;
    amount?: number;
    itemIds?: string[];
  }>;
}

export interface CreateInvoiceInput {
  dueDate?: Date;
  billToName?: string;
  billToAddress?: BillingAddress;
  chargeIds?: string[]; // Specific charges to invoice, or all unpaid
}

export interface PostToCityLedgerInput {
  companyId: string;
  amount: number;
  invoiceNumber: string;
  dueDate: Date;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface FolioResponse {
  reservationId: string;
  guestName: string;
  roomNumber: string | null;
  status: string;

  summary: {
    openingBalance: number;
    chargesTotal: number;
    paymentsTotal: number;
    balance: number;
    pendingAuthorizations: number;
  };

  charges: Array<{
    id: string;
    itemType: FolioItemType;
    description: string;
    amount: number;
    taxAmount: number;
    total: number;
    quantity: number;
    unitPrice: number;
    postedAt: Date;
    postedBy: string;
    isVoided: boolean;
    voidInfo?: {
      voidedAt: Date;
      voidedBy: string;
      reason: string;
    };
    source?: string;
  }>;

  payments: Array<{
    id: string;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    cardInfo?: {
      lastFour: string;
      brand: string;
    };
    processedAt: Date | null;
    isRefund: boolean;
  }>;

  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    total: number;
    amountPaid: number;
    balance: number;
    dueDate: Date;
  }>;
}

export interface PaymentResponse {
  id: string;
  amount: number;
  currencyCode: string;
  method: PaymentMethod;
  status: PaymentStatus;
  cardInfo?: {
    lastFour: string;
    brand: string;
  };
  transactionId: string | null;
  authCode: string | null;
  processedAt: Date | null;
  isRefund: boolean;
  parentPaymentId: string | null;
  notes: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: InvoiceStatus;

  amounts: {
    subtotal: number;
    taxTotal: number;
    total: number;
    amountPaid: number;
    balance: number;
  };

  billing: {
    name: string;
    address: BillingAddress;
  };

  items: Array<{
    folioItemId: string;
    description: string;
    amount: number;
    postedAt: Date;
  }>;

  documentUrl: string | null;
  sentAt: Date | null;
  paidAt: Date | null;

  createdAt: Date;
}

export interface FinancialSummary {
  reservationId: string;
  businessDate: Date;

  revenue: {
    roomRevenue: number;
    posRevenue: number;
    otherRevenue: number;
    taxTotal: number;
    grossTotal: number;
  };

  payments: {
    cash: number;
    creditCard: number;
    debitCard: number;
    other: number;
    total: number;
  };

  balance: {
    guest: number; // Guest owes
    hotel: number; // Hotel owes (credit)
    net: number;
  };
}

export interface CityLedgerEntry {
  id: string;
  companyId: string;
  companyName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  paidAmount: number;
  createdAt: Date;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface FolioQueryFilters {
  businessDateFrom?: Date;
  businessDateTo?: Date;
  itemTypes?: FolioItemType[];
  departments?: string[];
  includeVoided?: boolean;
}

export interface PaymentQueryFilters {
  methods?: PaymentMethod[];
  statuses?: PaymentStatus[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface RevenueReportQuery {
  businessDateFrom: Date;
  businessDateTo: Date;
  groupBy?: 'DAY' | 'DEPARTMENT' | 'REVENUE_CODE';
}
