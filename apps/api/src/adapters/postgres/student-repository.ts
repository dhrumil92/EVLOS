import type { Day, Instant, Student } from '@evlos/core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, studentActivePeriods, students } from '../../db/schema.js';
import type { StudentActivePeriod, StudentRepository } from '../../ports/student-repository.js';

export class PostgresStudentRepository implements StudentRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // One transaction, so a Student never exists without his Active period.
  add(student: Student, activeFrom: Day): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(students)
        .values(student)
        .onConflictDoNothing()
        .returning({ studentId: students.studentId });
      if (inserted.length === 0) {
        return false;
      }
      await tx.insert(studentActivePeriods).values({ studentId: student.studentId, activeFrom });
      return true;
    });
  }

  list(): Promise<Student[]> {
    return this.db.select().from(students).orderBy(asc(students.studentId));
  }

  activePeriods(): Promise<StudentActivePeriod[]> {
    return this.db
      .select()
      .from(studentActivePeriods)
      .orderBy(asc(studentActivePeriods.studentId), asc(studentActivePeriods.activeFrom));
  }

  async update(student: Student): Promise<boolean> {
    const { studentId, ...details } = student;
    const updated = await this.db
      .update(students)
      .set(details)
      .where(eq(students.studentId, studentId))
      .returning({ studentId: students.studentId });
    return updated.length > 0;
  }

  deactivate(studentId: string, today: Day, at: Instant, doneBy: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(studentActivePeriods)
        .set({ activeUntil: today })
        .where(
          and(
            eq(studentActivePeriods.studentId, studentId),
            isNull(studentActivePeriods.activeUntil),
          ),
        );
      await tx
        .insert(auditLog)
        .values({ action: 'Deactivate', studentId, doneAt: new Date(at), doneBy });
    });
  }

  // Activated on the Day he was Deactivated: his period reopens, so he has no gap.
  activate(studentId: string, today: Day, at: Instant, doneBy: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      const reopened = await tx
        .update(studentActivePeriods)
        .set({ activeUntil: null })
        .where(
          and(
            eq(studentActivePeriods.studentId, studentId),
            eq(studentActivePeriods.activeUntil, today),
          ),
        )
        .returning({ studentId: studentActivePeriods.studentId });
      if (reopened.length === 0) {
        await tx.insert(studentActivePeriods).values({ studentId, activeFrom: today });
      }
      await tx
        .insert(auditLog)
        .values({ action: 'Activate', studentId, doneAt: new Date(at), doneBy });
    });
  }
}
