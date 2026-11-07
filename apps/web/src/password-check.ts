// The server's rule for a new password: at least 12 characters, and not the same as the
// current one. The page only shows the length as it is typed; it never guesses "strength".
export const MIN_LENGTH = 12;

export interface LengthCheck {
  // How many of the 12 segments of the bar are filled.
  filled: number;
  isLongEnough: boolean;
  text: string;
}

export function lengthCheck(password: string): LengthCheck {
  const length = password.length;
  const filled = Math.min(length, MIN_LENGTH);
  if (length === 0) return { filled, isLongEnough: false, text: 'At least 12 characters.' };
  if (length < MIN_LENGTH) {
    const missing = MIN_LENGTH - length;
    const text = `${String(missing)} more ${missing === 1 ? 'character' : 'characters'} needed`;
    return { filled, isLongEnough: false, text };
  }
  return { filled, isLongEnough: true, text: `${String(length)} characters, long enough` };
}

export interface MatchCheck {
  isSame: boolean;
  text: string;
}

// The second box against the first, live. Nothing is said until something is typed in it.
export function matchCheck(first: string, again: string): MatchCheck | null {
  if (again === '') return null;
  return again === first
    ? { isSame: true, text: 'The two passwords match' }
    : { isSame: false, text: 'Not the same as the new password yet' };
}
