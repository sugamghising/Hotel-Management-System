import { z } from 'zod';

export const OrganizationCreateSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  legalName: z.string().min(2).max(255),
  taxId: z.string().max(100).optional(),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  organizationType: z.enum(['CHAIN', 'INDEPENDENT']).default('INDEPENDENT'),
  maxHotels: z.number().int().positive().default(1),
  maxRooms: z.number().int().positive().default(50),
  maxUsers: z.number().int().positive().default(10),
  settings: z.record(z.unknown()).default({}),
});

export const OrganizationUpdateSchema = OrganizationCreateSchema.partial().omit({
  code: true,
});

export const OrganizationQuerySchema = z.object({
  page: z.string().optional().transform(Number).default('1'),
  limit: z.string().optional().transform(Number).default('10'),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']).optional(),
  type: z.enum(['CHAIN', 'INDEPENDENT']).optional(),
});

export type OrganizationCreateDTO = z.infer<typeof OrganizationCreateSchema>;
export type OrganizationUpdateDTO = z.infer<typeof OrganizationUpdateSchema>;
export type OrganizationQueryDTO = z.infer<typeof OrganizationQuerySchema>;
