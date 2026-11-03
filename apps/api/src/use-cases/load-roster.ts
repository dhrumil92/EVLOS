import { cleanStudent, dayOf, invalidFields } from '@evlos/core';
import type { Clock, Student, StudentField, StudentForm } from '@evlos/core';
import type { StudentRepository } from '../ports/student-repository.js';

export interface RosterRow {
  // The line in the file, so a problem can be found in Excel.
  line: number;
  form: StudentForm;
}

export interface LoadResult {
  ready: number;
  problems: string[];
  saved: boolean;
}

// Only the field is named, never what was typed, so the output holds no personal data.
const FIELD_PROBLEMS: Record<StudentField, string> = {
  studentId: 'Student ID is not a number.',
  name: 'Name is empty.',
  room: 'Room is not three digits.',
  email: 'Email is not a valid email address.',
};

function lineProblems(student: Student, earlier: number | undefined, isUsed: boolean) {
  const problems = invalidFields(student).map((field) => FIELD_PROBLEMS[field]);
  const id = student.studentId;
  if (earlier !== undefined) problems.push(`Student ID ${id} is also on line ${String(earlier)}.`);
  else if (isUsed) problems.push(`Student ID ${id} is already used.`);
  return problems;
}

function problemsOf(rows: readonly RosterRow[], used: ReadonlySet<string>) {
  const problems: string[] = [];
  const ready: Student[] = [];
  const firstLineOf = new Map<string, number>();
  for (const { line, form } of rows) {
    const student = cleanStudent(form);
    const earlier = firstLineOf.get(student.studentId);
    const found = lineProblems(student, earlier, used.has(student.studentId));
    // Remembered even when another field is wrong, so a repeat is still caught.
    if (earlier === undefined) firstLineOf.set(student.studentId, line);
    if (found.length === 0) ready.push(student);
    problems.push(...found.map((problem) => `line ${String(line)}: ${problem}`));
  }
  return { problems, ready };
}

// The one-time first load of the Rector's list (FR-1). Every row is checked like the Add a
// Student form. With save, all Students are added in one go, or none if any row has a problem.
export async function loadRoster(
  rows: readonly RosterRow[],
  save: boolean,
  deps: { students: StudentRepository; clock: Clock },
): Promise<LoadResult> {
  const used = new Set((await deps.students.list()).map((student) => student.studentId));
  const { problems, ready } = problemsOf(rows, used);
  const canSave = save && problems.length === 0 && ready.length > 0;
  if (canSave) {
    await deps.students.addMany(ready, dayOf(deps.clock.now()));
  }
  return { ready: ready.length, problems, saved: canSave };
}
