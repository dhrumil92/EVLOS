import { useEffect, useState } from 'react';
import type { PoojaStatusName, ReportSource } from './report-source.js';
import { monthAfter, monthBefore, monthCounts, monthGrid, monthInWords } from './student-month.js';
import type { DayBox } from './student-month.js';

type Statuses = (PoojaStatusName | null)[];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Colour, and a letter, for each Pooja Status: colour is never the only sign.
const LOOK: Record<PoojaStatusName, { className: string; letter: string }> = {
  Present: { className: 'day-present', letter: 'P' },
  Absent: { className: 'day-absent', letter: 'A' },
  'Not Applicable': { className: 'day-not-applicable', letter: 'NA' },
  'Needs Review': { className: 'day-needs-review', letter: 'R' },
  Pending: { className: 'day-empty', letter: '' },
};

const LEGEND: PoojaStatusName[] = ['Present', 'Absent', 'Not Applicable', 'Needs Review'];

type Loaded = { month: string; statuses: Statuses } | { month: string; failed: true };

// The Student's Pooja Status for each Day of one month, from the Month Report. It loads
// again when the Student or reloadWhen changes, and keeps showing the old boxes meanwhile.
function useMonth(reports: ReportSource, studentId: string, month: string, reloadWhen: unknown) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let stale = false;
    reports
      .load({ view: 'Month', month })
      .then((report) => {
        const row = report.rows.find((one) => one.studentId === studentId);
        if (!stale) setLoaded({ month, statuses: row?.statuses ?? [] });
      })
      .catch(() => {
        if (!stale) setLoaded({ month, failed: true });
      });
    return () => {
      stale = true;
    };
  }, [reports, studentId, month, reloadWhen]);
  return loaded?.month === month ? loaded : null;
}

const labelOf = (box: DayBox, monthName: string) => {
  const what = box.status ?? (box.isFuture ? 'not yet' : 'not Active');
  return `${String(box.day)} ${monthName}${box.isToday ? ' (today)' : ''}: ${what}`;
};

function DayBoxes(props: { month: string; statuses: Statuses; today: string }) {
  const grid = monthGrid(props.month, props.statuses, props.today);
  const monthName = monthInWords(props.month).split(' ')[0] ?? '';
  return (
    <>
      <div className="month-grid text-center text-xs text-muted" aria-hidden="true">
        {WEEKDAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <ul className="month-grid" aria-label={`Days of ${monthName}`}>
        {Array.from({ length: grid.blanks }, (_, index) => (
          <li key={`blank-${String(index)}`} aria-hidden="true" />
        ))}
        {grid.boxes.map((box) => {
          const look = box.status === null ? null : LOOK[box.status];
          return (
            <li
              key={box.day}
              aria-label={labelOf(box, monthName)}
              className={`day-box ${look?.className ?? (box.isFuture ? 'day-future' : 'day-empty')} ${box.isToday ? 'day-today' : ''}`}
            >
              <span aria-hidden="true">{box.day}</span>
              <span aria-hidden="true" className="text-xs font-normal">
                {look?.letter}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Colours">
      {LEGEND.map((name) => (
        <li key={name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`day-key ${LOOK[name].className}`} />
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

function Arrow(props: { direction: 'Earlier' | 'Later'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="gear"
      aria-label={`${props.direction} month`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={props.direction === 'Earlier' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
}

// The Student's month at a glance: a box for each Day, coloured by Pooja Status, with
// arrows to earlier months. The Report stops at today, so the Later arrow stops there too.
export function StudentMonth(props: {
  studentId: string;
  reports: ReportSource;
  // Today's IST date.
  today: string;
  // Change this to load the month again, for example after a Leave is saved.
  reloadWhen: unknown;
}) {
  const thisMonth = props.today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const loaded = useMonth(props.reports, props.studentId, month, props.reloadWhen);
  return (
    <section aria-label="Pooja Statuses in the month" className="grid gap-3">
      <div className="flex items-center justify-between">
        <Arrow
          direction="Earlier"
          disabled={false}
          onClick={() => {
            setMonth(monthBefore(month));
          }}
        />
        <h3 className="font-display text-lg font-bold">{monthInWords(month)}</h3>
        <Arrow
          direction="Later"
          disabled={month >= thisMonth}
          onClick={() => {
            setMonth(monthAfter(month));
          }}
        />
      </div>
      {loaded === null && <p className="text-muted">Loading the month…</p>}
      {loaded !== null && 'failed' in loaded && (
        <p className="notice">The month could not be loaded. Check the server.</p>
      )}
      {loaded !== null && 'statuses' in loaded && (
        <>
          <DayBoxes month={month} statuses={loaded.statuses} today={props.today} />
          <Legend />
          <p className="font-bold">{monthCounts(loaded.statuses)}</p>
        </>
      )}
    </section>
  );
}
