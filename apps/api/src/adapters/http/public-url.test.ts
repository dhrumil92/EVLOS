import { describe, expect, it } from 'vitest';
import { resetPageUrlFrom } from './public-url.js';

describe('resetPageUrlFrom', () => {
  it('builds the reset page address from PUBLIC_URL', () => {
    expect(resetPageUrlFrom({ PUBLIC_URL: 'https://evlos.example.com' })).toBe(
      'https://evlos.example.com/reset-password',
    );
  });

  it('drops a slash at the end of PUBLIC_URL', () => {
    expect(resetPageUrlFrom({ PUBLIC_URL: 'http://localhost:5173/' })).toBe(
      'http://localhost:5173/reset-password',
    );
  });

  it('is null when PUBLIC_URL is not set, so no reset link is sent', () => {
    expect(resetPageUrlFrom({})).toBeNull();
    expect(resetPageUrlFrom({ PUBLIC_URL: '  ' })).toBeNull();
  });

  it('stops the server for a PUBLIC_URL that is not an http or https address', () => {
    expect(() => resetPageUrlFrom({ PUBLIC_URL: 'evlos.example.com' })).toThrow(
      'PUBLIC_URL must start with http:// or https://. Check .env.',
    );
  });
});
