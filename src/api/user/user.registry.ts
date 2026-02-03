import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { StatusCodes } from 'http-status-codes';

// ============ Zod Schemas with OpenAPI metadata ============

export const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('User');

export const CreateUserSchema = z
  .object({
    email: z.string().email('Invalid email format'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
  })
  .openapi('CreateUserInput');

export const UpdateUserSchema = z
  .object({
    email: z.string().email('Invalid email format').optional(),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters')
      .optional(),
  })
  .openapi('UpdateUserInput');

export const UserIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid user ID format'),
  })
  .openapi('UserIdParam');

export const ListUsersQuerySchema = z
  .object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
  })
  .openapi('ListUsersQuery');

export const DeleteResponseSchema = z
  .object({
    deleted: z.boolean(),
  })
  .openapi('DeleteResponse');

export const PaginatedUsersSchema = z
  .object({
    items: z.array(UserSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi('PaginatedUsers');

// ============ OpenAPI Registry ============

export const userRegistry = new OpenAPIRegistry();

// Register schemas
userRegistry.register('User', UserSchema);
userRegistry.register('CreateUserInput', CreateUserSchema);
userRegistry.register('UpdateUserInput', UpdateUserSchema);

// GET /api/v1/users - List users
userRegistry.registerPath({
  method: 'get',
  path: '/api/v1/users',
  tags: ['Users'],
  summary: 'Get all users',
  description: 'Retrieve a paginated list of all users',
  request: {
    query: ListUsersQuerySchema,
  },
  responses: createApiResponse(PaginatedUsersSchema, 'List of users'),
});

// GET /api/v1/users/{id} - Get user by ID
userRegistry.registerPath({
  method: 'get',
  path: '/api/v1/users/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  description: 'Retrieve a single user by their ID',
  request: {
    params: UserIdParamSchema,
  },
  responses: {
    ...createApiResponse(UserSchema, 'User found'),
    ...createApiResponse(z.null(), 'User not found', StatusCodes.NOT_FOUND),
  },
});

// POST /api/v1/users - Create user
userRegistry.registerPath({
  method: 'post',
  path: '/api/v1/users',
  tags: ['Users'],
  summary: 'Create a new user',
  description: 'Create a new user with email and name',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserSchema,
        },
      },
    },
  },
  responses: {
    ...createApiResponse(UserSchema, 'User created successfully', StatusCodes.CREATED),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.UNPROCESSABLE_ENTITY),
    ...createApiResponse(z.null(), 'User with email already exists', StatusCodes.CONFLICT),
  },
});

// PATCH /api/v1/users/{id} - Update user
userRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/users/{id}',
  tags: ['Users'],
  summary: 'Update a user',
  description: "Update an existing user's email or name",
  request: {
    params: UserIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateUserSchema,
        },
      },
    },
  },
  responses: {
    ...createApiResponse(UserSchema, 'User updated successfully'),
    ...createApiResponse(z.null(), 'User not found', StatusCodes.NOT_FOUND),
    ...createApiResponse(z.null(), 'Validation error', StatusCodes.UNPROCESSABLE_ENTITY),
  },
});

// DELETE /api/v1/users/{id} - Delete user
userRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/users/{id}',
  tags: ['Users'],
  summary: 'Delete a user',
  description: 'Delete an existing user by ID',
  request: {
    params: UserIdParamSchema,
  },
  responses: {
    ...createApiResponse(DeleteResponseSchema, 'User deleted successfully'),
    ...createApiResponse(z.null(), 'User not found', StatusCodes.NOT_FOUND),
  },
});
