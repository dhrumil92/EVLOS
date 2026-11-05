import type { FastifyInstance } from 'fastify';
import { rectorOf } from './auth-routes.js';
import type {
  AddReportRecipientResult,
  RemoveReportRecipientResult,
} from '../../use-cases/report-recipients.js';

export interface ReportRecipientRoutesDeps {
  listReportRecipients(): Promise<string[]>;
  addReportRecipient(email: string, doneBy: string): Promise<AddReportRecipientResult>;
  removeReportRecipient(email: string, doneBy: string): Promise<RemoveReportRecipientResult>;
}

// The answer for each outcome of Add and Remove.
const REPLIES: Record<AddReportRecipientResult | RemoveReportRecipientResult, [number, string?]> = {
  added: [201],
  removed: [204],
  'not-an-email-address': [400, 'This is not an email address.'],
  'already-a-report-recipient': [409, 'This address is already a Report Recipient.'],
  'not-a-report-recipient': [404, 'This address is not a Report Recipient.'],
};

function emailFrom(body: unknown): string {
  const email = ((body ?? {}) as Record<string, unknown>).email;
  return typeof email === 'string' ? email : '';
}

// The Report Recipients, kept by the Rector on the Settings page. Each change records the
// Rector who is logged in.
export function registerReportRecipientRoutes(
  app: FastifyInstance,
  deps: ReportRecipientRoutesDeps,
): void {
  app.get('/api/report-recipients', () => deps.listReportRecipients());

  app.post('/api/report-recipients', async (request, reply) => {
    const result = await deps.addReportRecipient(emailFrom(request.body), rectorOf(request).email);
    const [code, message] = REPLIES[result];
    return message ? reply.code(code).send({ message }) : reply.code(code).send();
  });

  app.delete<{ Params: { email: string } }>(
    '/api/report-recipients/:email',
    async (request, reply) => {
      const result = await deps.removeReportRecipient(
        request.params.email,
        rectorOf(request).email,
      );
      const [code, message] = REPLIES[result];
      return message ? reply.code(code).send({ message }) : reply.code(code).send();
    },
  );
}
