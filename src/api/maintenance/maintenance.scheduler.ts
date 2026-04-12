import { config } from '../../config';
import { logger } from '../../core';
import { maintenanceService } from './maintenance.service';

class MaintenanceScheduler {
  private escalationIntervalId: NodeJS.Timeout | null = null;
  private escalationTickInProgress = false;

  /**
   * Starts the maintenance escalation scheduler when it is enabled in config.
   *
   * The method is idempotent: repeated calls are ignored once an interval is registered. When enabled,
   * it schedules recurring sweep ticks and also triggers an immediate tick so already-overdue requests
   * are escalated without waiting for the first interval boundary.
   *
   * @returns Nothing.
   * @remarks Complexity: O(1) local scheduler work per call; escalation sweep cost is delegated to `runEscalationTick`.
   */
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

  /**
   * Stops the maintenance escalation scheduler if it is currently running.
   *
   * @returns Nothing.
   * @remarks Complexity: O(1).
   */
  stop(): void {
    if (!this.escalationIntervalId) {
      return;
    }

    clearInterval(this.escalationIntervalId);
    this.escalationIntervalId = null;

    logger.info('Maintenance escalation scheduler stopped');
  }

  /**
   * Executes one guarded escalation sweep for overdue maintenance requests.
   *
   * Prevents overlapping sweeps through `escalationTickInProgress`, invokes a single escalation batch
   * call with configured limit and scheduler reason, and logs only when at least one request escalates.
   * The in-progress guard is always released in `finally`, so subsequent ticks are never permanently blocked.
   *
   * @returns A promise that resolves when the sweep attempt finishes.
   * @remarks Complexity: O(1) local guard/timer logic; runtime is dominated by service-side escalation batch processing.
   */
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

/**
 * Starts the singleton maintenance scheduler instance.
 *
 * @returns Nothing.
 */
export const startMaintenanceScheduler = (): void => {
  maintenanceScheduler.start();
};

/**
 * Stops the singleton maintenance scheduler instance.
 *
 * @returns Nothing.
 */
export const stopMaintenanceScheduler = (): void => {
  maintenanceScheduler.stop();
};
