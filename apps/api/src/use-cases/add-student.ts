import { cleanStudent, dayOf, invalidFields } from '@evlos/core';
import type { Clock, Student, StudentField, StudentForm } from '@evlos/core';
import type { StudentRepository } from '../ports/student-repository.js';

export type AddStudentResult =
  | { outcome: 'added'; student: Student }
  | { outcome: 'invalid'; fields: StudentField[] }
  | { outcome: 'student-id-used' };

export interface AddStudentDeps {
  students: StudentRepository;
  clock: Clock;
}

export async function addStudent(
  form: StudentForm,
  deps: AddStudentDeps,
): Promise<AddStudentResult> {
  const student = cleanStudent(form);
  const fields = invalidFields(student);
  if (fields.length > 0) {
    return { outcome: 'invalid', fields };
  }
  const added = await deps.students.add(student, dayOf(deps.clock.now()));
  return added ? { outcome: 'added', student } : { outcome: 'student-id-used' };
}
