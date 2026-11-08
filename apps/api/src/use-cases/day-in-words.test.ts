import { describe, expect, it } from 'vitest';
import { dayParts } from './day-in-words.js';

describe('dayParts', () => {
  it('splits a Day into the weekday, the date and the short month of the calendar block', () => {
    expect(dayParts('2026-11-08')).toEqual({ weekday: 'Sunday', dayOfMonth: '8', month: 'Nov' });
  });

  it('reads the Day in IST, whatever timezone the server runs in', () => {
    expect(dayParts('2026-01-01')).toEqual({ weekday: 'Thursday', dayOfMonth: '1', month: 'Jan' });
  });
});
