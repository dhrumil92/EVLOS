import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { PublicLiveView } from '../../use-cases/get-public-live-view.js';
import { registerPublicRoutes } from './public-routes.js';

const VIEW: PublicLiveView = {
  day: '2026-11-08',
  present: 42,
  expected: 100,
  slots: Array.from({ length: 50 }, (_, index) => (index === 6 ? 42 : 0)),
  updatedAt: Date.UTC(2026, 10, 8, 2, 12),
};

async function buildApp() {
  const state = { asked: 0, now: Date.UTC(2026, 10, 8, 2, 12) };
  const app = Fastify();
  await registerPublicRoutes(app, {
    getPublicLiveView: () => {
      state.asked++;
      return Promise.resolve(VIEW);
    },
    now: () => state.now,
  });
  return { app, state };
}

const live = (app: Awaited<ReturnType<typeof buildApp>>['app']) =>
  app.inject({ method: 'GET', url: '/api/public/live' });

describe('the Public Live View route', () => {
  it('answers with the numbers, with no login', async () => {
    const { app } = await buildApp();

    const reply = await live(app);

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual(VIEW);
  });

  it('asks search engines not to list it, and browsers not to keep it', async () => {
    const { app } = await buildApp();

    const reply = await live(app);

    expect(reply.headers['x-robots-tag']).toBe('noindex');
    expect(reply.headers['cache-control']).toBe('no-store');
  });

  it('sets no cookie', async () => {
    const { app } = await buildApp();

    const reply = await live(app);

    expect(reply.headers['set-cookie']).toBeUndefined();
  });

  it('works the numbers out at most once every 30 seconds, however many ask', async () => {
    const { app, state } = await buildApp();

    await live(app);
    await live(app);
    state.now += 29_000;
    await live(app);

    expect(state.asked).toBe(1);
  });

  it('works them out again after 30 seconds', async () => {
    const { app, state } = await buildApp();
    await live(app);

    state.now += 30_000;
    await live(app);

    expect(state.asked).toBe(2);
  });

  it('asks once when many viewers ask at the same moment', async () => {
    const { app, state } = await buildApp();

    await Promise.all(Array.from({ length: 5 }, () => live(app)));

    expect(state.asked).toBe(1);
  });

  it('has no other route: the Rector pages and API are not on this server', async () => {
    const { app } = await buildApp();

    for (const url of ['/api/students', '/api/live-view', '/api/reports', '/api/login', '/']) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }
  });

  it('only reads: it refuses anything but GET', async () => {
    const { app } = await buildApp();

    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      expect((await app.inject({ method, url: '/api/public/live' })).statusCode).toBe(404);
    }
  });

  it('takes no input, so anything added to the address is ignored', async () => {
    const { app, state } = await buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: "/api/public/live?day=2026-01-01&studentId=9001'%20OR%201=1",
    });

    expect(reply.json()).toEqual(VIEW);
    expect(state.asked).toBe(1);
  });

  it('refuses one address that asks more than 60 times in a minute', async () => {
    const { app } = await buildApp();

    const replies = [];
    for (let index = 0; index < 61; index++) replies.push(await live(app));

    expect(replies[59]?.statusCode).toBe(200);
    expect(replies[60]?.statusCode).toBe(429);
  });
});
