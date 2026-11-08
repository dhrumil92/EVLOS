import { describe, expect, it } from 'vitest';
import { dayOf } from './book-day.js';

const TODAY = '2026-11-06';

describe('the day written in a book', () => {
  it('turns Today, Yesterday and a picked date into a date', () => {
    expect(dayOf({ day: 'Today', pickedDay: '' }, TODAY)).toBe(TODAY);
    expect(dayOf({ day: 'Yesterday', pickedDay: '' }, TODAY)).toBe('2026-11-05');
    expect(dayOf({ day: 'Pick a date', pickedDay: '2026-11-02' }, TODAY)).toBe('2026-11-02');
  });
});
