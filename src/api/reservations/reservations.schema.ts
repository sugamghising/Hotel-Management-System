// src/features/reservations/reservations.schema.ts

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const ConfirmationNumberSchema = z
  .string()
  .min(6)
  .max(20)
  .regex(/^[A-Z0-9]+$/, 'Confirmation number must be alphanumeric uppercase');

export const BookingSourceSchema = z.enum([
  'DIRECT_WEB',
  'DIRECT_PHONE',
  'DIRECT_WALKIN',
  'BOOKING_COM',
  'EXPEDIA',
  'AIRBNB',
  'AGODA',
  'TRIPADVISOR',
  'CORPORATE',
  'TRAVEL_AGENT',
  'METASEARCH',
]);

export const GuaranteeTypeSchema = z.enum([
  'CREDIT_CARD',
  'DEPOSIT',
  'COMPANY_BILL',
  'TRAVEL_AGENT',
  'NONE',
]);

export const CancellationPolicySchema = z.enum([
  'FLEXIBLE',
  'MODERATE',
  'STRICT',
  'NON_REFUNDABLE',
]);

export const TimeStringSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format');

// ============================================================================
// CREATE RESERVATION SCHEMA
// ============================================================================

export const CreateReservationBaseSchema = z.object({
  guestId: z.string().uuid('Invalid guest ID'),

  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  arrivalTime: TimeStringSchema.optional(),
  departureTime: TimeStringSchema.optional(),

  adultCount: z.number().int().min(1).default(2),
  childCount: z.number().int().min(0).default(0),
  infantCount: z.number().int().min(0).default(0),

  roomTypeId: z.string().uuid('Invalid room type ID'),
  roomId: z.string().uuid().optional(),
  ratePlanId: z.string().uuid('Invalid rate plan ID'),

  source: BookingSourceSchema.default('DIRECT_WEB'),
  channelCode: z.string().max(50).optional(),
  corporateCode: z.string().max(50).optional(),

  guaranteeType: GuaranteeTypeSchema.default('CREDIT_CARD'),
  guaranteeAmount: z.number().positive().optional(),
  cardToken: z.string().optional(),
  cardLastFour: z.string().length(4).optional(),
  cardExpiryMonth: z.string().length(2).optional(),
  cardExpiryYear: z.string().length(4).optional(),
  cardBrand: z.string().max(20).optional(),

  guestNotes: z.string().max(2000).optional(),
  specialRequests: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),

  isWalkIn: z.boolean().default(false),
});

export const CreateReservationSchema = CreateReservationBaseSchema.refine(
  (data) => data.checkOutDate > data.checkInDate,
  {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  }
).refine(
  (data) => {
    // Max 365 nights
    const nights = Math.ceil(
      (data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return nights <= 365;
  },
  {
    message: 'Maximum stay is 365 nights',
    path: ['checkOutDate'],
  }
);

// ============================================================================
// UPDATE RESERVATION SCHEMA
// ============================================================================

export const UpdateReservationSchema = z
  .object({
    checkInDate: z.coerce.date().optional(),
    checkOutDate: z.coerce.date().optional(),
    arrivalTime: TimeStringSchema.optional().nullable(),
    departureTime: TimeStringSchema.optional().nullable(),

    adultCount: z.number().int().min(1).optional(),
    childCount: z.number().int().min(0).optional(),
    infantCount: z.number().int().min(0).optional(),

    guestNotes: z.string().max(2000).optional().nullable(),
    specialRequests: z.string().max(2000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.checkInDate && data.checkOutDate) {
        return data.checkOutDate > data.checkInDate;
      }
      return true;
    },
    {
      message: 'Check-out must be after check-in',
      path: ['checkOutDate'],
    }
  );

// ============================================================================
// CHECK-IN/OUT SCHEMAS
// ============================================================================

export const CheckInSchema = z.object({
  roomId: z.string().uuid().optional(),
  earlyCheckIn: z.boolean().default(false),
  idVerification: z
    .object({
      idType: z.string(),
      idNumber: z.string(),
      idExpiryDate: z.coerce.date().optional(),
    })
    .optional(),
  paymentAuth: z
    .object({
      amount: z.number().positive(),
      method: z.string(),
    })
    .optional(),
});

export const CheckOutSchema = z.object({
  lateCheckOut: z.boolean().default(false),
  payment: z
    .object({
      amount: z.number().positive(),
      method: z.string(),
    })
    .optional(),
});

// ============================================================================
// ROOM ASSIGNMENT SCHEMA
// ============================================================================

export const RoomAssignmentSchema = z.object({
  roomId: z.string().uuid(),
  force: z.boolean().default(false),
});

// ============================================================================
// CANCELLATION SCHEMA
// ============================================================================

export const CancellationSchema = z.object({
  reason: z.string().min(1).max(500),
  waiveFee: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// NO-SHOW SCHEMA
// ============================================================================

export const NoShowSchema = z.object({
  chargeNoShowFee: z.boolean().default(true),
  waiveReason: z.string().max(500).optional(),
});

// ============================================================================
// WALK-IN SCHEMA
// ============================================================================

export const WalkInSchema = CreateReservationBaseSchema.extend({
  roomId: z.string().uuid('Room ID is required for walk-in'),
  paymentMethod: z.string(),
  initialPayment: z.number().positive(),
});

// ============================================================================
// SPLIT/MERGE SCHEMAS
// ============================================================================

export const SplitReservationSchema = z.object({
  splitDate: z.coerce.date(),
  newRoomTypeId: z.string().uuid().optional(),
});

export const MergeReservationsSchema = z
  .object({
    sourceReservationId: z.string().uuid(),
    targetReservationId: z.string().uuid(),
  })
  .refine((data) => data.sourceReservationId !== data.targetReservationId, {
    message: 'Cannot merge reservation with itself',
  });

// ============================================================================
// SEARCH SCHEMA
// ============================================================================

export const ReservationSearchSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'WAITLIST'])
    .optional(),
  checkInFrom: z.coerce.date().optional(),
  checkInTo: z.coerce.date().optional(),
  checkOutFrom: z.coerce.date().optional(),
  checkOutTo: z.coerce.date().optional(),
  guestName: z.string().optional(),
  confirmationNumber: z.string().optional(),
  roomNumber: z.string().optional(),
  bookingSource: BookingSourceSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const ReservationIdParamSchema = z.object({
  reservationId: z.string().uuid(),
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

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
export type CheckOutInput = z.infer<typeof CheckOutSchema>;
export type RoomAssignmentInput = z.infer<typeof RoomAssignmentSchema>;
export type CancellationInput = z.infer<typeof CancellationSchema>;
export type NoShowInput = z.infer<typeof NoShowSchema>;
export type WalkInInput = z.infer<typeof WalkInSchema>;
export type SplitReservationInput = z.infer<typeof SplitReservationSchema>;
export type MergeReservationsInput = z.infer<typeof MergeReservationsSchema>;
export type ReservationSearchInput = z.infer<typeof ReservationSearchSchema>;
