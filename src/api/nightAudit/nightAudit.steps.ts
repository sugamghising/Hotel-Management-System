import type { NightAuditStepCode, NightAuditStepResult } from './nightAudit.types';

export interface NightAuditStepOutput {
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Ordered execution plan for the night audit workflow.
 *
 * `hardFail` marks steps that must abort the audit when they fail. Non-hard-fail steps
 * are recorded as warnings and allow batch processing to continue.
 */
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

/**
 * Builds a normalized successful step result payload.
 *
 * This helper standardizes step logging shape before results are persisted into
 * `nightAudit.errors.steps`, emitted through outbox events, and surfaced in reports.
 *
 * @param step - Numeric sequence in the batch execution pipeline.
 * @param code - Domain step identifier.
 * @param output - Human-readable message and optional diagnostic details from the step action.
 * @returns Successful step result record ready for persistence/reporting.
 */
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

/**
 * Builds a normalized failed step result payload from any thrown value.
 *
 * The error is converted to a string message so downstream failure handling can
 * persist and emit the same shape regardless of error type.
 *
 * @param step - Numeric sequence in the batch execution pipeline.
 * @param code - Domain step identifier that failed.
 * @param error - Thrown error/value captured from step execution.
 * @param details - Optional structured diagnostics to include in audit logs.
 * @returns Failed step result record used for warning/hard-fail decisions.
 */
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

/**
 * Executes a single audit step and converts outcome to a uniform result envelope.
 *
 * The provided action is awaited and any thrown error is captured (not rethrown) so
 * the caller can decide whether to treat failure as warning or hard stop based on
 * step configuration.
 *
 * @param step - Numeric sequence in the batch execution pipeline.
 * @param code - Domain step identifier.
 * @param action - Async unit of work for the step.
 * @returns Object containing the normalized step result plus original error when failed.
 */
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
