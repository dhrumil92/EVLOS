import { describe, expect, it } from 'vitest';
import { listenHostFrom } from './listen-host.js';

describe('listenHostFrom', () => {
  it('listens on this machine only when the setting is not set', () => {
    expect(listenHostFrom({}, 'PAGE_HOST')).toBe('127.0.0.1');
    expect(listenHostFrom({ PAGE_HOST: '  ' }, 'PAGE_HOST')).toBe('127.0.0.1');
  });

  it('uses the address in the setting, so Caddy in another container can reach the server', () => {
    expect(listenHostFrom({ PAGE_HOST: '0.0.0.0' }, 'PAGE_HOST')).toBe('0.0.0.0');
  });

  it('reads the setting it is asked for, so the page and the Public Live View are set apart', () => {
    const env = { PAGE_HOST: '0.0.0.0', PUBLIC_HOST: '10.0.0.5' };
    expect(listenHostFrom(env, 'PUBLIC_HOST')).toBe('10.0.0.5');
  });

  it('stops the server for a setting that is not an IP address', () => {
    expect(() => listenHostFrom({ PAGE_HOST: 'everyone' }, 'PAGE_HOST')).toThrow(
      'PAGE_HOST must be an IP address such as 127.0.0.1 or 0.0.0.0. Check .env.',
    );
  });
});
