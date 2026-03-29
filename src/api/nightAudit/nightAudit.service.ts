import { config } from '../../config';
import { AuditBlockedError, AuditStepFailedError, NotFoundError } from '../../core/errors';
import type { NightAudit, Prisma } from '../../generated/prisma';
import { folioService } from '../folio/folio.service';
import { housekeepingService } from '../housekeeping';
import { maintenanceService } from '../maintenance';
import { notificationService } from '../notification';
import { type NightAuditRepositoryType, nightAuditRepository } from './nightAudit.repository';
import { type NightAuditRollbackSummary, assertRollbackAllowed } from './nightAudit.rollback';
import type {
  NightAuditDateQueryInput,
  NightAuditHistoryQueryInput,
  NightAuditReportQueryInput,
  RollbackNightAuditInput,
  RunNightAuditInput,
} from './nightAudit.schema';
import { createStepFailure, createStepSuccess, runStep } from './nightAudit.steps';
import type {
  NightAuditActionSummary,
  NightAuditHistoryResponse,
  NightAuditPreCheckSnapshot,
  NightAuditReportResponse,
  NightAuditRollbackResponse,
  NightAuditRunResponse,
  NightAuditStatusResponse,
  NightAuditStepResult,
} from './nightAudit.types';

const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const endOfDayUtc = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
  );

