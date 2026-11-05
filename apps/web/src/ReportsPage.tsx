import { useEffect, useMemo, useState } from 'react';
import { HourGraph, MonthGraph } from './ReportGraphs.js';
import { countOf, visibleRows } from './report-rows.js';
import type { SortBy, StatusFilter } from './report-rows.js';
import type {
  PoojaStatusName,
  Report,
  ReportRequest,
  ReportRow,
  ReportSource,
} from './report-source.js';

type View = ReportRequest['view'];
const VIEWS: View[] = ['Day', 'Month', 'Date range'];
const PILL: Record<PoojaStatusName, string> = {
  Present: 'status-present',
  Absent: 'status-absent',
  'Not Applicable': 'status-not-applicable',
  Pending: 'status-not-applicable',
  'Needs Review': 'status-review',
};

export function Segments<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === props.value}
          onClick={() => {
            props.onChange(option);
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function filterOptions(report: Report): StatusFilter[] {
  const has = (status: PoojaStatusName) => report.rows.some((row) => row.statuses.includes(status));
  const review: StatusFilter[] = has('Needs Review') ? ['Needs Review'] : [];
  const absent: StatusFilter[] = report.isFinalized || has('Absent') ? ['Absent'] : [];
  return ['All', 'Present', ...absent, ...review, 'Not Applicable'];
}

function StudentRow({ row, isDay }: { row: ReportRow; isDay: boolean }) {
  const status = row.statuses[0];
  return (
    <tr>
      <td>{row.room}</td>
      <td className="font-semibold">{row.name}</td>
      <td>{row.studentId}</td>
      {isDay ? (
        <td>{status && <span className={`status ${PILL[status]}`}>{status}</span>}</td>
      ) : (
        <>
          <td>{countOf(row, 'Present')}</td>
          <td>{countOf(row, 'Absent')}</td>
          <td>{countOf(row, 'Not Applicable')}</td>
        </>
      )}
    </tr>
  );
}

function StudentCard(props: { report: Report; isDay: boolean; insideCard?: boolean }) {
  const { report, isDay, insideCard = false } = props;
  const [sortBy, setSortBy] = useState<SortBy>('Room');
  const [chosen, setChosen] = useState<StatusFilter>('All');
  const options = filterOptions(report);
  const status = options.includes(chosen) ? chosen : 'All';
  const rows = useMemo(
    () => visibleRows(report.rows, sortBy, status),
    [report.rows, sortBy, status],
  );

  return (
    <section className={insideCard ? 'px-3 pb-2' : 'report-card'} aria-label="Students">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div>
          {!insideCard && <h2 className="font-display text-2xl font-semibold">Students</h2>}
          <p className="text-mist">
            Showing {rows.length} of {report.rows.length} Students
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-mist">
            Sort by
            <select
              className="field"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortBy);
              }}
            >
              <option value="Room">Room</option>
              <option value="Name">Name</option>
            </select>
          </label>
          <Segments label="Pooja Status" options={options} value={status} onChange={setChosen} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 pb-2 text-mist">
          No Students match this filter. Choose All to see every Student.
        </p>
      ) : (
        <div className="student-scroll" tabIndex={0} aria-label="Student list, scrolls">
          <table className="student-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Student</th>
                <th>Student ID</th>
                {isDay ? (
                  <th>Pooja Status</th>
                ) : (
                  <>
                    <th>Days Present</th>
                    <th>Days Absent</th>
                    <th>Days Not Applicable</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <StudentRow key={row.studentId} row={row} isDay={isDay} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DateFields(props: {
  view: View;
  today: string;
  day: string;
  month: string;
  from: string;
  to: string;
  set: (field: 'day' | 'month' | 'from' | 'to', value: string) => void;
}) {
  const { view, today, set } = props;
  const field = (
    label: string,
    name: 'day' | 'month' | 'from' | 'to',
    type: string,
    max: string,
  ) => (
    <label className="flex items-center gap-2 text-mist">
      {label}
      <input
        className="field"
        type={type}
        max={max}
        value={props[name]}
        onChange={(event) => {
          if (event.target.value) set(name, event.target.value);
        }}
      />
    </label>
  );
  if (view === 'Day') return field('Day', 'day', 'date', today);
  if (view === 'Month') return field('Month', 'month', 'month', today.slice(0, 7));
  return (
    <>
      {field('From', 'from', 'date', props.to)}
      {field('To', 'to', 'date', today)}
    </>
  );
}

function requestFor(view: View, dates: { day: string; month: string; from: string; to: string }) {
  if (view === 'Day') return { view, day: dates.day } as const;
  if (view === 'Month') return { view, month: dates.month } as const;
  return { view, from: dates.from, to: dates.to } as const;
}

// Loads the Report for a request. An older Report is never shown for a newer request.
function useReport(source: ReportSource, requestKey: string) {
  const [loaded, setLoaded] = useState<{ key: string; report: Report } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    source
      .load(JSON.parse(requestKey) as ReportRequest)
      .then((report) => {
        if (open) setLoaded({ key: requestKey, report });
      })
      .catch(() => {
        if (open) setFailedKey(requestKey);
      });
    return () => {
      open = false;
    };
  }, [source, requestKey]);

  return {
    report: loaded?.key === requestKey ? loaded.report : null,
    failed: failedKey === requestKey,
  };
}

function ReportNotices({ report, isDay }: { report: Report; isDay: boolean }) {
  return (
    <>
      {isDay && !report.isFinalized && (
        <p className="notice">
          Not Finalized. A Student with no Punch shows Needs Review until the Rector Finalizes.
        </p>
      )}
    </>
  );
}

// Every Student's Pooja Status for a Day, for the live view page.
export function EveryStudent({ source, today }: { source: ReportSource; today: string }) {
  const { report, failed } = useReport(source, JSON.stringify({ view: 'Day', day: today }));
  if (failed) return <p className="px-3 pb-4 text-mist">The Student list could not load.</p>;
  if (!report) return <p className="px-3 pb-4 text-mist">Loading the Student list.</p>;
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 px-3">
        <ReportNotices report={report} isDay />
      </div>
      <StudentCard report={report} isDay insideCard />
    </div>
  );
}

