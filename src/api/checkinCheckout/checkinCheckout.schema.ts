import { z } from 'zod';
import { PaymentMethodSchema } from '../folio/folio.schema';

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const ReservationIdParamSchema = z.object({
  reservationId: z.string().uuid(),
});

export const CheckInRequestSchema = z.object({
  roomId: z.string().uuid().optional(),
  earlyCheckIn: z.boolean().optional(),
  idDocumentId: z.string().uuid().optional(),
  cardToken: z.string().optional(),
  cardLastFour: z.string().length(4).optional(),
  cardBrand: z.string().max(20).optional(),
  keysIssued: z.number().int().min(1).max(8).optional(),
  keyCardRef: z.string().max(100).optional(),
  checkInNotes: z.string().max(2000).optional(),
});

export const EarlyCheckInSchema = CheckInRequestSchema.extend({
  earlyFeeAmount: z.number().min(0).optional(),
  earlyFeeReason: z.string().max(500).optional(),
});

export const WalkInCheckInSchema = z.object({
  guestId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  checkOutDate: z.coerce.date(),
  adultCount: z.number().int().min(1).default(2),
  childCount: z.number().int().min(0).default(0),
  infantCount: z.number().int().min(0).default(0),
  paymentMethod: z.string(),
  initialPayment: z.number().positive(),
  cardToken: z.string().optional(),
  cardLastFour: z.string().length(4).optional(),
  cardBrand: z.string().max(20).optional(),
  guestNotes: z.string().max(2000).optional(),
  specialRequests: z.string().max(2000).optional(),
});

export const AssignRoomSchema = z.object({
  roomId: z.string().uuid(),
  force: z.boolean().default(false),
});

export const AutoAssignRoomSchema = z.object({
  force: z.boolean().default(false),
});

export const UpgradeRoomSchema = z.object({
  roomId: z.string().uuid(),
  upgradeReason: z.string().max(500).optional(),
  upgradeFee: z.number().min(0).optional(),
});

export const ChangeRoomSchema = z.object({
  roomId: z.string().uuid(),
  changeReason: z.string().max(500).optional(),
});

export const CheckoutSchema = z.object({
  capturePreAuth: z.boolean().default(true),
  paymentMethod: PaymentMethodSchema.optional(),
  cardToken: z.string().optional(),
  invoiceEmail: z.string().email().optional(),
  keysReturned: z.number().int().min(0).optional(),
  satisfactionScore: z.number().int().min(1).max(5).optional(),
  checkOutNotes: z.string().max(2000).optional(),
});

export const ExpressCheckoutSchema = z.object({
  paymentMethod: PaymentMethodSchema.optional(),
  cardToken: z.string().optional(),
  invoiceEmail: z.string().email().optional(),
});

export const LateCheckoutSchema = z.object({
  extraHours: z.number().int().min(1).max(24),
  applyFee: z.boolean().default(true),
  feeAmount: z.number().min(0).optional(),
  reason: z.string().max(500).optional(),
});

export const NoShowSchema = z.object({
  reason: z.string().max(1000).optional(),
  chargeNoShowFee: z.boolean().default(true),
});

export const ReinstateSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const ExtendStaySchema = z.object({
  newCheckOutDate: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export const ShortenStaySchema = z.object({
  newCheckOutDate: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export type CheckInRequestInput = z.infer<typeof CheckInRequestSchema>;
export type EarlyCheckInInput = z.infer<typeof EarlyCheckInSchema>;
export type WalkInCheckInInput = z.infer<typeof WalkInCheckInSchema>;
export type AssignRoomInput = z.infer<typeof AssignRoomSchema>;
export type AutoAssignRoomInput = z.infer<typeof AutoAssignRoomSchema>;
export type UpgradeRoomInput = z.infer<typeof UpgradeRoomSchema>;
export type ChangeRoomInput = z.infer<typeof ChangeRoomSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type ExpressCheckoutInput = z.infer<typeof ExpressCheckoutSchema>;
export type LateCheckoutInput = z.infer<typeof LateCheckoutSchema>;
export type NoShowInput = z.infer<typeof NoShowSchema>;
export type ReinstateInput = z.infer<typeof ReinstateSchema>;
export type ExtendStayInput = z.infer<typeof ExtendStaySchema>;
export type ShortenStayInput = z.infer<typeof ShortenStaySchema>;
