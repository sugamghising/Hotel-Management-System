import { config } from '../../config/index';
import type { HealthStatus } from './health.types';

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
};
