import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const RoomNumberSchema = z
  .string()
  .min(1, 'Room number is required')
  .max(20, 'Room number must not exceed 20 characters')
  .regex(/^[^\\s]+$/, 'Room number cannot contain spaces');

export const RoomStatusSchema = z.enum([
  'VACANT_CLEAN',
  'VACANT_DIRTY',
  'VACANT_CLEANING',
  'OCCUPIED_CLEAN',
  'OCCUPIED_DIRTY',
  'OCCUPIED_CLEANING',
  'OUT_OF_ORDER',
  'RESERVED',
  'BLOCKED',
]);

export const MaintenanceStatusSchema = z.enum(['NONE', 'SCHEDULED', 'IN_PROGRESS', 'URGENT']);

export const ViewTypeSchema = z.enum([
  'CITY',
  'GARDEN',
  'POOL',
  'OCEAN',
  'MOUNTAIN',
  'COURTYARD',
  'STREET',
  'INTERIOR',
  'PANORAMIC',
  'PARKING',
]);

// ============================================================================
// CREATE ROOM SCHEMA
// ============================================================================

export const CreateRoomSchema = z
  .object({
    roomNumber: RoomNumberSchema,
    roomTypeId: z.string().uuid('Invalid room type ID'),

    floor: z.number().int().optional().nullable(),
    building: z.string().max(50).optional(),
    wing: z.string().max(50).optional(),

    isSmoking: z.boolean().default(false),
    isAccessible: z.boolean().default(false),
    viewType: ViewTypeSchema.optional(),

    rackRate: z.number().positive().optional().nullable(),

    status: RoomStatusSchema.default('VACANT_CLEAN'),
  })
  .refine((data) => {
    // Validate status consistency
    if (data.status === 'OUT_OF_ORDER' && !data.isAccessible) {
      // OK - can be OOO for any reason
    }
    return true;
  });

// ============================================================================
// UPDATE ROOM SCHEMA
// ============================================================================

export const UpdateRoomSchema = z.object({
  roomNumber: RoomNumberSchema.optional(),
  roomTypeId: z.string().uuid().optional(),

  floor: z.number().int().optional().nullable(),
  building: z.string().max(50).optional().nullable(),
  wing: z.string().max(50).optional().nullable(),

  isSmoking: z.boolean().optional(),
  isAccessible: z.boolean().optional(),
  viewType: ViewTypeSchema.optional().nullable(),

  rackRate: z.number().positive().optional().nullable(),
});

// ============================================================================
// STATUS UPDATE SCHEMAS
// ============================================================================

export const UpdateRoomStatusSchema = z.object({
  status: RoomStatusSchema,
  reason: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(2).optional(),
});

export const SetOutOfOrderSchema = z
  .object({
    reason: z.string().min(1).max(500),
    from: z.coerce.date(),
    until: z.coerce.date(),
    maintenanceRequired: z.boolean().default(false),
  })
  .refine((data) => data.until > data.from, {
    message: 'End date must be after start date',
    path: ['until'],
  });

export const RemoveOutOfOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export const BulkStatusUpdateSchema = z.object({
  roomIds: z.array(z.string().uuid()).min(1, 'At least one room required'),
  status: RoomStatusSchema,
  reason: z.string().max(500).optional(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const RoomQuerySchema = z.object({
  status: RoomStatusSchema.optional(),
  roomTypeId: z.string().uuid().optional(),
  floor: z.coerce.number().int().optional(),
  building: z.string().optional(),
  isOutOfOrder: z.coerce.boolean().optional(),
  viewType: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const RoomIdParamSchema = z.object({
  roomId: z.string().uuid(),
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

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof UpdateRoomStatusSchema>;
export type SetOutOfOrderInput = z.infer<typeof SetOutOfOrderSchema>;
export type BulkStatusUpdateInput = z.infer<typeof BulkStatusUpdateSchema>;
export type RoomQueryInput = z.infer<typeof RoomQuerySchema>;
