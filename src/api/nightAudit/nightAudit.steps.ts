import type { NightAuditStepCode, NightAuditStepResult } from './nightAudit.types';

export interface NightAuditStepOutput {
  message: string;
  details?: Record<string, unknown>;
}

export const NIGHT_AUDIT_STEPS: ReadonlyArray<{
  step: number;
  code: NightAuditStepCode;
  hardFail: boolean;
}> = [
  { step: 1, code: 'PRE_CHECK_SNAPSHOT', hardFail: false },
  { step: 2, code: 'PRE_CHECK_BLOCKERS', hardFail: true },
  { step: 3, code: 'POST_ROOM_CHARGES', hardFail: false },
  { step: 4, code: 'MARK_NO_SHOWS', hardFail: false },
  { step: 5, code: 'GENERATE_STAYOVER_TASKS', hardFail: false },
  { step: 6, code: 'GENERATE_PREVENTIVE_TASKS', hardFail: false },
  { step: 7, code: 'RUN_ESCALATION_SWEEP', hardFail: false },
  { step: 8, code: 'ADVANCE_BUSINESS_DATE', hardFail: true },
] as const;

export const createStepSuccess = (
  step: number,
  code: NightAuditStepCode,
  output: NightAuditStepOutput
): NightAuditStepResult => ({
  step,
  code,
  status: 'SUCCESS',
  message: output.message,
  ...(output.details ? { details: output.details } : {}),
});

export const createStepFailure = (
  step: number,
  code: NightAuditStepCode,
  error: unknown,
  details?: Record<string, unknown>
): NightAuditStepResult => ({
  step,
  code,
  status: 'FAILED',
  message: error instanceof Error ? error.message : String(error),
  ...(details ? { details } : {}),
});

export const runStep = async (
  step: number,
  code: NightAuditStepCode,
  action: () => Promise<NightAuditStepOutput>
): Promise<{ stepResult: NightAuditStepResult; error?: unknown }> => {
  try {
    const output = await action();
    return { stepResult: createStepSuccess(step, code, output) };
  } catch (error) {
    return { stepResult: createStepFailure(step, code, error), error };
  }
};
