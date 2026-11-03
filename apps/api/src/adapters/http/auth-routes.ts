import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Rector } from '../../ports/rector-repository.js';
import type { LogInResult } from '../../use-cases/rector-login.js';

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
  // True once the site runs on HTTPS, so the browser never sends the cookie in clear.
  secureCookie: boolean;
}

export const SESSION_COOKIE = 'evlos_session';
const LOGIN_URL = '/api/login';

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
    if (request.url.split('?')[0] === LOGIN_URL) return;
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

  app.post(
    LOGIN_URL,
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
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
    },
  );

  app.post('/api/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deps.logOut(token);
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
  });

  app.get('/api/me', (request) => ({ email: rectorOf(request).email }));
}
