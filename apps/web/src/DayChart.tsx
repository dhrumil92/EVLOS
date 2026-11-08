import { useState } from 'react';
import { dayInWords } from './ist-words.js';
import { axisOf, dayTotals } from './report-month.js';
import type { DayCount } from './report-month.js';
import type { Report } from './report-source.js';
import { useScrollHandoff } from './use-scroll-handoff.js';

const CHART_HEIGHT = 240;

interface Kind {
  name: string;
  bar: string;
  of: (one: DayCount) => number;
}

const PRESENT: Kind = { name: 'Present', bar: 'bar-present', of: (one) => one.present };
const NOT_APPLICABLE: Kind = {
  name: 'Not Applicable',
  bar: 'bar-not-applicable',
  of: (one) => one.notApplicable,
};
const ABSENT: Kind = { name: 'Absent', bar: 'bar-absent', of: (one) => one.absent };
const NEEDS_REVIEW: Kind = {
  name: 'Needs Review',
  bar: 'bar-review',
  of: (one) => one.needsReview,
};

// Needs Review is only worth a colour when some Day has it, as on a Day not yet Finalized.
const kindsOf = (totals: DayCount[]) =>
  totals.some((one) => one.needsReview > 0)
    ? [PRESENT, NOT_APPLICABLE, ABSENT, NEEDS_REVIEW]
    : [PRESENT, NOT_APPLICABLE, ABSENT];

const wordsOf = (one: DayCount, kinds: Kind[]) =>
  `${dayInWords(one.day)}: ${kinds.map((kind) => `${kind.name} ${String(kind.of(one))}`).join(', ')}`;

// Up to this many Days, every Day has its number under it and its total above it.
const NUMBERED = 31;
// Up to this many Days, each bar has its own number on top. More Days make the bars too thin.
const NUMBERS_ON_BARS = 16;
// The least width of a Day, in pixels. A card too narrow for all its Days scrolls sideways, so
// the numbers never run into each other.
const DAY_WIDTH = 34;
// The width of the numbers on the side of the chart, with the gap beside them.
const SIDE_WIDTH = 40;

const totalOf = (one: DayCount, kinds: Kind[]) =>
  kinds.reduce((sum, kind) => sum + kind.of(one), 0);

// The number under a Day. A longer range of dates has too many to number: it gets the first
// Day, the 1st of each month and every Monday, so the numbers do not crowd.
function tickOf(day: string, index: number, total: number) {
  const number = String(Number(day.slice(8)));
  if (total <= NUMBERED) return number;
  const isMonday = new Date(`${day}T00:00:00Z`).getUTCDay() === 1;
  return index === 0 || isMonday || day.endsWith('-01') ? number : '';
}

