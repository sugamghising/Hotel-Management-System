import { env } from '@config/env';
import { logger } from '@core/index';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Prisma } from '../generated/prisma/client';
import { PrismaClient } from '../generated/prisma/client';

const pool = new Pool({
  connectionString: env.DATABASE_URL,

  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients to keep in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Wait max 10s for a connection

  // Keep-alive settings (prevents connection drops)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // Error handling
  allowExitOnIdle: false, // Don't allow pool to close if no clients
});

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('remove', () => {
  logger.debug('Database connection removed from pool');
});

/**
 * Prisma Adapter with PostgreSQL pool
 */
const adapter = new PrismaPg(pool);

/**
 * Prisma Client Instance
 * Configured with logging, error handling, and monitoring
 */
const prisma = new PrismaClient({
  adapter,

  // Logging configuration
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
    { emit: 'stdout', level: 'info' },
  ],

  // Error formatting
  errorFormat: env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

/**
 * Query Performance Monitoring
 * Logs slow queries (> 1 second) in production
 */
prisma.$on('query' as never, (e: Prisma.QueryEvent) => {
  const duration = e.duration;
  const query = e.query;
  const params = e.params;

  // Log slow queries
  if (duration > 1000) {
    logger.warn('Slow query detected', {
      duration: `${duration}ms`,
      query: query.substring(0, 200), // Truncate long queries
      params,
    });
  }

  // Log all queries in development (optional)
  if (env.NODE_ENV === 'development' && env.LOG_LEVEL === 'debug') {
    logger.debug('Query executed', {
      duration: `${duration}ms`,
      query: query.substring(0, 100),
    });
  }
});

/**
 * Error Event Logging
 */
prisma.$on('error' as never, (e: Prisma.LogEvent) => {
  logger.error('Prisma error event', {
    message: e.message,
    target: e.target,
  });
});

/**
 * Warning Event Logging
 */
prisma.$on('warn' as never, (e: Prisma.LogEvent) => {
  logger.warn('Prisma warning', { message: e.message });
});

/**
 * Database Connection with Retry Logic
 */
const connectWithRetry = async (retries = 5, delay = 5000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('✅ Database connected successfully', {
        attempt,
        environment: env.NODE_ENV,
        poolSize: pool.totalCount,
      });

      // Run a test query to verify connection
      await prisma.$queryRaw`SELECT 1 as health_check`;

      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`❌ Database connection failed (attempt ${attempt}/${retries})`, {
        error: errorMessage,
      });

      if (attempt === retries) {
        logger.error('⛔ Max database connection retries reached. Exiting...');
        throw new Error(`Database connection failed after ${retries} attempts: ${errorMessage}`);
      }

      // Wait before retrying
      logger.info(`Retrying database connection in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Database Health Check
 * Use this in your health check endpoint
 */
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1 as health`;

    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Database health check failed', { error: errorMessage });

    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: errorMessage,
    };
  }
};

/**
 * Graceful Shutdown
 * Call this when shutting down your application
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    await pool.end();
    logger.info('✅ Database disconnected gracefully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error during database disconnect', { error: errorMessage });
    throw error;
  }
};

/**
 * Transaction Helper with Timeout
 * Prevents long-running transactions
 */
export const withTransaction = async <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number; // Max time to wait for transaction to start
    timeout?: number; // Max time transaction can run
  }
): Promise<T> => {
  return prisma.$transaction(async (tx) => fn(tx), {
    maxWait: options?.maxWait ?? 5000, // 5 seconds
    timeout: options?.timeout ?? 30000, // 30 seconds
  });
};

/**
 * Get Database Statistics
 * Useful for monitoring dashboards
 */
export const getDatabaseStats = () => ({
  totalConnections: pool.totalCount,
  idleConnections: pool.idleCount,
  waitingClients: pool.waitingCount,
});

// Connect on module load
connectWithRetry().catch((error) => {
  logger.error('Failed to establish initial database connection', { error });
  // In production, you might want to exit the process here
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Export the Prisma client instance
export { prisma };
