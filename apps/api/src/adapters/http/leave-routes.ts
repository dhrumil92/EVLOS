import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LeaveForm, LeaveRefusal, LeaveResult, ReturnForm } from '../../use-cases/leaves.js';
import type { ManyLeaveRow, ManyReturnRow, RowResult } from '../../use-cases/leaves-for-many.js';
import { rectorOf } from './auth-routes.js';

export interface LeaveRoutesDeps {
  recordLeave(studentId: string, form: LeaveForm, doneBy: string): Promise<LeaveResult>;
  editLeave(studentId: string, form: LeaveForm, doneBy: string): Promise<LeaveResult>;
  cancelLeave(studentId: string, doneBy: string): Promise<LeaveResult>;
  returnLeave(studentId: string, form: ReturnForm, doneBy: string): Promise<LeaveResult>;
  recordLeaves(rows: ManyLeaveRow[], doneBy: string): Promise<RowResult[]>;
  returnLeaves(rows: ManyReturnRow[], doneBy: string): Promise<RowResult[]>;
}

// Enough for every Student in the hostel at once.
const MAX_ROWS = 400;

interface ByStudentId {
  Params: { studentId: string };
}
type Request = FastifyRequest<ByStudentId>;

// The page shows its own words for each reason; the server only names it.
const REFUSAL_CODES: Partial<Record<LeaveRefusal, number>> = {
  'invalid-time': 400,
  'unknown-student': 404,
};

function textsFrom<Name extends string>(body: unknown, names: readonly Name[]) {
  const fields = (body ?? {}) as Record<string, unknown>;
  const texts = {} as Record<Name, string>;
  for (const name of names) {
    const value = fields[name];
    texts[name] = typeof value === 'string' ? value : '';
  }
  return texts;
}

const leaveForm = (body: unknown): LeaveForm =>
  textsFrom(body, ['outDay', 'outTime', 'expectedReturnDay', 'expectedReturnTime']);
const returnForm = (body: unknown): ReturnForm => textsFrom(body, ['returnDay', 'returnTime']);

// The rows list of a many-Students request, or null when it is missing, empty or too long.
function rowsFrom(body: unknown): unknown[] | null {
  const rows = (body as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_ROWS ? rows : null;
}

const studentIdOf = (row: unknown) => textsFrom(row, ['studentId']).studentId;

function answer(reply: FastifyReply, result: LeaveResult) {
  if (result.outcome === 'done') return reply.code(204).send();
  return reply.code(REFUSAL_CODES[result.reason] ?? 409).send({ reason: result.reason });
}

export function registerLeaveRoutes(app: FastifyInstance, deps: LeaveRoutesDeps): void {
  const leaveUrl = '/api/students/:studentId/leave';
  const by = (request: Request) => rectorOf(request).email;

  app.post<ByStudentId>(leaveUrl, async (request, reply) =>
    answer(
      reply,
      await deps.recordLeave(request.params.studentId, leaveForm(request.body), by(request)),
    ),
  );
  app.put<ByStudentId>(leaveUrl, async (request, reply) =>
    answer(
      reply,
      await deps.editLeave(request.params.studentId, leaveForm(request.body), by(request)),
    ),
  );
  app.post<ByStudentId>(`${leaveUrl}/cancel`, async (request, reply) =>
    answer(reply, await deps.cancelLeave(request.params.studentId, by(request))),
  );
  app.post<ByStudentId>('/api/students/:studentId/return', async (request, reply) =>
    answer(
      reply,
      await deps.returnLeave(request.params.studentId, returnForm(request.body), by(request)),
    ),
  );

  app.post('/api/leaves/many', async (request, reply) => {
    const rows = rowsFrom(request.body);
    if (rows === null) return reply.code(400).send({ reason: 'invalid-rows' });
    const leaves = rows.map((row) => ({ studentId: studentIdOf(row), ...leaveForm(row) }));
    return { results: await deps.recordLeaves(leaves, rectorOf(request).email) };
  });
  app.post('/api/returns/many', async (request, reply) => {
    const rows = rowsFrom(request.body);
    if (rows === null) return reply.code(400).send({ reason: 'invalid-rows' });
    const returns = rows.map((row) => ({ studentId: studentIdOf(row), ...returnForm(row) }));
    return { results: await deps.returnLeaves(returns, rectorOf(request).email) };
  });
}
