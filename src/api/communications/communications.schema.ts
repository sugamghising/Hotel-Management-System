import { z } from 'zod';

// ============================================================================
// ENUM SCHEMAS (matching Prisma enums)
// ============================================================================

export const CommunicationTypeSchema = z.enum([
  'RESERVATION_CONFIRMATION',
  'CHECKIN_REMINDER',
  'CHECKOUT_REMINDER',
  'MODIFICATION',
  'CANCELLATION',
  'WELCOME',
  'SURVEY',
  'MARKETING',
  'ALERT',
]);

export const CommunicationChannelSchema = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']);

export const CommunicationStatusSchema = z.enum([
  'PENDING',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'FAILED',
  'BOUNCED',
]);

export const BulkTypeSchema = z.enum(['MARKETING', 'ALERT']);

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid('Invalid hotel ID'),
});

export const CommunicationIdParamSchema = z.object({
  communicationId: z.string().uuid('Invalid communication ID'),
});

export const TemplateIdParamSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
});

export const ReservationIdParamSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
});

export const ReservationCommunicationParamsSchema =
  OrganizationIdParamSchema.merge(HotelIdParamSchema).merge(ReservationIdParamSchema);

// ============================================================================
// SEND COMMUNICATION SCHEMA
// ============================================================================

export const SendCommunicationSchema = z
  .object({
    channel: CommunicationChannelSchema,
    type: CommunicationTypeSchema,
    guestId: z.string().uuid('Invalid guest ID').optional(),
    reservationId: z.string().uuid('Invalid reservation ID').optional(),
    templateId: z.string().uuid('Invalid template ID').optional(),
    subject: z.string().max(255, 'Subject must be 255 characters or less').optional(),
    content: z.string().max(10000, 'Content must be 10000 characters or less').optional(),
  })
  .refine((data) => data.guestId || data.reservationId, {
    message: 'At least one of guestId or reservationId must be provided',
    path: ['guestId'],
  })
  .refine((data) => data.templateId || data.content, {
    message: 'Either templateId or content must be provided',
    path: ['content'],
  })
  .refine(
    (data) => {
      // If channel is EMAIL and no templateId, subject is required
      if (data.channel === 'EMAIL' && !data.templateId && !data.subject) {
        return false;
      }
      return true;
    },
    {
      message: 'Subject is required for EMAIL when not using a template',
      path: ['subject'],
    }
  );

// ============================================================================
// BULK SEND SCHEMA
// ============================================================================

export const BulkSendSchema = z
  .object({
    guestIds: z
      .array(z.string().uuid('Invalid guest ID'))
      .min(1, 'At least one guest is required')
      .max(500, 'Maximum 500 guests per bulk send'),
    channel: CommunicationChannelSchema,
    type: BulkTypeSchema,
    templateId: z.string().uuid('Invalid template ID'),
  })
  .refine((data) => ['MARKETING', 'ALERT'].includes(data.type), {
    message: 'Bulk send is only allowed for MARKETING or ALERT types',
    path: ['type'],
  });

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

export const CreateTemplateSchema = z
  .object({
    code: z
      .string()
      .min(2, 'Code must be at least 2 characters')
      .max(100, 'Code must be 100 characters or less')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Code must be alphanumeric with underscores or hyphens'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(255, 'Name must be 255 characters or less'),
    type: CommunicationTypeSchema,
    channel: CommunicationChannelSchema,
    language: z.string().length(2, 'Language code must be exactly 2 characters').default('en'),
    subject: z.string().max(255, 'Subject must be 255 characters or less').optional(),
    bodyTemplate: z
      .string()
      .min(10, 'Body template must be at least 10 characters')
      .max(10000, 'Body template must be 10000 characters or less'),
    hotelId: z.string().uuid('Invalid hotel ID').optional(),
  })
  .refine(
    (data) => {
      // Subject required for EMAIL channel
      if (data.channel === 'EMAIL' && !data.subject) {
        return false;
      }
      return true;
    },
    {
      message: 'Subject is required for EMAIL channel',
      path: ['subject'],
    }
  );

export const UpdateTemplateSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be 255 characters or less')
    .optional(),
  subject: z.string().max(255, 'Subject must be 255 characters or less').optional(),
  bodyTemplate: z
    .string()
    .min(10, 'Body template must be at least 10 characters')
    .max(10000, 'Body template must be 10000 characters or less')
    .optional(),
  language: z.string().length(2, 'Language code must be exactly 2 characters').optional(),
  isActive: z.boolean().optional(),
});

export const PreviewTemplateSchema = z.object({
  context: z
    .object({
      guest: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          mobile: z.string().optional(),
          languageCode: z.string().optional(),
        })
        .optional(),
      reservation: z
        .object({
          confirmationNumber: z.string().optional(),
          checkInDate: z.string().optional(),
          checkOutDate: z.string().optional(),
          nights: z.number().optional(),
          totalAmount: z.string().optional(),
          currencyCode: z.string().optional(),
          specialRequests: z.string().optional(),
        })
        .optional(),
      room: z
        .object({
          number: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),
      hotel: z
        .object({
          name: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const CommunicationQuerySchema = z.object({
  guestId: z.string().uuid('Invalid guest ID').optional(),
  reservationId: z.string().uuid('Invalid reservation ID').optional(),
  type: CommunicationTypeSchema.optional(),
  channel: CommunicationChannelSchema.optional(),
  status: CommunicationStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const TemplateQuerySchema = z.object({
  type: CommunicationTypeSchema.optional(),
  channel: CommunicationChannelSchema.optional(),
  language: z.string().length(2).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  hotelId: z.string().uuid('Invalid hotel ID').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const AnalyticsQuerySchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  channel: CommunicationChannelSchema.optional(),
  type: CommunicationTypeSchema.optional(),
  hotelId: z.string().uuid('Invalid hotel ID').optional(),
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

// Webhook schemas are intentionally lenient: validation errors on incoming
// provider webhooks must not cause 4xx responses that trigger aggressive
// provider retries. All fields are accepted as optional strings/unknowns
// and extra fields pass through freely.

export const EmailWebhookSchema = z
  .object({
    // Generic schema - actual structure depends on provider
    // Providers: SendGrid, SES, Mailgun, Postmark, etc.
    externalId: z.string().optional(),
    event: z.string().optional(),
    timestamp: z.unknown().optional(),
    email: z.string().optional(),
    reason: z.string().optional(),
    // Allow additional provider-specific fields
  })
  .passthrough();

export const SmsWebhookSchema = z
  .object({
    // Generic schema - actual structure depends on provider
    // Providers: Twilio, Nexmo, MessageBird, etc.
    externalId: z.string().optional(),
    status: z.string().optional(),
    timestamp: z.unknown().optional(),
    phoneNumber: z.string().optional(),
    errorCode: z.string().optional(),
    // Allow additional provider-specific fields
  })
  .passthrough();

// ============================================================================
// RESERVATION SEND SCHEMAS (for specific communication types)
// ============================================================================

export const ReservationSendSchema = z.object({
  channel: CommunicationChannelSchema.optional(), // Uses guest's preferred channel if not specified
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SendCommunicationInput = z.infer<typeof SendCommunicationSchema>;
export type BulkSendInput = z.infer<typeof BulkSendSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof PreviewTemplateSchema>;
export type CommunicationQueryInput = z.infer<typeof CommunicationQuerySchema>;
export type TemplateQueryInput = z.infer<typeof TemplateQuerySchema>;
export type AnalyticsQueryInput = z.infer<typeof AnalyticsQuerySchema>;
export type ReservationSendInput = z.infer<typeof ReservationSendSchema>;
