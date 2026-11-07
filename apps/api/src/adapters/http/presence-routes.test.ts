import Fastify from 'fastify';
import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { PresenceRequest, VidyalayaPresence } from '../../use-cases/get-vidyalaya-presence.js';
import { registerPresenceRoutes } from './presence-routes.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PRESENCE: VidyalayaPresence = {
  days: ['2026-11-03'],
  rows: [{ room: '101', name: 'Asha Rao', states: ['Away'] }],
};

function buildApp(answer: VidyalayaPresence | null = PRESENCE) {
  const asked: PresenceRequest[] = [];
  const app = Fastify();
  registerPresenceRoutes(app, {
    getPresence: (request) => {
      asked.push(request);
      return Promise.resolve(answer);
    },
  });
  return { app, asked };
}

describe('Vidyalaya Presence route', () => {
  it.each([
    ['a Day', 'view=Day&day=2026-11-03', { view: 'Day', day: '2026-11-03' }],
    ['a month', 'view=Month&month=2026-11', { view: 'Month', month: '2026-11' }],
  ])('asks for %s', async (_what, query, request) => {
    const { app, asked } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: `/api/vidyalaya-presence/xlsx?${query}`,
    });

    expect(reply.statusCode).toBe(200);
    expect(asked).toEqual([request]);
  });

  it('sends an Excel file to download, named for the Day', async () => {
    const { app } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-03',
    });

    expect(reply.headers['content-type']).toBe(XLSX_TYPE);
    expect(reply.headers['content-disposition']).toBe(
      'attachment; filename="vidyalaya-presence-2026-11-03.xlsx"',
    );
  });

  it('names the file for the month', async () => {
    const { app } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Month&month=2026-11',
    });

    expect(reply.headers['content-disposition']).toBe(
      'attachment; filename="vidyalaya-presence-2026-11.xlsx"',
    );
  });

  it('holds the Students as In hostel or Away', async () => {
    const { app } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-03',
    });

    expect(await readSheet(reply.rawPayload)).toEqual([
      ['Room', 'Name', '2026-11-03', 'Days In hostel', 'Days Away'],
      ['101', 'Asha Rao', 'Away', 0, 1],
    ]);
  });

  it('has no date range: it answers 400 and asks for nothing', async () => {
    const { app, asked } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Date%20range&from=2026-11-01&to=2026-11-03',
    });

    expect(reply.statusCode).toBe(400);
    expect(asked).toEqual([]);
  });

  it('answers 400 for an unknown view, or none', async () => {
    const { app, asked } = buildApp();

    const unknown = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Year&year=2026',
    });
    const none = await app.inject({ method: 'GET', url: '/api/vidyalaya-presence/xlsx' });

    expect(unknown.statusCode).toBe(400);
    expect(none.statusCode).toBe(400);
    expect(asked).toEqual([]);
  });

  it('answers 400 when it cannot be made, such as a Day after today', async () => {
    const { app } = buildApp(null);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/vidyalaya-presence/xlsx?view=Day&day=2030-01-01',
    });

    expect(reply.statusCode).toBe(400);
    expect(reply.json()).toEqual({
      message: 'This Vidyalaya Presence cannot be made. Check the date.',
    });
  });
});
