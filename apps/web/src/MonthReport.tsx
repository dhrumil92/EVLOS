import { useState } from 'react';
import { DayChart } from './DayChart.js';
import { DayCounts } from './DayCounts.js';
import { finalizedLine, PERIODS } from './report-month.js';
import type { PeriodKey, Picks } from './report-month.js';
import { ReportDownloads } from './ReportDownloads.js';
import type { PoojaStatusName, Report, ReportRequest, ReportSource } from './report-source.js';

type Rows = PoojaStatusName | 'All';

const ROWS: { value: Rows; label: string }[] = [
  { value: 'All', label: 'Every Student' },
  { value: 'Absent', label: 'Absent only' },
  { value: 'Not Applicable', label: 'Not Applicable only' },
  { value: 'Present', label: 'Present only' },
];

// What a download is called, for a screen reader: "Download the day as Excel".
const LABELS: Record<PeriodKey, string> = {
  day: 'the day',
  month: 'the month',
  dates: 'these dates',
};

function Periods(props: { period: PeriodKey; onPeriod: (period: PeriodKey) => void }) {
  return (
    <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
      {PERIODS.map((choice) => {
        const isOn = choice.key === props.period;
        return (
          <button
            key={choice.key}
            type="button"
            aria-pressed={isOn}
            onClick={() => {
              props.onPeriod(choice.key);
            }}
            className={`min-h-11 rounded-full border-[1.5px] px-4 font-bold ${isOn ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary'}`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

// The field for the chosen period: a Day, a Month, or From and To. To cannot be before From.
function DateFields(props: {
  period: PeriodKey;
  today: string;
  picks: Picks;
  onPick: (name: keyof Picks, value: string) => void;
}) {
  const { period, today, picks } = props;
  const field = (
    label: string,
    name: keyof Picks,
    type: 'date' | 'month',
    limits: { min?: string; max: string },
  ) => (
    <label className="flex items-center gap-2 text-muted">
      {label}
      <input
        className="field"
        type={type}
        min={limits.min}
        max={limits.max}
        value={picks[name]}
        onChange={(event) => {
          if (event.target.value) props.onPick(name, event.target.value);
        }}
      />
    </label>
  );
  if (period === 'day') return field('Day', 'day', 'date', { max: today });
  if (period === 'month') return field('Month', 'month', 'month', { max: today.slice(0, 7) });
  return (
    <div className="flex flex-wrap items-center gap-4">
      {field('From', 'from', 'date', { max: picks.to })}
      {field('To', 'to', 'date', { min: picks.from, max: today })}
    </div>
  );
}

// A Day, a month or a range of dates: the period, what to download, and a bar for each Day; a
// Day also gives its Present, Not Applicable and Absent counts. This month is shown first, so the Rector presses nothing to see it.
export function MonthReport(props: {
  source: ReportSource;
  report: Report | null;
  failed: boolean;
  request: ReportRequest;
  today: string;
  period: PeriodKey;
  onPeriod: (period: PeriodKey) => void;
  picks: Picks;
  onPick: (name: keyof Picks, value: string) => void;
}) {
  const { report } = props;
  const [rows, setRows] = useState<Rows>('All');
  return (
    <section aria-label="Month report" className="report-card grid gap-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {report !== null && (
          <div className="flex flex-wrap items-baseline gap-x-4">
            <h2 className="font-display text-2xl font-bold">{report.title}</h2>
            <span className="text-muted">{finalizedLine(report)}</span>
          </div>
        )}
        {props.period === 'day' && report !== null && <DayCounts report={report} />}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-muted">
            Rows
            <select
              className="field"
              value={rows}
              onChange={(event) => {
                setRows(event.target.value as Rows);
              }}
            >
              {ROWS.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <ReportDownloads
            label={LABELS[props.period]}
            source={props.source}
            request={props.request}
            status={rows}
          />
        </div>
      </div>
      <Periods period={props.period} onPeriod={props.onPeriod} />
      <DateFields
        period={props.period}
        today={props.today}
        picks={props.picks}
        onPick={props.onPick}
      />
      {props.failed && (
        <p className="notice">This Report could not load. Reload the page to try again.</p>
      )}
      {report === null && !props.failed && <p className="text-muted">Loading the Report…</p>}
      {report !== null && <>{report.reportDays.length > 1 && <DayChart report={report} />}</>}
    </section>
  );
}
