import { createApiResponse } from '@/api-docs/openAPIResponseHelpers';
import { z } from '@/common/utils/zodExtensions';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// ============ Zod Schemas with OpenAPI metadata ============

export const HealthStatusSchema = z
  .object({
    status: z.enum(['ok', 'degraded', 'unhealthy']),
    timestamp: z.string(),
    uptime: z.number(),
    version: z.string(),
    environment: z.string(),
  })
  .openapi('HealthStatus');

export const DatabaseHealthSchema = z
  .object({
    status: z.enum(['healthy', 'unhealthy']),
    responseTime: z.number(),
    error: z.string().optional(),
  })
  .openapi('DatabaseHealth');

export const MemoryStatusSchema = z
  .object({
    heapUsed: z.number(),
    heapTotal: z.number(),
    usagePercent: z.number(),
  })
  .openapi('MemoryStatus');

export const ReadinessStatusSchema = z
  .object({
    status: z.enum(['healthy', 'unhealthy']),
    timestamp: z.string(),
    uptime: z.number(),
    responseTime: z.number(),
    database: DatabaseHealthSchema,
    memory: MemoryStatusSchema,
    environment: z.string(),
  })
  .openapi('ReadinessStatus');

// ============ OpenAPI Registry ============

export const healthRegistry = new OpenAPIRegistry();

// Register schemas
healthRegistry.register('HealthStatus', HealthStatusSchema);
healthRegistry.register('ReadinessStatus', ReadinessStatusSchema);

// GET /health - Health check
healthRegistry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health check endpoint',
  description: 'Returns the health status of the API',
  responses: createApiResponse(HealthStatusSchema, 'API is healthy'),
});

// GET /health/ready - Readiness check
healthRegistry.registerPath({
  method: 'get',
  path: '/health/ready',
  tags: ['Health'],
  summary: 'Readiness check endpoint',
  description: 'Returns detailed readiness status including database connectivity',
  responses: createApiResponse(ReadinessStatusSchema, 'Readiness status'),
});
