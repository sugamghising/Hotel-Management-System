// ============================================================================
// REPORTS MODULE - PUBLIC EXPORTS
// ============================================================================

// Controller
export { ReportsController, reportsController } from './reports.controller';

// Service
export { ReportsService, reportsService } from './reports.service';

// Repository
export { ReportsRepository, reportsRepository } from './reports.repository';

// Routes
export { default as reportsRoutes } from './reports.routes';

// Re-export all DTOs (types and schemas)
export * from './reports.dto';
