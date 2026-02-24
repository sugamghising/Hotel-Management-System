import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const RoomTypeCodeSchema = z
  .string()
  .min(2, 'Room type code must be at least 2 characters')
  .max(20, 'Room type code must not exceed 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, and underscores')
  .transform((val) => val.toUpperCase());

export const BedTypeSchema = z.enum([
  'SINGLE',
  'DOUBLE',
  'QUEEN',
  'KING',
  'TWIN',
  'BUNK',
  'SOFA_BED',
  'CRIB',
]);

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
]);

export const AmenitySchema = z.enum([
  'WIFI',
  'TV',
  'CABLE',
  'NETFLIX',
  'MINIBAR',
  'SAFE',
  'AC',
  'HEATING',
  'BALCONY',
  'TERRACE',
  'BATHTUB',
  'SHOWER',
  'HAIR_DRYER',
  'IRON',
  'DESK',
  'WARDROBE',
  'SOUNDPROOF',
  'BLACKOUT_CURTAINS',
  'COFFEE_MACHINE',
  'KETTLE',
  'MICROWAVE',
  'REFRIGERATOR',
  'KITCHENETTE',
  'SOFA',
  'ARMCHAIR',
]);

// ============================================================================
// CREATE ROOM TYPE SCHEMA
// ============================================================================

export const CreateRoomTypeSchema = z
  .object({
    code: RoomTypeCodeSchema,
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),

    // Capacity validation: base <= max, adults + children <= max
    baseOccupancy: z.number().int().min(1).default(2),
    maxOccupancy: z.number().int().min(1).max(10),
    maxAdults: z.number().int().min(1).default(2),
    maxChildren: z.number().int().min(0).default(0),

    // Physical
    sizeSqm: z.number().positive().max(500).optional(),
    sizeSqft: z.number().positive().max(5000).optional(),
    bedTypes: z.array(BedTypeSchema).min(1, 'At least one bed type required'),

    // Features
    amenities: z.array(z.string()).default([]),
    viewType: ViewTypeSchema.optional(),

    // Housekeeping
    defaultCleaningTime: z.number().int().min(5).max(180).default(30),

    // Media
    images: z
      .array(
        z.object({
          url: z.string().url(),
          caption: z.string().max(200).optional(),
          order: z.number().int().min(0).default(0),
          isPrimary: z.boolean().default(false),
        })
      )
      .default([]),

    // Settings
    isActive: z.boolean().default(true),
    isBookable: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
  })
  .refine((data) => data.baseOccupancy <= data.maxOccupancy, {
    message: 'Base occupancy cannot exceed max occupancy',
    path: ['baseOccupancy'],
  })
  .refine((data) => data.maxAdults + data.maxChildren <= data.maxOccupancy, {
    message: 'Max adults + max children cannot exceed max occupancy',
    path: ['maxChildren'],
  });

// ============================================================================
// UPDATE ROOM TYPE SCHEMA
// ============================================================================

export const UpdateRoomTypeSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(1000).optional().nullable(),

    baseOccupancy: z.number().int().min(1).optional(),
    maxOccupancy: z.number().int().min(1).max(10).optional(),
    maxAdults: z.number().int().min(1).optional(),
    maxChildren: z.number().int().min(0).optional(),

    sizeSqm: z.number().positive().max(500).optional().nullable(),
    sizeSqft: z.number().positive().max(5000).optional().nullable(),
    bedTypes: z.array(BedTypeSchema).min(1).optional(),

    amenities: z.array(z.string()).optional(),
    viewType: ViewTypeSchema.optional().nullable(),

    defaultCleaningTime: z.number().int().min(5).max(180).optional(),

    isActive: z.boolean().optional(),
    isBookable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.baseOccupancy && data.maxOccupancy) {
        return data.baseOccupancy <= data.maxOccupancy;
      }
      return true;
    },
    {
      message: 'Base occupancy cannot exceed max occupancy',
      path: ['baseOccupancy'],
    }
  )
  .refine(
    (data) => {
      if (data.maxAdults !== undefined && data.maxChildren !== undefined && data.maxOccupancy) {
        return data.maxAdults + data.maxChildren <= data.maxOccupancy;
      }
      return true;
    },
    {
      message: 'Max adults + max children cannot exceed max occupancy',
      path: ['maxChildren'],
    }
  );

// ============================================================================
// INVENTORY SCHEMAS
// ============================================================================

export const RoomTypeInventorySchema = z.object({
  date: z.coerce.date(),
  totalRooms: z.number().int().min(0).optional(),
  outOfOrder: z.number().int().min(0).default(0),
  blocked: z.number().int().min(0).default(0),
  overbookingLimit: z.number().int().min(0).default(0),
  stopSell: z.boolean().default(false),
  minStay: z.number().int().min(1).optional().nullable(),
  maxStay: z.number().int().min(1).optional().nullable(),
  closedToArrival: z.boolean().default(false),
  closedToDeparture: z.boolean().default(false),
  rateOverride: z.number().positive().optional().nullable(),
  reason: z.string().max(255).optional(),
});

export const RoomTypeInventoryBulkSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    updates: z.object({
      totalRooms: z.number().int().min(0).optional(),
      outOfOrder: z.number().int().min(0).optional(),
      blocked: z.number().int().min(0).optional(),
      overbookingLimit: z.number().int().min(0).optional(),
      stopSell: z.boolean().optional(),
      minStay: z.number().int().min(1).optional().nullable(),
      maxStay: z.number().int().min(1).optional().nullable(),
      closedToArrival: z.boolean().optional(),
      closedToDeparture: z.boolean().optional(),
      rateOverride: z.number().positive().optional().nullable(),
      reason: z.string().max(255).optional(),
    }),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(), // Sunday = 0
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  });

// ============================================================================
// IMAGE SCHEMAS
// ============================================================================

export const AddImageSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(200).optional(),
  order: z.number().int().min(0).optional(),
  isPrimary: z.boolean().default(false),
});

// ============================================================================
// PARAM & QUERY SCHEMAS
// ============================================================================

export const RoomTypeIdParamSchema = z.object({
  roomTypeId: z.string().uuid(),
});

export const HotelIdParamSchema = z.object({
  hotelId: z.string().uuid(),
});

export const OrganizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export const RoomTypeQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  isBookable: z.coerce.boolean().optional(),
  viewType: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const InventoryQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateRoomTypeInput = z.infer<typeof CreateRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof UpdateRoomTypeSchema>;
export type RoomTypeInventoryInput = z.infer<typeof RoomTypeInventorySchema>;
export type RoomTypeInventoryBulkInput = z.infer<typeof RoomTypeInventoryBulkSchema>;
export type AddImageInput = z.infer<typeof AddImageSchema>;
export type RoomTypeQueryInput = z.infer<typeof RoomTypeQuerySchema>;
export type InventoryQueryInput = z.infer<typeof InventoryQuerySchema>;
