import type { StudentDetails, StudentForm } from '@evlos/core';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { AddStudentResult } from '../../use-cases/add-student.js';
import type { StudentRoutesDeps } from './student-routes.js';
import { registerStudentRoutes } from './student-routes.js';

const STUDENT = {
  studentId: '9001',
  name: 'Test Student',
  room: '101',
  email: 'test.student@example.com',
  phone: null,
};

const RECTOR = { id: 1, email: 'rector@example.com' };

function buildApp(result: AddStudentResult, more: Partial<StudentRoutesDeps> = {}) {
  const forms: StudentForm[] = [];
  const app = Fastify();
  // Stands in for the login check, which has its own tests.
  app.decorateRequest('rector', null);
  app.addHook('onRequest', (request, _reply, done) => {
    request.rector = RECTOR;
    done();
  });
  registerStudentRoutes(app, {
    addStudent: (form) => {
      forms.push(form);
      return Promise.resolve(result);
    },
    listStudents: () =>
      Promise.resolve([
        { ...STUDENT, isActive: true, floor: 1, leaveState: 'In hostel' as const, openLeave: null },
      ]),
    editStudent: () => Promise.resolve({ outcome: 'unknown-student' }),
    deactivateStudent: () => Promise.resolve('unknown-student'),
    activateStudent: () => Promise.resolve('unknown-student'),
    ...more,
  });
  return { app, forms };
}

const send = (app: FastifyInstance, method: 'POST' | 'PUT', url: string, payload: object = {}) =>
  app.inject({ method, url, payload });

const post = (app: FastifyInstance, payload: object) =>
  app.inject({ method: 'POST', url: '/api/students', payload });

describe('Student routes', () => {
  it('lists the Students, each marked Active or not', async () => {
    const { app } = buildApp({ outcome: 'student-id-used' });

    const reply = await app.inject({ method: 'GET', url: '/api/students' });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual([
      { ...STUDENT, isActive: true, floor: 1, leaveState: 'In hostel' as const, openLeave: null },
    ]);
  });

  it('answers 201 with the Student when he is added', async () => {
    const { app } = buildApp({ outcome: 'added', student: STUDENT });

    const reply = await post(app, { ...STUDENT, phone: '' });

    expect(reply.statusCode).toBe(201);
    expect(reply.json()).toEqual(STUDENT);
  });

  it('answers 400 and names the invalid fields', async () => {
    const { app } = buildApp({ outcome: 'invalid', fields: ['email'] });

    const reply = await post(app, { ...STUDENT, email: 'wrong' });

    expect(reply.statusCode).toBe(400);
    expect(reply.json()).toEqual({ invalidFields: ['email'] });
  });

  it('answers 409 when the Student ID is already used', async () => {
    const { app } = buildApp({ outcome: 'student-id-used' });

    const reply = await post(app, STUDENT);

    expect(reply.statusCode).toBe(409);
  });

  it('treats a missing or wrong-typed field as empty', async () => {
    const { app, forms } = buildApp({ outcome: 'invalid', fields: ['name'] });

    await post(app, { studentId: 9001 });

    expect(forms[0]).toEqual({ studentId: '', name: '', room: '', email: '', phone: '' });
  });

  describe('editing', () => {
    it('answers 200 with the Student and passes the Student ID from the address', async () => {
      const edits: [string, StudentDetails][] = [];
      const { app } = buildApp(
        { outcome: 'student-id-used' },
        {
          editStudent: (studentId, details) => {
            edits.push([studentId, details]);
            return Promise.resolve({ outcome: 'edited', student: STUDENT });
          },
        },
      );

      const reply = await send(app, 'PUT', '/api/students/9001', { ...STUDENT, studentId: '1' });

      expect(reply.statusCode).toBe(200);
      expect(reply.json()).toEqual(STUDENT);
      expect(edits).toEqual([
        ['9001', { name: STUDENT.name, room: STUDENT.room, email: STUDENT.email, phone: '' }],
      ]);
    });

    it('answers 400 and names the invalid fields', async () => {
      const { app } = buildApp(
        { outcome: 'student-id-used' },
        { editStudent: () => Promise.resolve({ outcome: 'invalid', fields: ['room'] }) },
      );

      const reply = await send(app, 'PUT', '/api/students/9001', STUDENT);

      expect(reply.statusCode).toBe(400);
      expect(reply.json()).toEqual({ invalidFields: ['room'] });
    });

    it('answers 404 for an unknown Student ID', async () => {
      const { app } = buildApp({ outcome: 'student-id-used' });

      const reply = await send(app, 'PUT', '/api/students/9999', STUDENT);

      expect(reply.statusCode).toBe(404);
    });
  });

  describe('Deactivate and Activate', () => {
    it.each([
      ['deactivate', { deactivateStudent: () => Promise.resolve('deactivated' as const) }],
      ['activate', { activateStudent: () => Promise.resolve('activated' as const) }],
    ])('answers 204 when %s is done', async (action, deps) => {
      const { app } = buildApp({ outcome: 'student-id-used' }, deps);

      const reply = await send(app, 'POST', `/api/students/9001/${action}`);

      expect(reply.statusCode).toBe(204);
    });

    it.each([
      ['deactivate', { deactivateStudent: () => Promise.resolve('not-active' as const) }],
      ['activate', { activateStudent: () => Promise.resolve('already-active' as const) }],
    ])('answers 409 when %s has nothing to change', async (action, deps) => {
      const { app } = buildApp({ outcome: 'student-id-used' }, deps);

      const reply = await send(app, 'POST', `/api/students/9001/${action}`);

      expect(reply.statusCode).toBe(409);
    });

    it.each(['deactivate', 'activate'])(
      'answers 404 when asked to %s an unknown Student ID',
      async (action) => {
        const { app } = buildApp({ outcome: 'student-id-used' });

        const reply = await send(app, 'POST', `/api/students/9999/${action}`);

        expect(reply.statusCode).toBe(404);
      },
    );

    it.each(['deactivate', 'activate'] as const)(
      'passes the Student ID from the address and the logged-in Rector to %s',
      async (action) => {
        const asked: [string, string][] = [];
        const record = (studentId: string, doneBy: string) => {
          asked.push([studentId, doneBy]);
          return Promise.resolve('unknown-student' as const);
        };
        const { app } = buildApp(
          { outcome: 'student-id-used' },
          { deactivateStudent: record, activateStudent: record },
        );

        await send(app, 'POST', `/api/students/0042/${action}`);

        expect(asked).toEqual([['0042', RECTOR.email]]);
      },
    );
  });
});
