// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPage, SESSION_ENDED } from './auth-source.js';

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
