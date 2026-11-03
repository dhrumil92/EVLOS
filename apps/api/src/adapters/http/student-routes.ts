import type { StudentDetails, StudentForm } from '@evlos/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { rectorOf } from './auth-routes.js';
import type { AddStudentResult } from '../../use-cases/add-student.js';
import type { ActivateResult, DeactivateResult } from '../../use-cases/deactivate-and-activate.js';
import type { EditStudentResult } from '../../use-cases/edit-student.js';
import type { ListedStudent } from '../../use-cases/list-students.js';

export interface StudentRoutesDeps {
  addStudent(form: StudentForm): Promise<AddStudentResult>;
  listStudents(): Promise<ListedStudent[]>;
  editStudent(studentId: string, details: StudentDetails): Promise<EditStudentResult>;
  deactivateStudent(studentId: string, doneBy: string): Promise<DeactivateResult>;
  activateStudent(studentId: string, doneBy: string): Promise<ActivateResult>;
}

interface ByStudentId {
  Params: { studentId: string };
}

// The answer for each outcome of Deactivate and Activate.
const ACTIVE_CHANGE_REPLIES: Record<DeactivateResult | ActivateResult, [number, string?]> = {
  deactivated: [204],
  activated: [204],
  'not-active': [409, 'This Student is already Deactivated.'],
  'already-active': [409, 'This Student is already Active.'],
  'unknown-student': [404, 'No Student has this Student ID.'],
};

function formFrom(body: unknown): StudentForm {
  const fields = (body ?? {}) as Record<string, unknown>;
  const text = (name: string) => {
    const value = fields[name];
    return typeof value === 'string' ? value : '';
  };
  return {
    studentId: text('studentId'),
    name: text('name'),
    room: text('room'),
    email: text('email'),
    phone: text('phone'),
  };
}

// The Student ID always comes from the address, never from the body, so it cannot change.
function detailsFrom(body: unknown): StudentDetails {
  const { name, room, email, phone } = formFrom(body);
  return { name, room, email, phone };
}

function changeActive(
  change: (studentId: string, doneBy: string) => Promise<DeactivateResult | ActivateResult>,
) {
  return async (request: FastifyRequest<ByStudentId>, reply: FastifyReply) => {
    const [code, message] =
      ACTIVE_CHANGE_REPLIES[await change(request.params.studentId, rectorOf(request).email)];
    return message ? reply.code(code).send({ message }) : reply.code(code).send();
  };
}

export function registerStudentRoutes(app: FastifyInstance, deps: StudentRoutesDeps): void {
  app.get('/api/students', () => deps.listStudents());

  app.post('/api/students', async (request, reply) => {
    const result = await deps.addStudent(formFrom(request.body));
    if (result.outcome === 'added') {
      return reply.code(201).send(result.student);
    }
    if (result.outcome === 'invalid') {
      return reply.code(400).send({ invalidFields: result.fields });
    }
    return reply.code(409).send({ message: 'This Student ID is already used.' });
  });

  app.put<ByStudentId>('/api/students/:studentId', async (request, reply) => {
    const result = await deps.editStudent(request.params.studentId, detailsFrom(request.body));
    if (result.outcome === 'edited') {
      return reply.code(200).send(result.student);
    }
    if (result.outcome === 'invalid') {
      return reply.code(400).send({ invalidFields: result.fields });
    }
    return reply.code(404).send({ message: 'No Student has this Student ID.' });
  });

  app.post<ByStudentId>(
    '/api/students/:studentId/deactivate',
    changeActive((studentId, doneBy) => deps.deactivateStudent(studentId, doneBy)),
  );
  app.post<ByStudentId>(
    '/api/students/:studentId/activate',
    changeActive((studentId, doneBy) => deps.activateStudent(studentId, doneBy)),
  );
}
