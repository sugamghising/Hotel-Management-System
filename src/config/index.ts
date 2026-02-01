import { env } from './env';

export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    host: env.HOST,
  },

  api: {
    prefix: env.API_PREFIX,
    version: env.API_VERSION,
    get fullPrefix() {
      return `${this.prefix}/${this.version}`;
    },
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  cors: {
    origin: env.CORS_ORIGIN,
  },
} as const;

export type Config = typeof config;
