import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Rector } from '../../ports/rector-repository.js';
import type { ResetPasswordResult } from '../../use-cases/password-reset.js';
import type { ChangePasswordResult, LogInResult } from '../../use-cases/rector-login.js';

declare module 'fastify' {
  interface FastifyRequest {
    // The logged-in Rector. Set for every page route except login itself.
    rector: Rector | null;
  }
}

export interface AuthRoutesDeps {
  logIn(email: string, password: string): Promise<LogInResult>;
  logOut(token: string): Promise<void>;
  rectorOfSession(token: string): Promise<Rector | null>;
  changePassword(
    rector: Rector,
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult>;
  // Emails a reset link when the email belongs to a Rector. The answer to the page is the
  // same either way, so it is not waited for.
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult>;
  // True once the site runs on HTTPS, so the browser never sends the cookie in clear.
  secureCookie: boolean;
}

export const SESSION_COOKIE = 'evlos_session';
const LOGIN_URL = '/api/login';
const FORGOT_URL = '/api/forgot-password';
const RESET_URL = '/api/reset-password';
// The only page routes reachable without a login: a Rector who is logged out uses them.
const OPEN_URLS = new Set([LOGIN_URL, FORGOT_URL, RESET_URL]);
// Five tries in 15 minutes from one address, so a password cannot be guessed by trying.
const FIVE_TRIES = { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } };

// The answer for each outcome of a password change. A wrong current password is 403, not
// 401: 401 would tell the page that the login has ended.
const PASSWORD_REPLIES: Record<ChangePasswordResult, [number, string?]> = {
  changed: [204],
  'wrong-password': [403, 'The current password is wrong.'],
  'password-too-short': [400, 'The new password needs at least 12 characters.'],
  'same-password': [400, 'The new password is the same as the current one.'],
};

const RESET_REPLIES: Record<ResetPasswordResult, [number, string?]> = {
  reset: [204],
  'password-too-short': [400, 'The new password needs at least 12 characters.'],
  'link-not-valid': [400, 'This link has expired or was already used. Ask for a new one.'],
};

const text = (body: unknown, name: string) => {
  const value = (body as Record<string, unknown> | null)?.[name];
  return typeof value === 'string' ? value : '';
};

// The one Rector the request belongs to. The login check guarantees there is one.
export function rectorOf(request: FastifyRequest): Rector {
  if (request.rector === null) {
    throw new Error('A page route ran without a logged-in Rector.');
  }
  return request.rector;
}

function requireLogin(deps: AuthRoutesDeps) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (OPEN_URLS.has(request.url.split('?')[0] ?? '')) return;
    const token = request.cookies[SESSION_COOKIE];
    request.rector = token ? await deps.rectorOfSession(token) : null;
    if (request.rector === null) {
      return reply.code(401).send({ message: 'Log in first.' });
    }
  };
}

// Register before any page route, so every one of them needs a login (FR-13).
export async function registerAuth(app: FastifyInstance, deps: AuthRoutesDeps): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.decorateRequest('rector', null);
  app.addHook('onRequest', requireLogin(deps));

  app.post(LOGIN_URL, FIVE_TRIES, async (request, reply) => {
    const result = await deps.logIn(text(request.body, 'email'), text(request.body, 'password'));
    if (result.outcome === 'refused') {
      return reply.code(401).send({ message: 'Email or password is wrong.' });
    }
    return reply
      .setCookie(SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        expires: new Date(result.expiresAt),
        secure: deps.secureCookie,
      })
      .code(204)
      .send();
  });

  app.post('/api/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deps.logOut(token);
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
  });

  app.get('/api/me', (request) => ({ email: rectorOf(request).email }));

  // The logged-in Rector changes the password; this login stays, every other one ends.
  app.post('/api/password', FIVE_TRIES, async (request, reply) => {
    const result = await deps.changePassword(
      rectorOf(request),
      request.cookies[SESSION_COOKIE] ?? '',
      text(request.body, 'currentPassword'),
      text(request.body, 'newPassword'),
    );
    const [code, message] = PASSWORD_REPLIES[result];
    return message ? reply.code(code).send({ message }) : reply.code(code).send();
  });

  // Always the same quick answer, whether or not the email has an account and whether or not
  // the email could be sent, so nobody can learn which emails have an account.
  app.post(FORGOT_URL, FIVE_TRIES, (request, reply) => {
    deps.requestPasswordReset(text(request.body, 'email')).catch((error: unknown) => {
      request.log.error(error, 'Password reset email not sent');
    });
    return reply.code(204).send();
  });

  app.post(RESET_URL, FIVE_TRIES, async (request, reply) => {
    const result = await deps.resetPassword(
      text(request.body, 'token'),
      text(request.body, 'newPassword'),
    );
    const [code, message] = RESET_REPLIES[result];
    return message ? reply.code(code).send({ message }) : reply.code(code).send();
  });
}
