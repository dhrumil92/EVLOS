import { recordLeave, returnLeave } from './leaves.js';
import type { LeaveDeps, LeaveForm, LeaveResult, ReturnForm } from './leaves.js';

export type ManyLeaveRow = LeaveForm & { studentId: string };
export type ManyReturnRow = ReturnForm & { studentId: string };
export type RowResult = LeaveResult & { studentId: string };

// Leave for many Students (FR-4b). Each row goes through the same rules as one Student and
// is saved on its own, so a refused row blocks only itself. One after another, so two rows
// for the same Student cannot both open a Leave.
export async function recordLeaves(
  rows: readonly ManyLeaveRow[],
  doneBy: string,
  deps: LeaveDeps,
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  for (const { studentId, ...form } of rows) {
    results.push({ studentId, ...(await recordLeave(studentId, form, doneBy, deps)) });
  }
  return results;
}

// Return for many Students (FR-5), row by row in the same way.
export async function returnLeaves(
  rows: readonly ManyReturnRow[],
  doneBy: string,
  deps: LeaveDeps,
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  for (const { studentId, ...form } of rows) {
    results.push({ studentId, ...(await returnLeave(studentId, form, doneBy, deps)) });
  }
  return results;
}
