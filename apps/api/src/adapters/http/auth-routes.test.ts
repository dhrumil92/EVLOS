import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { AuthRoutesDeps } from './auth-routes.js';
import { registerAuth, SESSION_COOKIE } from './auth-routes.js';

const RECTOR = { id: 1, email: 'rector@example.com' };
const EXPIRES_AT = Date.UTC(2026, 10, 3, 15, 0, 0);

async function buildApp(more: Partial<AuthRoutesDeps> = {}) {
  const loggedOut: string[] = [];
  const app = Fastify();
  await registerAuth(app, {
    logIn: (email, password) =>
      Promise.resolve(
        email === RECTOR.email && password === 'right password'
          ? { outcome: 'logged-in', token: 'the-token', expiresAt: EXPIRES_AT }
          : { outcome: 'refused' },
      ),
    logOut: (token) => {
      loggedOut.push(token);
      return Promise.resolve();
    },
    rectorOfSession: (token) => Promise.resolve(token === 'the-token' ? RECTOR : null),
    changePassword: () => Promise.resolve('changed'),
    secureCookie: false,
    ...more,
  });
  app.get('/api/students', (request) => ({ askedBy: request.rector?.email }));
  return { app, loggedOut };
}

const logIn = (app: Awaited<ReturnType<typeof buildApp>>['app'], password: string) =>
  app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: RECTOR.email, password },
  });
const withSession = { [SESSION_COOKIE]: 'the-token' };

describe('Rector login', () => {
  it('sets an HttpOnly, SameSite=Strict session cookie for the right password', async () => {
    const { app } = await buildApp();

    const reply = await logIn(app, 'right password');

    expect(reply.statusCode).toBe(204);
    const cookie = reply.cookies.find((one) => one.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({
      value: 'the-token',
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      expires: new Date(EXPIRES_AT),
    });
    expect(cookie?.secure).toBeUndefined();
  });

  it('marks the cookie Secure when the site runs on HTTPS', async () => {
    const { app } = await buildApp({ secureCookie: true });

    const reply = await logIn(app, 'right password');

    expect(reply.cookies[0]?.secure).toBe(true);
  });

  it('answers 401 with one message for any wrong email or password', async () => {
    const { app } = await buildApp();

    const reply = await logIn(app, 'wrong password');

    expect(reply.statusCode).toBe(401);
    expect(reply.json()).toEqual({ message: 'Email or password is wrong.' });
    expect(reply.cookies).toEqual([]);
  });

  it('refuses a sixth try from one address within 15 minutes', async () => {
    const { app } = await buildApp();
    for (let tries = 0; tries < 5; tries++) {
      await logIn(app, 'wrong password');
    }

    const reply = await logIn(app, 'right password');

    expect(reply.statusCode).toBe(429);
  });
});

describe('pages need a login', () => {
  it('answers 401 without a session cookie', async () => {
    const { app } = await buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/students' });

    expect(reply.statusCode).toBe(401);
  });

  it('answers 401 for an unknown or expired session', async () => {
    const { app } = await buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/students',
      cookies: { [SESSION_COOKIE]: 'old-token' },
    });

    expect(reply.statusCode).toBe(401);
  });

  it('lets a logged-in Rector through and says who asked', async () => {
    const { app } = await buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/students', cookies: withSession });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual({ askedBy: RECTOR.email });
  });

  it('tells the page who is logged in', async () => {
    const { app } = await buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/me', cookies: withSession });

    expect(reply.json()).toEqual({ email: RECTOR.email });
  });
});

describe('log out', () => {
  it('ends the session and clears the cookie', async () => {
    const { app, loggedOut } = await buildApp();

    const reply = await app.inject({ method: 'POST', url: '/api/logout', cookies: withSession });

    expect(reply.statusCode).toBe(204);
    expect(loggedOut).toEqual(['the-token']);
    expect(reply.cookies[0]).toMatchObject({ name: SESSION_COOKIE, value: '' });
  });
});

describe('change password', () => {
  const changePassword = (
    app: Awaited<ReturnType<typeof buildApp>>['app'],
    cookies: Record<string, string> = withSession,
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/password',
      cookies,
      payload: { currentPassword: 'right password', newPassword: 'a new long password' },
    });

  it('changes the password of the Rector who is logged in, keeping this login', async () => {
    const asked: unknown[] = [];
    const { app } = await buildApp({
      changePassword: (...args) => {
        asked.push(args);
        return Promise.resolve('changed');
      },
    });

    const reply = await changePassword(app);

    expect(reply.statusCode).toBe(204);
    expect(asked).toEqual([[RECTOR, 'the-token', 'right password', 'a new long password']]);
  });

  it.each([
    ['wrong-password', 403, 'The current password is wrong.'],
    ['password-too-short', 400, 'The new password needs at least 12 characters.'],
    ['same-password', 400, 'The new password is the same as the current one.'],
  ] as const)('answers %s with %i and says why', async (result, code, message) => {
    const { app } = await buildApp({ changePassword: () => Promise.resolve(result) });

    const reply = await changePassword(app);

    expect(reply.statusCode).toBe(code);
    expect(reply.json()).toEqual({ message });
  });

  it('needs a login', async () => {
    const { app } = await buildApp();

    const reply = await changePassword(app, {});

    expect(reply.statusCode).toBe(401);
  });

  it('refuses a sixth try within 15 minutes', async () => {
    const { app } = await buildApp({ changePassword: () => Promise.resolve('wrong-password') });
    for (let tries = 0; tries < 5; tries++) {
      await changePassword(app);
    }

    const reply = await changePassword(app);

    expect(reply.statusCode).toBe(429);
  });
});
