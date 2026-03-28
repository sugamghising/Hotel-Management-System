import { config } from '../../config';
import { logger } from '../../core';
import { maintenanceService } from './maintenance.service';

class MaintenanceScheduler {
  private escalationIntervalId: NodeJS.Timeout | null = null;
  private escalationTickInProgress = false;

  start(): void {
    if (this.escalationIntervalId) {
      return;
    }

    if (!config.maintenance.escalationCheckerEnabled) {
      logger.info('Maintenance escalation scheduler is disabled');
      return;
    }

    const intervalMs = config.maintenance.escalationCheckerIntervalMs;

    this.escalationIntervalId = setInterval(() => {
      this.runEscalationTick().catch((error: unknown) => {
        logger.error('Maintenance escalation checker tick failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, intervalMs);

    this.runEscalationTick().catch((error: unknown) => {
      logger.error('Maintenance escalation checker tick failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    logger.info('Maintenance escalation scheduler started', {
      intervalMs,
      batchSize: config.maintenance.escalationCheckerBatchSize,
    });
  }

  stop(): void {
    if (!this.escalationIntervalId) {
      return;
    }

    clearInterval(this.escalationIntervalId);
    this.escalationIntervalId = null;

    logger.info('Maintenance escalation scheduler stopped');
  }

  private async runEscalationTick(): Promise<void> {
    if (this.escalationTickInProgress) {
      return;
    }

    this.escalationTickInProgress = true;

    try {
      const result = await maintenanceService.runEscalationSweep({
        limit: config.maintenance.escalationCheckerBatchSize,
        reason: 'SCHEDULED_ESCALATION_CHECK',
      });

      if (result.escalatedCount > 0) {
        logger.warn('Maintenance escalation checker escalated overdue requests', result);
      }
    } finally {
      this.escalationTickInProgress = false;
    }
  }
}

const maintenanceScheduler = new MaintenanceScheduler();

export const startMaintenanceScheduler = (): void => {
  maintenanceScheduler.start();
};

export const stopMaintenanceScheduler = (): void => {
  maintenanceScheduler.stop();
};
