import type { FastifyInstance } from 'fastify';
import type { PresenceRequest, VidyalayaPresence } from '../../use-cases/get-vidyalaya-presence.js';
import { presenceFileName, presenceXlsx } from '../report/presence-xlsx.js';

export interface PresenceRoutesDeps {
  getPresence(request: PresenceRequest): Promise<VidyalayaPresence | null>;
}

type Query = Record<string, string | undefined>;

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// A Day or a month only: Vidyalaya Presence has no range of dates. Null for anything else.
function requestFrom(query: Query): PresenceRequest | null {
  if (query.view === 'Day') return { view: 'Day', day: query.day ?? '' };
  if (query.view === 'Month') return { view: 'Month', month: query.month ?? '' };
  return null;
}

export function registerPresenceRoutes(app: FastifyInstance, deps: PresenceRoutesDeps): void {
  // Vidyalaya Presence as an Excel file to download from the Students page (FR-16).
  app.get<{ Querystring: Query }>('/api/vidyalaya-presence/xlsx', async (request, reply) => {
    const asked = requestFrom(request.query);
    const presence = asked && (await deps.getPresence(asked));
    if (!asked || !presence) {
      return reply
        .code(400)
        .send({ message: 'This Vidyalaya Presence cannot be made. Check the date.' });
    }
    return reply
      .type(XLSX_TYPE)
      .header('Content-Disposition', `attachment; filename="${presenceFileName(asked)}"`)
      .send(await presenceXlsx(presence));
  });
}
