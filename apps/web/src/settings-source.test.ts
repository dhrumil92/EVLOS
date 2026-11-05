// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpSettingsSource } from './settings-source.js';

// Answers every request with the given status and body, and records what was asked.
function serverAnswers(status: number, body: unknown = null) {
  const asked: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    asked.push({
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
    });
    const text = body === null ? null : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('http Settings source', () => {
  it('loads the Report Recipients', async () => {
    serverAnswers(200, ['office@example.com']);

    expect(await httpSettingsSource.reportRecipients()).toEqual(['office@example.com']);
  });

  it('adds a Report Recipient', async () => {
    const asked = serverAnswers(201);

    const answer = await httpSettingsSource.addReportRecipient('office@example.com');

    expect(answer).toBe('done');
    expect(asked).toEqual([
      { url: '/api/report-recipients', method: 'POST', body: { email: 'office@example.com' } },
    ]);
  });

  it('gives the reason the server refused an address', async () => {
    serverAnswers(409, { message: 'This address is already a Report Recipient.' });

    const answer = await httpSettingsSource.addReportRecipient('office@example.com');

    expect(answer).toBe('This address is already a Report Recipient.');
  });

  it('removes a Report Recipient named in the address', async () => {
    const asked = serverAnswers(204);

    const answer = await httpSettingsSource.removeReportRecipient('office@example.com');

    expect(answer).toBe('done');
    expect(asked[0]).toMatchObject({
      url: '/api/report-recipients/office%40example.com',
      method: 'DELETE',
    });
  });

  it('fails when the server breaks', async () => {
    serverAnswers(500);

    await expect(httpSettingsSource.addReportRecipient('office@example.com')).rejects.toThrow(
      'The server answered 500',
    );
  });
});