function GraphCard({ report }: { report: Report }) {
  if (report.hours) {
    return (
      <section className="report-card" aria-label="Students by hour">
        <HourGraph hours={report.hours} />
      </section>
    );
  }
  if (report.days) {
    return (
      <section className="report-card" aria-label="Every Day of the month">
        <MonthGraph days={report.days} />
      </section>
    );
  }
  return null;
}

export function ReportsPage({ source, today }: { source: ReportSource; today: string }) {
  const [view, setView] = useState<View>('Day');
  const [dates, setDates] = useState({
    day: today,
    month: today.slice(0, 7),
    from: `${today.slice(0, 7)}-01`,
    to: today,
  });
  const request = requestFor(view, dates);
  const { report, failed } = useReport(source, JSON.stringify(request));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-[2.5rem] leading-tight font-bold text-gold">Reports</h1>
          <p className="text-mist">{report?.title ?? '\u00a0'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateFields
            view={view}
            today={today}
            {...dates}
            set={(field, value) => {
              setDates((old) => ({ ...old, [field]: value }));
            }}
          />
          <Segments label="Report period" options={VIEWS} value={view} onChange={setView} />
          {report && (
            <>
              <a className="btn" href={source.csvUrl(request)} download>
                Download CSV
              </a>
              <a className="btn" href={source.xlsxUrl(request)} download>
                Download Excel
              </a>
            </>
          )}
        </div>
      </div>

      {failed && (
        <p className="notice">This Report could not load. Reload the page to try again.</p>
      )}
      {report && (
        <>
          <ReportNotices report={report} isDay={view === 'Day'} />
          <StudentCard report={report} isDay={view === 'Day'} />
          <GraphCard report={report} />
        </>
      )}
    </div>
  );
}
