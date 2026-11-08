// Calendar arithmetic on a YYYY-MM-DD date alone, so the computer's own time zone never matters.
const DAY_MS = 24 * 60 * 60 * 1000;

const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const dayBefore = (day: string) => shift(day, -1);
export const dayAfter = (day: string) => shift(day, 1);
