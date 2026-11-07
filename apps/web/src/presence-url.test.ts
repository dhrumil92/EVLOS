import { describe, expect, it } from 'vitest';
import { presenceUrl } from './presence-url.js';

describe('the link that downloads Vidyalaya Presence', () => {
  it('asks for a Day', () => {
    expect(presenceUrl({ view: 'Day', day: '2026-11-08' })).toBe(
      '/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-08',
    );
  });

  it('asks for a month', () => {
    expect(presenceUrl({ view: 'Month', month: '2026-11' })).toBe(
      '/api/vidyalaya-presence/xlsx?view=Month&month=2026-11',
    );
  });
});
