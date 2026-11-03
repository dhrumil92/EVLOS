import type { Day, Instant, Student } from '@evlos/core';
import type { StudentActivePeriod, StudentRepository } from '../ports/student-repository.js';

// An in-memory StudentRepository for use-case tests. It keeps periods the same way the
// Postgres one does, so the use cases can be tested without a database.
export function fakeStudentRepository() {
  const saved: Student[] = [];
  const periods: StudentActivePeriod[] = [];
  const audit: { action: string; studentId: string; at: Instant; doneBy: string }[] = [];
  const students: StudentRepository = {
    add: (student: Student, activeFrom: Day) => {
      if (saved.some((one) => one.studentId === student.studentId)) {
        return Promise.resolve(false);
      }
      saved.push(student);
      periods.push({ studentId: student.studentId, activeFrom, activeUntil: null });
      return Promise.resolve(true);
    },
    addMany: (many, activeFrom) => {
      if (many.some((one) => saved.some((old) => old.studentId === one.studentId))) {
        return Promise.reject(new Error('A Student ID is already used.'));
      }
      for (const student of many) {
        saved.push(student);
        periods.push({ studentId: student.studentId, activeFrom, activeUntil: null });
      }
      return Promise.resolve();
    },
    list: () => Promise.resolve([...saved]),
    activePeriods: () => Promise.resolve(periods.map((period) => ({ ...period }))),
    update: (student) => {
      const index = saved.findIndex((one) => one.studentId === student.studentId);
      if (index >= 0) saved[index] = student;
      return Promise.resolve(index >= 0);
    },
    deactivate: (studentId, today, at, doneBy) => {
      const open = periods.find((p) => p.studentId === studentId && p.activeUntil === null);
      if (open) open.activeUntil = today;
      audit.push({ action: 'Deactivate', studentId, at, doneBy });
      return Promise.resolve();
    },
    activate: (studentId, today, at, doneBy) => {
      periods.push({ studentId, activeFrom: today, activeUntil: null });
      audit.push({ action: 'Activate', studentId, at, doneBy });
      return Promise.resolve();
    },
  };
  return { students, saved, periods, audit };
}
