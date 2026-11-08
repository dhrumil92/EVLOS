// What the Students page can ask for: one Day, or one month. Vidyalaya Presence has no range.
export type PresenceChoice = { view: 'Day'; day: string } | { view: 'Month'; month: string };

// The link that downloads Vidyalaya Presence as an Excel file.
export function presenceUrl(choice: PresenceChoice): string {
  const query = new URLSearchParams(
    choice.view === 'Day'
      ? { view: 'Day', day: choice.day }
      : { view: 'Month', month: choice.month },
  );
  return `/api/vidyalaya-presence/xlsx?${query.toString()}`;
}