const toNumber = (value: { toString(): string } | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return Number.parseFloat(value.toString());
};

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class NightAuditService {
  private readonly nightAuditRepo: NightAuditRepositoryType;

  constructor(repository: NightAuditRepositoryType = nightAuditRepository) {
    this.nightAuditRepo = repository;
  }

  async preCheck(
    organizationId: string,
    hotelId: string,
    query: NightAuditDateQueryInput = {}
  ): Promise<NightAuditPreCheckSnapshot> {
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const businessDate = this.resolveBusinessDate(query.businessDate, hotel.currentBusinessDate);

    return this.nightAuditRepo.calculatePreCheckSnapshot(organizationId, hotelId, businessDate);
  }

  async runAudit(
    organizationId: string,
    hotelId: string,
    input: RunNightAuditInput,
    userId?: string
  ): Promise<NightAuditRunResponse> {
    const actorId = userId ?? config.system.userId;
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const businessDate = this.resolveBusinessDate(input.businessDate, hotel.currentBusinessDate);

    const preCheck = await this.nightAuditRepo.calculatePreCheckSnapshot(
      organizationId,
      hotelId,
      businessDate
    );

    const audit = await this.nightAuditRepo.startAudit(
      hotelId,
      businessDate,
      actorId,
      input.notes,
      preCheck
    );

    const stepResults: NightAuditStepResult[] = [];

    stepResults.push(
      createStepSuccess(1, 'PRE_CHECK_SNAPSHOT', {
        message: 'Pre-check snapshot captured',
        details: {
          unbalancedFolios: preCheck.unbalancedFolios,
          uncheckedOutRes: preCheck.uncheckedOutRes,
          pendingCharges: preCheck.pendingCharges,
          roomDiscrepancies: preCheck.roomDiscrepancies,
        },
      })
    );

    if (!preCheck.canRun) {
      stepResults.push(
        createStepFailure(
          2,
          'PRE_CHECK_BLOCKERS',
          new Error('Blocking pre-check found unchecked-out reservations'),
          {
            uncheckedOutRes: preCheck.uncheckedOutRes,
            reservationIds: preCheck.uncheckedOutReservationIds,
          }
        )
      );

      const payload = {
        phase: 'PRE_CHECK_BLOCKERS',
        steps: stepResults,
        blockedReservations: preCheck.uncheckedOutReservationIds,
      };

      await this.nightAuditRepo.failAudit(audit.id, asJson(payload));
      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.failed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: audit.id,
          businessDate: businessDate.toISOString(),
          failedAt: new Date().toISOString(),
          reason: 'UNCHECKED_OUT_RESERVATIONS',
          preCheck: {
            ...preCheck,
            businessDate: preCheck.businessDate.toISOString(),
          },
        })
      );

      throw new AuditBlockedError('Cannot run audit: guests must be checked out first', {
        uncheckedOutRes: preCheck.uncheckedOutRes,
        reservationIds: preCheck.uncheckedOutReservationIds,
      });
    }

    stepResults.push(
      createStepSuccess(2, 'PRE_CHECK_BLOCKERS', {
        message: 'No hard blockers found',
      })
    );

    const actions: NightAuditActionSummary = {
      autoPostedCharges: 0,
      noShowsMarked: 0,
      stayoverTasksGenerated: 0,
      preventiveTasksGenerated: 0,
      escalationsProcessed: 0,
    };

    const warningSteps: NightAuditStepResult[] = [];

    const roomChargeStep = await runStep(3, 'POST_ROOM_CHARGES', async () => {
      const result = await folioService.postRoomCharges(
        hotelId,
        organizationId,
        businessDate,
        actorId,
        audit.id
      );
      actions.autoPostedCharges = result.posted;

      return {
        message: `Posted ${result.posted} room charge(s)`,
        details: {
          posted: result.posted,
          totalAmount: result.totalAmount,
        },
      };
    });
    stepResults.push(roomChargeStep.stepResult);
    if (roomChargeStep.error) warningSteps.push(roomChargeStep.stepResult);

    const noShowStep = await runStep(4, 'MARK_NO_SHOWS', async () => {
      const result = await this.nightAuditRepo.markNoShowsForAudit(
        audit.id,
        organizationId,
        hotelId,
        businessDate
      );
      actions.noShowsMarked = result.count;

      return {
        message: `Marked ${result.count} reservation(s) as no-show`,
        details: {
          count: result.count,
          reservationIds: result.reservationIds,
        },
      };
    });
    stepResults.push(noShowStep.stepResult);
    if (noShowStep.error) warningSteps.push(noShowStep.stepResult);

    const stayoverStep = await runStep(5, 'GENERATE_STAYOVER_TASKS', async () => {
      const result = await housekeepingService.autoGenerateStayoverTasks(
        organizationId,
        hotelId,
        { date: businessDate },
        actorId,
        { nightAuditBatchId: audit.id }
      );
      actions.stayoverTasksGenerated = result.created;

      return {
        message: `Generated ${result.created} stayover task(s)`,
        details: {
          created: result.created,
        },
      };
    });
    stepResults.push(stayoverStep.stepResult);
    if (stayoverStep.error) warningSteps.push(stayoverStep.stepResult);

    const preventiveStep = await runStep(6, 'GENERATE_PREVENTIVE_TASKS', async () => {
      const result = await maintenanceService.generateDuePreventiveTasks(organizationId, hotelId, {
        date: endOfDayUtc(businessDate),
        sourceRef: audit.id,
      });
      actions.preventiveTasksGenerated = result.createdCount;

      return {
        message: `Generated ${result.createdCount} preventive request(s)`,
        details: {
          createdCount: result.createdCount,
        },
      };
    });
    stepResults.push(preventiveStep.stepResult);
    if (preventiveStep.error) warningSteps.push(preventiveStep.stepResult);

    const escalationStep = await runStep(7, 'RUN_ESCALATION_SWEEP', async () => {
      const result = await maintenanceService.runEscalationSweep({
        organizationId,
        hotelId,
        reason: 'NIGHT_AUDIT_AUTO_ESCALATION',
      });
      actions.escalationsProcessed = result.escalatedCount;

      return {
        message: `Escalation sweep processed ${result.escalatedCount} request(s)`,
        details: {
          checkedCount: result.checkedCount,
          escalatedCount: result.escalatedCount,
          skippedEmergencyCount: result.skippedEmergencyCount,
        },
      };
    });
    stepResults.push(escalationStep.stepResult);
    if (escalationStep.error) warningSteps.push(escalationStep.stepResult);

    let nextBusinessDate = hotel.currentBusinessDate;
    const advanceBusinessDateStep = await runStep(8, 'ADVANCE_BUSINESS_DATE', async () => {
      nextBusinessDate = await this.nightAuditRepo.advanceHotelBusinessDate(
        organizationId,
        hotelId,
        businessDate
      );

      return {
        message: `Business date advanced to ${nextBusinessDate.toISOString().slice(0, 10)}`,
        details: {
          nextBusinessDate,
        },
      };
    });
    stepResults.push(advanceBusinessDateStep.stepResult);
    if (advanceBusinessDateStep.error) warningSteps.push(advanceBusinessDateStep.stepResult);

    try {
      const financial = await this.nightAuditRepo.computeFinancialSummary(hotelId, businessDate);

      const completed = await this.nightAuditRepo.completeAudit(
        audit.id,
        financial,
        actions,
        stepResults,
        warningSteps.length
      );

      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.completed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: completed.id,
          businessDate: businessDate.toISOString(),
          completedAt: completed.completedAt?.toISOString() ?? null,
          nextBusinessDate: nextBusinessDate.toISOString(),
          warningCount: warningSteps.length,
        })
      );

      if (warningSteps.length > 0 && userId) {
        await notificationService.send([userId], {
          type: 'WARNING',
          title: 'Night audit completed with warnings',
          message: `${warningSteps.length} step(s) failed and were logged for audit ${completed.id}`,
          metadata: {
            auditId: completed.id,
            businessDate: businessDate.toISOString().slice(0, 10),
          },
        });
      }

      return {
        audit: this.mapAuditToReport(completed),
        preCheck,
        nextBusinessDate,
      };
    } catch (error) {
      const payload = {
        phase: 'FINALIZE',
        steps: stepResults,
        warningCount: warningSteps.length,
        reason: error instanceof Error ? error.message : String(error),
      };

      await this.nightAuditRepo.failAudit(audit.id, asJson(payload));
      await this.nightAuditRepo.createOutboxEvent(
        'night_audit.failed',
        audit.id,
        asJson({
          organizationId,
          hotelId,
          auditId: audit.id,
          businessDate: businessDate.toISOString(),
          failedAt: new Date().toISOString(),
          reason: error instanceof Error ? error.message : String(error),
        })
      );

      throw new AuditStepFailedError({
        step: 8,
        stepName: 'FINALIZE_AUDIT',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getStatus(organizationId: string, hotelId: string): Promise<NightAuditStatusResponse> {
    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const latest = await this.nightAuditRepo.findLatestAudit(hotelId);

    return {
      currentBusinessDate: asDateOnly(hotel.currentBusinessDate),
      latestAudit: latest ? this.mapAuditToReport(latest) : null,
    };
  }

  async getHistory(
    organizationId: string,
    hotelId: string,
    query: NightAuditHistoryQueryInput
  ): Promise<NightAuditHistoryResponse> {
    await this.nightAuditRepo.findHotelScope(organizationId, hotelId);

    const { items, total } = await this.nightAuditRepo.listAuditHistory(hotelId, query);

    return {
      items: items.map((item) => this.mapAuditToReport(item)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getReport(
    organizationId: string,
    hotelId: string,
    query: NightAuditReportQueryInput
  ): Promise<NightAuditReportResponse> {
    await this.nightAuditRepo.findHotelScope(organizationId, hotelId);

    let audit: NightAudit | null = null;

    if (query.auditId) {
      audit = await this.nightAuditRepo.findAuditById(query.auditId, hotelId);
    } else if (query.businessDate) {
      audit = await this.nightAuditRepo.findAuditByBusinessDate(hotelId, query.businessDate);
    } else {
      audit = await this.nightAuditRepo.findLatestAudit(hotelId);
    }

    if (!audit) {
      throw new NotFoundError('Night audit report not found');
    }

    return this.mapAuditToReport(audit);
  }

  async rollbackAudit(
    organizationId: string,
    hotelId: string,
    input: RollbackNightAuditInput,
    userId?: string
  ): Promise<NightAuditRollbackResponse> {
    const actorId = userId ?? config.system.userId;
    const reason = input.reason ?? 'Night audit rollback requested';

    const hotel = await this.nightAuditRepo.findHotelScope(organizationId, hotelId);
    const latestAudit = await this.nightAuditRepo.findLatestAudit(hotelId);

    if (!latestAudit) {
      throw new NotFoundError('No night audit found to rollback');
    }

    const targetAudit = input.auditId
      ? await this.nightAuditRepo.findAuditById(input.auditId, hotelId)
      : latestAudit;

    if (!targetAudit) {
      throw new NotFoundError('Night audit not found');
    }

    assertRollbackAllowed(targetAudit, latestAudit, hotel.currentBusinessDate);

    const voidedCharges = await this.nightAuditRepo.rollbackRoomCharges(targetAudit.id, actorId);
    const revertedNoShows = await this.nightAuditRepo.rollbackNoShows(targetAudit.id);
    const cancelledStayoverTasks = await this.nightAuditRepo.rollbackStayoverTasks(
      targetAudit.id,
      actorId,
      reason
    );
    const cancelledPreventiveRequests = await this.nightAuditRepo.rollbackPreventiveRequests(
      targetAudit.id,
      actorId,
      reason
    );

    await this.nightAuditRepo.updateHotelBusinessDate(
      organizationId,
      hotelId,
      asDateOnly(targetAudit.businessDate)
    );

    const rollbackSummary: NightAuditRollbackSummary = {
      voidedRoomCharges: voidedCharges.voidedRoomCharges,
      revertedNoShows,
      cancelledStayoverTasks,
      cancelledPreventiveRequests,
    };

    const rollbackPayload = {
      rolledBackAt: new Date().toISOString(),
      rolledBackBy: actorId,
      reason,
      rollback: rollbackSummary,
      previousStatus: targetAudit.status,
    };

    const rolledBackAudit = await this.nightAuditRepo.markRolledBack(
      targetAudit.id,
      asJson(rollbackPayload),
      reason
    );

    await this.nightAuditRepo.createOutboxEvent(
      'night_audit.rolled_back',
      targetAudit.id,
      asJson({
        organizationId,
        hotelId,
        auditId: targetAudit.id,
        businessDate: targetAudit.businessDate.toISOString(),
        rolledBackAt: new Date().toISOString(),
        rolledBackBy: actorId,
        reason,
        rollback: rollbackSummary,
      })
    );

    if (userId) {
      await notificationService.send([userId], {
        type: 'INFO',
        title: 'Night audit rolled back',
        message: `Night audit ${targetAudit.id} was rolled back successfully`,
        metadata: {
          auditId: targetAudit.id,
          businessDate: targetAudit.businessDate.toISOString().slice(0, 10),
          rollback: rollbackSummary,
        },
      });
    }

    return {
      auditId: rolledBackAudit.id,
      businessDate: asDateOnly(rolledBackAudit.businessDate),
      status: rolledBackAudit.status,
      rollback: rollbackSummary,
    };
  }

  private resolveBusinessDate(requestedDate?: Date, fallbackDate?: Date): Date {
    if (requestedDate) {
      return asDateOnly(requestedDate);
    }

    if (fallbackDate) {
      return asDateOnly(fallbackDate);
    }

    return asDateOnly(new Date());
  }

  private mapAuditToReport(audit: NightAudit): NightAuditReportResponse {
    const payload = this.parseErrorPayload(audit.errors);
    const steps = this.parseSteps(payload.steps);

    return {
      id: audit.id,
      hotelId: audit.hotelId,
      businessDate: asDateOnly(audit.businessDate),
      status: audit.status,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      performedBy: audit.performedBy,
      checks: {
        unbalancedFolios: audit.unbalancedFolios,
        uncheckedOutRes: audit.uncheckedOutRes,
        pendingCharges: audit.pendingCharges,
        roomDiscrepancies: audit.roomDiscrepancies,
      },
      financial: {
        roomRevenue: toNumber(audit.roomRevenue),
        otherRevenue: toNumber(audit.otherRevenue),
        paymentsReceived: toNumber(audit.paymentsReceived),
      },
      actions: {
        autoPostedCharges: audit.autoPostedCharges,
        noShowsMarked: audit.noShowsMarked,
        stayoverTasksGenerated: this.getStepNumber(steps, 'GENERATE_STAYOVER_TASKS', 'created'),
        preventiveTasksGenerated: this.getStepNumber(
          steps,
          'GENERATE_PREVENTIVE_TASKS',
          'createdCount'
        ),
        escalationsProcessed: this.getStepNumber(steps, 'RUN_ESCALATION_SWEEP', 'escalatedCount'),
      },
      notes: audit.notes,
      steps,
      warningCount:
        typeof payload.warningCount === 'number'
          ? payload.warningCount
          : steps.filter((step) => step.status === 'FAILED').length,
    };
  }

  private parseErrorPayload(errors: unknown): {
    steps?: unknown;
    warningCount?: unknown;
  } {
    if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
      return {};
    }

    return errors as {
      steps?: unknown;
      warningCount?: unknown;
    };
  }

  private parseSteps(candidate: unknown): NightAuditStepResult[] {
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }

        const stepCandidate = item as Partial<NightAuditStepResult>;
        if (
          typeof stepCandidate.step !== 'number' ||
          typeof stepCandidate.code !== 'string' ||
          typeof stepCandidate.status !== 'string' ||
          typeof stepCandidate.message !== 'string'
        ) {
          return null;
        }

        return {
          step: stepCandidate.step,
          code: stepCandidate.code,
          status: stepCandidate.status,
          message: stepCandidate.message,
          ...(stepCandidate.details && typeof stepCandidate.details === 'object'
            ? { details: stepCandidate.details as Record<string, unknown> }
            : {}),
        } as NightAuditStepResult;
      })
      .filter((item): item is NightAuditStepResult => item !== null)
      .sort((a, b) => a.step - b.step);
  }

  private getStepNumber(
    steps: NightAuditStepResult[],
    code: NightAuditStepResult['code'],
    key: string
  ): number {
    const match = steps.find((step) => step.code === code);
    if (!match || !match.details) {
      return 0;
    }

    const value = match.details[key];
    if (typeof value === 'number') {
      return value;
    }

    return 0;
  }
}

export const nightAuditService = new NightAuditService();
