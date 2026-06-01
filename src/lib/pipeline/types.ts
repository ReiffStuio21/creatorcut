/**
 * The AI work is a pipeline, not scattered buttons (PLAN.md §4c):
 * transcribe → detect fillers/silence → caption. Each step carries its own
 * status so it can show progress, surface errors, retry, and be re-run
 * independently of the others.
 */

export type StepStatus = "idle" | "running" | "done" | "error";

export interface StepState {
  status: StepStatus;
  error: string | null;
}

export const idleStep: StepState = { status: "idle", error: null };

export function runningStep(): StepState {
  return { status: "running", error: null };
}

export function doneStep(): StepState {
  return { status: "done", error: null };
}

export function errorStep(error: string): StepState {
  return { status: "error", error };
}
