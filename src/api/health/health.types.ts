export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface HealthResponse {
  success: true;
  data: HealthStatus;
}

export interface ReadinessStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTime: number;

  database: {
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  };

  memory: {
    heapUsed: number;
    heapTotal: number;
    usagePercent: number;
  };

  environment: string;
}

export interface ReadinessResponse {
  success: true;
  data: ReadinessStatus;
}
