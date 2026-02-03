import { config } from '../../config/index';
import { checkDatabaseHealth } from '../../database/prisma';
import type { HealthStatus, ReadinessStatus } from './health.types';

// Read version from package.json at startup
const packageVersion = '1.0.0'; // In production, you'd read this from package.json

export const healthService = {
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: packageVersion,
      environment: config.env,
    };
  },

  async check(): Promise<ReadinessStatus> {
    const startTime = Date.now();

    // 1️⃣ Database readiness (primary dependency)
    const database = await checkDatabaseHealth();

    // 2️⃣ Memory pressure (early warning signal)
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;

    const memoryUsagePercent = heapTotal > 0 ? (heapUsed / heapTotal) * 100 : 0;

    // 3️⃣ Overall readiness decision
    const isHealthy = database.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,

      database: {
        status: database.status,
        responseTime: database.responseTime,
        ...(database.error ? { error: database.error } : {}),
      },

      memory: {
        heapUsed,
        heapTotal,
        usagePercent: Number(memoryUsagePercent.toFixed(2)),
      },

      environment: config.env,
    };
  },
};
