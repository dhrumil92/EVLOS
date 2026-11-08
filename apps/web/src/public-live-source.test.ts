import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpPublicLiveSource } from './public-live-source.js';

const VIEW = { day: '2026-11-08', present: 42, expected: 100, slots: [], updatedAt: 1 };

function answer(status: number, body: unknown) {
  const asked: [string, RequestInit | undefined][] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    asked.push([url, init]);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Public Live View source', () => {
  it('asks the public route for the numbers', async () => {
    const asked = answer(200, VIEW);

    expect(await httpPublicLiveSource.load()).toEqual(VIEW);
    expect(asked[0]?.[0]).toBe('/api/public/live');
  });

  it("never sends the Rector's login cookie with it", async () => {
    const asked = answer(200, VIEW);

    await httpPublicLiveSource.load();

    expect(asked[0]?.[1]?.credentials).toBe('omit');
  });

  it('fails when the server refuses, such as too many asks', async () => {
    answer(429, { message: 'Too many' });

    await expect(httpPublicLiveSource.load()).rejects.toThrow('429');
  });
});
