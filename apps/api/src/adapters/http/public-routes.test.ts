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

// trustProxy as on the VM, where Caddy passes on each viewer's own address.
async function buildApp(trustProxy = false) {
  const state = { asked: 0, now: Date.UTC(2026, 10, 8, 2, 12) };
  const app = Fastify({ trustProxy });
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

  // All the Students on the hostel Wi-Fi share one internet address, and each page asks twice a
  // minute, so the limit must let 360 Students watch from one address.
  it('lets one address ask 1200 times in a minute, enough for every Student on one Wi-Fi', async () => {
    const { app } = await buildApp();

    const replies = [];
    for (let index = 0; index < 1201; index++) replies.push(await live(app));

    expect(replies[1199]?.statusCode).toBe(200);
    expect(replies[1200]?.statusCode).toBe(429);
  });

  it('counts each viewer by his own address when Caddy passes it on', async () => {
    const { app } = await buildApp(true);
    const from = (address: string) =>
      app.inject({
        method: 'GET',
        url: '/api/public/live',
        headers: { 'x-forwarded-for': address },
      });

    for (let index = 0; index < 1200; index++) await from('203.0.113.7');

    expect((await from('203.0.113.7')).statusCode).toBe(429);
    expect((await from('198.51.100.9')).statusCode).toBe(200);
  });
});
