// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPage, httpAuthSource, SESSION_ENDED } from './auth-source.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPage', () => {
  it('passes a normal answer through', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('[]', { status: 200 })));

    const reply = await fetchPage('/api/students');

    expect(reply.status).toBe(200);
  });

  it('announces that the session ended when the server answers 401', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 401 })));
    let announced = 0;
    const listener = () => {
      announced++;
    };
    window.addEventListener(SESSION_ENDED, listener);

    await expect(fetchPage('/api/students')).rejects.toThrow('Log in again');

    window.removeEventListener(SESSION_ENDED, listener);
    expect(announced).toBe(1);
  });
});

// Answers every request with the given status and body, and records what was asked.
function serverAnswers(status: number, body: unknown = null) {
  const asked: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    asked.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    const text = body === null ? null : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  return asked;
}

describe('forgotten password', () => {
  it('asks for a reset link for the email typed', async () => {
    const asked = serverAnswers(204);

    const answer = await httpAuthSource.requestPasswordReset('rector@example.com');

    expect(answer).toBe('sent');
    expect(asked).toEqual([{ url: '/api/forgot-password', body: { email: 'rector@example.com' } }]);
  });

  it('says when to try again after too many requests', async () => {
    serverAnswers(429);

    expect(await httpAuthSource.requestPasswordReset('rector@example.com')).toBe('too-many');
  });

  it('sets the new password with the token from the link', async () => {
    const asked = serverAnswers(204);

    const answer = await httpAuthSource.resetPassword('the-token', 'a new long password');

    expect(answer).toBe('done');
    expect(asked).toEqual([
      {
        url: '/api/reset-password',
        body: { token: 'the-token', newPassword: 'a new long password' },
      },
    ]);
  });

  it('gives the reason the link could not be used', async () => {
    serverAnswers(400, {
      message: 'This link has expired or was already used. Ask for a new one.',
    });

    const answer = await httpAuthSource.resetPassword('the-token', 'a new long password');

    expect(answer).toBe('This link has expired or was already used. Ask for a new one.');
  });

  it('says when to try again after too many tries with a link', async () => {
    serverAnswers(429);

    expect(await httpAuthSource.resetPassword('the-token', 'a new long password')).toBe(
      'Too many tries. Wait 15 minutes, then try again.',
    );
  });
});
