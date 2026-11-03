import type { ActivePeriod, Day, Instant, Student } from '@evlos/core';

export type StudentActivePeriod = ActivePeriod & { studentId: string };

export interface StudentRepository {
  // Saves a Student, Active from the given Day. Returns false when the Student ID was
  // ever used before, because a Student ID is never reused.
  add(student: Student, activeFrom: Day): Promise<boolean>;
  // Saves many Students, each Active from the given Day, in one transaction: if any Student
  // ID is already used, none is saved and it throws.
  addMany(students: readonly Student[], activeFrom: Day): Promise<void>;
  list(): Promise<Student[]>;
  activePeriods(): Promise<StudentActivePeriod[]>;
  // Saves new details under the same Student ID. Returns false when no Student has it.
  update(student: Student): Promise<boolean>;
  // Each one changes his Active periods from today and records it in the audit log,
  // with the email of the Rector who did it.
  deactivate(studentId: string, today: Day, at: Instant, doneBy: string): Promise<void>;
  activate(studentId: string, today: Day, at: Instant, doneBy: string): Promise<void>;
}
