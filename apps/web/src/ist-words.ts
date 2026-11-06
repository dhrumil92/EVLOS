// Times and Days in words, always in IST, whatever the computer's own time zone.
const IST = { timeZone: 'Asia/Kolkata' } as const;
const dayWords = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const clock = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "07:00" for an instant.
export const timeOfDay = (instant: number) => clock.format(instant);

// "Tuesday 3 November" for a YYYY-MM-DD Day.
export const dayInWords = (day: string) =>
  dayWords.format(new Date(`${day}T12:00:00+05:30`)).replace(',', '');
