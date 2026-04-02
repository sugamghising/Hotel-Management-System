import { z } from 'zod';

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid('Invalid hotel ID'),
});

export const ConnectionIdParamSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
});

export const ChannelCodeParamSchema = z.object({
  channelCode: z.string().min(2).max(50),
});

export const CreateConnectionSchema = z.object({
  channelCode: z.string().min(2).max(50),
  channelName: z.string().min(2).max(100),
  apiKey: z.string().max(255).optional(),
  apiSecret: z.string().max(255).optional(),
  propertyId: z.string().max(100).optional(),
});

export const UpdateConnectionSchema = z.object({
  channelName: z.string().max(100).optional(),
  apiKey: z.string().max(255).optional(),
  apiSecret: z.string().max(255).optional(),
  propertyId: z.string().max(100).optional(),
});

const RoomMappingSchema = z.object({
  internalRoomTypeId: z.string().uuid('Invalid room type ID'),
  externalRoomTypeCode: z.string().min(1).max(100),
});

export const MapRoomsSchema = z
  .object({
    mappings: z.array(RoomMappingSchema).min(1),
  })
  .refine(
    (data) => new Set(data.mappings.map((m) => m.internalRoomTypeId)).size === data.mappings.length,
    {
      message: 'Duplicate internalRoomTypeId values are not allowed',
      path: ['mappings'],
    }
  )
  .refine(
    (data) =>
      new Set(data.mappings.map((m) => m.externalRoomTypeCode.toUpperCase())).size ===
      data.mappings.length,
    {
      message: 'Duplicate externalRoomTypeCode values are not allowed',
      path: ['mappings'],
    }
  );

const RateMappingSchema = z.object({
  internalRatePlanId: z.string().uuid('Invalid rate plan ID'),
  externalRatePlanCode: z.string().min(1).max(100),
  markup: z.number().min(-50).max(200).optional(),
});

export const MapRatesSchema = z
  .object({
    mappings: z.array(RateMappingSchema).min(1),
  })
  .refine(
    (data) => new Set(data.mappings.map((m) => m.internalRatePlanId)).size === data.mappings.length,
    {
      message: 'Duplicate internalRatePlanId values are not allowed',
      path: ['mappings'],
    }
  );

export const SyncSchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: 'dateTo must be greater than or equal to dateFrom',
    path: ['dateTo'],
  })
  .refine(
    (data) => {
      const ms = data.dateTo.getTime() - data.dateFrom.getTime();
      const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
      return days <= 365;
    },
    {
      message: 'Date range cannot exceed 365 days',
      path: ['dateTo'],
    }
  );

export const SyncAllSchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});

export const SyncLogQuerySchema = z.object({
  syncType: z.string().max(50).optional(),
  status: z.string().max(20).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const ChannelWebhookSchema = z
  .object({
    hotelId: z.string().uuid('Invalid hotel ID').optional(),
  })
  .passthrough();

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;
export type MapRoomsInput = z.infer<typeof MapRoomsSchema>;
export type MapRatesInput = z.infer<typeof MapRatesSchema>;
export type SyncInput = z.infer<typeof SyncSchema>;
export type SyncAllInput = z.infer<typeof SyncAllSchema>;
export type SyncLogQueryInput = z.infer<typeof SyncLogQuerySchema>;
