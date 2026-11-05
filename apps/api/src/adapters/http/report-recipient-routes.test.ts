import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type {
  AddReportRecipientResult,
  RemoveReportRecipientResult,
} from '../../use-cases/report-recipients.js';
import { registerReportRecipientRoutes } from './report-recipient-routes.js';

const RECTOR = { id: 1, email: 'rector@example.com' };

function buildApp(
  added: AddReportRecipientResult = 'added',
  removed: RemoveReportRecipientResult = 'removed',
) {
  const calls: [string, string, string][] = [];
  const app = Fastify();
  // Stands in for the login check, which has its own tests.
  app.decorateRequest('rector', null);
  app.addHook('onRequest', (request, _reply, done) => {
    request.rector = RECTOR;
    done();
  });
  registerReportRecipientRoutes(app, {
    listReportRecipients: () => Promise.resolve(['office@example.com']),
    addReportRecipient: (email, doneBy) => {
      calls.push(['add', email, doneBy]);
      return Promise.resolve(added);
    },
    removeReportRecipient: (email, doneBy) => {
      calls.push(['remove', email, doneBy]);
      return Promise.resolve(removed);
    },
  });
  return { app, calls };
}

describe('Report Recipient routes', () => {
  it('lists the Report Recipients', async () => {
    const { app } = buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/report-recipients' });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual(['office@example.com']);
  });

  it('adds an address for the Rector who is logged in', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: '/api/report-recipients',
      payload: { email: 'office@example.com' },
    });

    expect(reply.statusCode).toBe(201);
    expect(calls).toEqual([['add', 'office@example.com', RECTOR.email]]);
  });

  it.each([
    ['not-an-email-address', 400, 'This is not an email address.'],
    ['already-a-report-recipient', 409, 'This address is already a Report Recipient.'],
  ] as const)('answers %s with %i and says why', async (result, code, message) => {
    const { app } = buildApp(result);

    const reply = await app.inject({
      method: 'POST',
      url: '/api/report-recipients',
      payload: { email: 'office@example.com' },
    });

    expect(reply.statusCode).toBe(code);
    expect(reply.json()).toEqual({ message });
  });

  it('treats a missing email as text that is not an email address', async () => {
    const { app, calls } = buildApp('not-an-email-address');

    const reply = await app.inject({ method: 'POST', url: '/api/report-recipients' });

    expect(reply.statusCode).toBe(400);
    expect(calls).toEqual([['add', '', RECTOR.email]]);
  });

  it('removes the address named in the path', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({
      method: 'DELETE',
      url: '/api/report-recipients/office%40example.com',
    });

    expect(reply.statusCode).toBe(204);
    expect(calls).toEqual([['remove', 'office@example.com', RECTOR.email]]);
  });

  it('answers 404 when the address to remove is not a Report Recipient', async () => {
    const { app } = buildApp('added', 'not-a-report-recipient');

    const reply = await app.inject({
      method: 'DELETE',
      url: '/api/report-recipients/other%40example.com',
    });

    expect(reply.statusCode).toBe(404);
    expect(reply.json()).toEqual({ message: 'This address is not a Report Recipient.' });
  });
});
