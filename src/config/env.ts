import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Server
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('localhost'),

  // API
  API_PREFIX: z.string().default('/api'),
  API_VERSION: z.string().default('v1'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL'),
  DB_POOL_MIN: z.coerce.number().min(1).default(2),
  DB_POOL_MAX: z.coerce.number().min(5).max(100).default(20),
  DB_CONNECTION_TIMEOUT: z.coerce.number().default(10000),
  DB_IDLE_TIMEOUT: z.coerce.number().default(30000),

  // Query Logging
  LOG_QUERIES: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Redis (optional)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Super Admin
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@hms.local'),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default('SuperAdmin123!@#'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
};

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
