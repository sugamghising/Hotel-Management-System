import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const EmailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .trim();

export const PhoneSchema = z.string().max(50, 'Phone number too long');

export const UserStatusSchema = z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const EmploymentTypeSchema = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']);
// ============================================================================
// USER SCHEMAS
// ============================================================================

export const CreateUserSchema = z.object({
  email: EmailSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  middleName: z.string().max(100).optional(),
  phone: PhoneSchema.optional(),
  employeeId: z.string().max(50).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  employmentType: EmploymentTypeSchema.optional(),
  hireDate: z.coerce.date().optional(),
  managerId: z.string().uuid().optional(),
  languageCode: z.string().length(2).default('en'),
  timezone: z.string().default('UTC'),
});

export const UpdateUserSchema = z.object({
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  middleName: z.string().max(100).optional(),
  phone: PhoneSchema.optional(),
  employeeId: z.string().max(50).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  employmentType: EmploymentTypeSchema.optional(),
  hireDate: z.coerce.date().optional(),
  terminationDate: z.coerce.date().optional(),
  managerId: z.string().uuid().optional(),
  status: UserStatusSchema.optional(),
  languageCode: z.string().length(2).optional(),
  timezone: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const UserQuerySchema = z.object({
  page: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v ? Number(v) : 1)),
  limit: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v ? Number(v) : 10)),
  search: z.string().optional(),
  status: UserStatusSchema.optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  managerId: z.string().uuid().optional(),
});

// ============================================================================
// ROLE ASSIGNMENT SCHEMAS
// ============================================================================

export const AssignRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  hotelId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const RemoveRoleSchema = z.object({
  roleAssignmentId: z.string().uuid('Invalid role assignment ID'),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const UserIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserQueryInput = z.infer<typeof UserQuerySchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
export type RemoveRoleInput = z.infer<typeof RemoveRoleSchema>;
