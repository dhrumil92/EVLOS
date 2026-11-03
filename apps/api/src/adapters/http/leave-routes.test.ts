import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { LeaveForm, LeaveResult, ReturnForm } from '../../use-cases/leaves.js';
import type { LeaveRoutesDeps } from './leave-routes.js';
import { registerLeaveRoutes } from './leave-routes.js';

const RECTOR = { id: 1, email: 'rector@example.com' };
const LEAVE_FORM: LeaveForm = {
  outDay: '2026-11-03',
  outTime: '08:15',
  expectedReturnDay: '2026-11-05',
  expectedReturnTime: '18:00',
};
const RETURN_FORM: ReturnForm = { returnDay: '2026-11-03', returnTime: '19:30' };
const DONE: LeaveResult = { outcome: 'done' };

function buildApp(answer: LeaveResult = DONE) {
  const calls: unknown[][] = [];
  const reply = (...args: unknown[]) => {
    calls.push(args);
    return Promise.resolve(answer);
  };
  const deps: LeaveRoutesDeps = {
    recordLeave: reply,
    editLeave: reply,
    cancelLeave: reply,
    returnLeave: reply,
    recordLeaves: () => Promise.resolve([]),
    returnLeaves: () => Promise.resolve([]),
  };
  const app = Fastify();
  // Stands in for the login check, which has its own tests.
  app.decorateRequest('rector', null);
  app.addHook('onRequest', (request, _reply, done) => {
    request.rector = RECTOR;
    done();
  });
  registerLeaveRoutes(app, deps);
  return { app, calls };
}

describe('Leave routes', () => {
  it.each([
    ['records a Leave', 'POST', '/api/students/9001/leave', LEAVE_FORM],
    ['edits the open Leave', 'PUT', '/api/students/9001/leave', LEAVE_FORM],
    ['records a Return', 'POST', '/api/students/9001/return', RETURN_FORM],
  ] as const)(
    '%s with the typed times, the Student ID and the Rector',
    async (_what, method, url, form) => {
      const { app, calls } = buildApp();

      const reply = await app.inject({ method, url, payload: form });

      expect(reply.statusCode).toBe(204);
      expect(calls).toEqual([['9001', form, RECTOR.email]]);
    },
  );

  it('cancels the open Leave', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({ method: 'POST', url: '/api/students/9001/leave/cancel' });

    expect(reply.statusCode).toBe(204);
    expect(calls).toEqual([['9001', RECTOR.email]]);
  });

  it('treats missing or wrong-typed times as empty', async () => {
    const { app, calls } = buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/students/9001/return',
      payload: { returnDay: 3 },
    });

    expect(calls[0]?.[1]).toEqual({ returnDay: '', returnTime: '' });
  });

  it.each([
    ['invalid-time', 400],
    ['unknown-student', 404],
    ['out-time-in-future', 409],
    ['already-away', 409],
    ['no-open-leave', 409],
  ] as const)('answers a refusal for %s with %i and the reason', async (reason, code) => {
    const { app } = buildApp({ outcome: 'refused', reason });

    const reply = await app.inject({
      method: 'POST',
      url: '/api/students/9001/leave',
      payload: LEAVE_FORM,
    });

    expect(reply.statusCode).toBe(code);
    expect(reply.json()).toEqual({ reason });
  });
});

describe('Leave and Return for many Students', () => {
  function buildManyApp() {
    const calls: unknown[][] = [];
    const deps: LeaveRoutesDeps = {
      recordLeave: () => Promise.resolve(DONE),
      editLeave: () => Promise.resolve(DONE),
      cancelLeave: () => Promise.resolve(DONE),
      returnLeave: () => Promise.resolve(DONE),
      recordLeaves: (rows, doneBy) => {
        calls.push([rows, doneBy]);
        return Promise.resolve(
          rows.map((row) => ({ studentId: row.studentId, outcome: 'done' as const })),
        );
      },
      returnLeaves: (rows, doneBy) => {
        calls.push([rows, doneBy]);
        return Promise.resolve(
          rows.map((row) => ({
            studentId: row.studentId,
            outcome: 'refused' as const,
            reason: 'no-open-leave' as const,
          })),
        );
      },
    };
    const app = Fastify();
    app.decorateRequest('rector', null);
    app.addHook('onRequest', (request, _reply, done) => {
      request.rector = RECTOR;
      done();
    });
    registerLeaveRoutes(app, deps);
    return { app, calls };
  }

  it('records the Leaves and answers each row', async () => {
    const { app, calls } = buildManyApp();
    const rows = [{ studentId: '9001', ...LEAVE_FORM }];

    const reply = await app.inject({ method: 'POST', url: '/api/leaves/many', payload: { rows } });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual({ results: [{ studentId: '9001', outcome: 'done' }] });
    expect(calls).toEqual([[rows, RECTOR.email]]);
  });

  it('records the Returns and answers each row with its reason', async () => {
    const { app } = buildManyApp();
    const rows = [{ studentId: '9001', ...RETURN_FORM }];

    const reply = await app.inject({ method: 'POST', url: '/api/returns/many', payload: { rows } });

    expect(reply.json()).toEqual({
      results: [{ studentId: '9001', outcome: 'refused', reason: 'no-open-leave' }],
    });
  });

  it('keeps only the expected text fields of each row', async () => {
    const { app, calls } = buildManyApp();

    await app.inject({
      method: 'POST',
      url: '/api/returns/many',
      payload: { rows: [{ studentId: 9001, returnDay: '2026-11-03', extra: 'x' }] },
    });

    expect(calls[0]?.[0]).toEqual([{ studentId: '', returnDay: '2026-11-03', returnTime: '' }]);
  });

  it.each([
    ['no rows list', {}],
    ['an empty list', { rows: [] }],
    ['more than 400 rows', { rows: Array.from({ length: 401 }, () => ({ studentId: '9001' })) }],
  ])('answers 400 for %s and saves nothing', async (_what, payload) => {
    const { app, calls } = buildManyApp();

    const reply = await app.inject({ method: 'POST', url: '/api/leaves/many', payload });

    expect(reply.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });
});