function Legend({ kinds }: { kinds: Kind[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Colours">
      {kinds.map((kind) => (
        <li key={kind.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-[3px] ${kind.bar}`} />
          {kind.name}
        </li>
      ))}
    </ul>
  );
}

function Column(props: {
  one: DayCount;
  kinds: Kind[];
  max: number;
  isOpen: boolean;
  hasNumbers: boolean;
  onPress: () => void;
}) {
  const words = wordsOf(props.one, props.kinds);
  return (
    <button
      type="button"
      className={`day-column ${props.isOpen ? 'bg-tint' : ''}`}
      aria-label={words}
      aria-pressed={props.isOpen}
      title={words}
      onClick={props.onPress}
    >
      {props.kinds.map((kind) => {
        const value = kind.of(props.one);
        return (
          <span
            key={kind.name}
            aria-hidden="true"
            className={`relative block w-full max-w-6 min-w-[3px] ${kind.bar}`}
            style={{
              height: `${String((value / props.max) * 100)}%`,
              minHeight: value > 0 ? '2px' : undefined,
            }}
          >
            {props.hasNumbers && value > 0 && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-xs font-bold text-ink">
                {value}
              </span>
            )}
          </span>
        );
      })}
    </button>
  );
}

// The total of the bars of each Day, along the very top. It leaves room for the numbers that
// stand on top of the bars, when there are any.
function TotalsRow(props: { totals: DayCount[]; kinds: Kind[]; hasNumbers: boolean }) {
  return (
    <div aria-hidden="true" className="flex gap-2 text-xs">
      <span className="w-8 flex-none text-right text-muted">Total</span>
      <div className={`flex min-w-0 flex-1 gap-1 font-bold ${props.hasNumbers ? 'pb-6' : 'pb-1'}`}>
        {props.totals.map((one) => (
          <span key={one.day} className="min-w-0 flex-1 text-center">
            {totalOf(one, props.kinds)}
          </span>
        ))}
      </div>
    </div>
  );
}

// The side of the chart reaches the tallest bar, rounded up to a round number.
function Bars(props: {
  totals: DayCount[];
  kinds: Kind[];
  openDay: string | null;
  onPress: (day: string) => void;
}) {
  const tallest = Math.max(
    0,
    ...props.totals.flatMap((one) => props.kinds.map((kind) => kind.of(one))),
  );
  const { ticks, max } = axisOf(tallest);
  const at = (tick: number) => `${String((tick / max) * 100)}%`;
  const days = props.totals.length;
  const hasNumbers = days <= NUMBERS_ON_BARS;
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: days * DAY_WIDTH + SIDE_WIDTH }}>
        {days <= NUMBERED && (
          <TotalsRow totals={props.totals} kinds={props.kinds} hasNumbers={hasNumbers} />
        )}
        <div className="flex gap-2">
          <div
            aria-hidden="true"
            className="relative w-8 flex-none text-right text-xs text-muted"
            style={{ height: CHART_HEIGHT }}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2"
                style={{ bottom: at(tick) }}
              >
                {tick}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="relative flex gap-1 border-b border-line-strong"
              style={{ height: CHART_HEIGHT }}
            >
              {ticks.slice(1).map((tick) => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-line"
                  style={{ bottom: at(tick) }}
                />
              ))}
              {props.totals.map((one) => (
                <Column
                  key={one.day}
                  one={one}
                  kinds={props.kinds}
                  max={max}
                  isOpen={props.openDay === one.day}
                  hasNumbers={hasNumbers}
                  onPress={() => {
                    props.onPress(one.day);
                  }}
                />
              ))}
            </div>
            <div aria-hidden="true" className="flex gap-1 pt-1 text-xs text-muted">
              {props.totals.map((one, index) => (
                <span key={one.day} className="min-w-0 flex-1 overflow-visible text-center">
                  {tickOf(one.day, index, props.totals.length)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayDetail(props: { report: Report; totals: DayCount[]; day: string }) {
  const index = props.totals.findIndex((one) => one.day === props.day);
  const names = props.report.rows.filter((row) => row.statuses[index] === 'Absent');
  return (
    <section
      aria-label={dayInWords(props.day)}
      className="grid gap-1 rounded-2xl border border-line bg-wash p-4"
    >
      <h3 className="font-display text-lg font-bold">Absent on {dayInWords(props.day)}</h3>
      {names.length === 0 ? (
        <p className="text-muted">No Student was Absent.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {names.map((row) => (
            <li key={row.studentId} className="flex items-baseline gap-2">
              <strong>{row.name}</strong>
              <span className="text-muted">{row.room}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DayTable(props: { totals: DayCount[]; kinds: Kind[] }) {
  const handoff = useScrollHandoff();
  return (
    <div ref={handoff} className="student-scroll" tabIndex={0} aria-label="Every Day, scrolls">
      <table className="student-table" aria-label="Every Day">
        <thead>
          <tr>
            <th>Day</th>
            {props.kinds.map((kind) => (
              <th key={kind.name}>{kind.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.totals.map((one) => (
            <tr key={one.day}>
              <td>{dayInWords(one.day)}</td>
              {props.kinds.map((kind) => (
                <td key={kind.name}>{kind.of(one)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One bar for each Day: Present, Not Applicable and Absent. Press a Day to see who was Absent;
// "Show as a table" gives the same numbers in words and rows.
export function DayChart({ report }: { report: Report }) {
  const [isTable, setTable] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const totals = dayTotals(report);
  const kinds = kindsOf(totals);
  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <span className="font-display text-lg font-bold">Every Day</span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Legend kinds={kinds} />
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              setTable((old) => !old);
            }}
          >
            {isTable ? 'Show as a chart' : 'Show as a table'}
          </button>
        </span>
      </figcaption>
      {isTable ? (
        <DayTable totals={totals} kinds={kinds} />
      ) : (
        <>
          <Bars
            totals={totals}
            kinds={kinds}
            openDay={openDay}
            onPress={(day) => {
              setOpenDay((old) => (old === day ? null : day));
            }}
          />
          {openDay !== null && <DayDetail report={report} totals={totals} day={openDay} />}
        </>
      )}
    </figure>
  );
}
