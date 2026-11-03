import { cleanStudent, invalidFields } from '@evlos/core';
import type { Student, StudentDetails, StudentField } from '@evlos/core';
import type { StudentRepository } from '../ports/student-repository.js';

export type EditStudentResult =
  | { outcome: 'edited'; student: Student }
  | { outcome: 'invalid'; fields: StudentField[] }
  | { outcome: 'unknown-student' };

export async function editStudent(
  studentId: string,
  details: StudentDetails,
  deps: { students: StudentRepository },
): Promise<EditStudentResult> {
  const student = cleanStudent({ studentId, ...details });
  const fields = invalidFields(student);
  if (fields.length > 0) {
    return { outcome: 'invalid', fields };
  }
  const updated = await deps.students.update(student);
  return updated ? { outcome: 'edited', student } : { outcome: 'unknown-student' };
}
