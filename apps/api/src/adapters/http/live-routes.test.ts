import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { LiveView } from '../../use-cases/get-live-view.js';
import { LiveViewers, registerLiveRoutes } from './live-routes.js';

const VIEW: LiveView = { day: '2026-11-10', studentsPresent: 0, activeStudents: 0, punches: [] };

describe('live view routes', () => {
  const app = Fastify();
  const viewers = new LiveViewers();
  registerLiveRoutes(app, { viewers, getLiveView: () => Promise.resolve(VIEW) });

  it('answers with the live view', async () => {
    const reply = await app.inject({ method: 'GET', url: '/api/live-view' });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual(VIEW);
  });

  it('tells an open page when Punches change', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const stop = new AbortController();
    const reply = await fetch(`${address}/api/live-view/events`, { signal: stop.signal });
    const stream = reply.body?.getReader();

    viewers.punchesChanged();
    const first = await stream?.read();

    expect(reply.headers.get('content-type')).toContain('text/event-stream');
    expect(new TextDecoder().decode(first?.value)).toContain('data: punches-changed');
    stop.abort();
    await app.close();
  });
});

describe('LiveViewers', () => {
  it('stops telling a page that has closed', () => {
    const viewers = new LiveViewers();
    let told = 0;
    const remove = viewers.add(() => {
      told += 1;
    });

    remove();
    viewers.punchesChanged();

    expect(told).toBe(0);
  });
});
