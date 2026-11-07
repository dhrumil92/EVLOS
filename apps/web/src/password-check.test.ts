import { describe, expect, it } from 'vitest';
import { lengthCheck, matchCheck } from './password-check.js';

describe('the length of a new password', () => {
  it('asks for at least 12 characters before anything is typed', () => {
    expect(lengthCheck('')).toEqual({
      filled: 0,
      isLongEnough: false,
      text: 'At least 12 characters.',
    });
  });

  it('says how many more characters are needed, and fills that much of the bar', () => {
    expect(lengthCheck('abcd')).toEqual({
      filled: 4,
      isLongEnough: false,
      text: '8 more characters needed',
    });
  });

  it('says 1 more character, not 1 more characters', () => {
    expect(lengthCheck('abcdefghijk').text).toBe('1 more character needed');
  });

  it('is long enough at exactly 12 characters', () => {
    expect(lengthCheck('abcdefghijkl')).toEqual({
      filled: 12,
      isLongEnough: true,
      text: '12 characters, long enough',
    });
  });

  it('counts a longer password, and never fills more than the whole bar', () => {
    expect(lengthCheck('morning pooja at 6')).toEqual({
      filled: 12,
      isLongEnough: true,
      text: '18 characters, long enough',
    });
  });

  it('counts spaces, so a short sentence works', () => {
    expect(lengthCheck('a b c d e f g ').isLongEnough).toBe(true);
  });
});

describe('the two new passwords', () => {
  it('say nothing while the second box is empty', () => {
    expect(matchCheck('abcdefghijkl', '')).toBeNull();
    expect(matchCheck('', '')).toBeNull();
  });

  it('say they are not the same yet while the second differs', () => {
    expect(matchCheck('abcdefghijkl', 'abcdef')).toEqual({
      isSame: false,
      text: 'Not the same as the new password yet',
    });
  });

  it('say they match when the second is the same', () => {
    expect(matchCheck('abcdefghijkl', 'abcdefghijkl')).toEqual({
      isSame: true,
      text: 'The two passwords match',
    });
  });

  it('tell a capital letter from a small one', () => {
    expect(matchCheck('abcdefghijkl', 'Abcdefghijkl')?.isSame).toBe(false);
  });
});
