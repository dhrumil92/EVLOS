// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpDeviceStatusSource } from './device-status-source.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('http Device status source', () => {
  it("loads the Device's Last Seen", async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      return Promise.resolve(
        new Response(JSON.stringify({ lastSeenAt: 1793899740000, isQuiet: false }), {
          status: 200,
        }),
      );
    });

    const status = await httpDeviceStatusSource.load();

    expect(status).toEqual({ lastSeenAt: 1793899740000, isQuiet: false });
    expect(asked).toEqual(['/api/device-status']);
  });

  it('fails when the server breaks', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 500 })));

    await expect(httpDeviceStatusSource.load()).rejects.toThrow('The server answered 500');
  });
});
