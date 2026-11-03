import { useState } from 'react';
import type { ReactNode } from 'react';
import { Altar } from './Altar.js';
import { httpReportSource } from './http-report-source.js';
import { LeavesPage } from './LeavesPage.js';
import type { LiveViewPunch, LiveViewSource, NotCountedBecause } from './live-view-source.js';
import { PoojaRing } from './PoojaRing.js';
import type { ReportSource } from './report-source.js';
import { EveryStudent, ReportsPage, Segments } from './ReportsPage.js';
import { httpStudentSource } from './student-source.js';
import type { StudentSource } from './student-source.js';
import { StudentsPage } from './StudentsPage.js';
import { punchKey, useLiveView } from './use-live-view.js';
import type { LiveViewState } from './use-live-view.js';

const NOTE = 'Outside Pooja Window (05:30–18:00)';
// Why a Punch is shown but not counted (FR-2).
const NOT_COUNTED: Record<NotCountedBecause, string> = {
  'outside-pooja-window': NOTE,
  'unknown-student': 'Not a Student',
  'not-active': 'Not Active',
};
const LIVE_VIEW = 'Live view';
const REPORTS = 'Reports';
const STUDENTS = 'Students';
const LEAVES = 'Leaves';
const PAGES: Record<string, string | null> = {
  [LIVE_VIEW]: null,
  [STUDENTS]: null,
  [LEAVES]: null,
  'Review and Finalize':
    'Check the Needs Review list, then Finalize the Day and Send Notifications. This page comes in Phase 4.',
  [REPORTS]: null,
};

const istToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now());

const istTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const istDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayInWords = (day: string) =>
  istDate.format(new Date(`${day}T12:00:00+05:30`)).replace(',', '');

function PunchRow({ punch, isNew }: { punch: LiveViewPunch; isNew: boolean }) {
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-line px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${isNew ? 'just-arrived' : ''}`}
    >
      <span className="grid">
        <span className="text-lg font-semibold">
          {punch.name ?? `Student ID ${punch.studentId}`}
        </span>
        {punch.name && <span className="text-sm text-mist">Student ID {punch.studentId}</span>}
      </span>
      <span className="font-semibold">{istTime.format(punch.punchedAt)}</span>
      <span
        className={`col-span-2 justify-self-start rounded-full px-3 py-0.5 text-sm font-semibold sm:col-span-1 ${punch.isCounted ? 'bg-gold/20 text-gold' : 'bg-note text-note-ink'}`}
      >
        {punch.notCountedBecause ? NOT_COUNTED[punch.notCountedBecause] : 'Present'}
      </span>
    </li>
  );
}

function Punches({ live }: { live: LiveViewState }) {
  if (live.failed) {
    return (
      <p className="px-3 pb-4 text-mist">
        The live view cannot reach the EVLOS server. Start it with npm run dev, then reload this
        page.
      </p>
    );
  }
  if (live.view === null) {
    return <p className="px-3 pb-4 text-mist">Loading today's Punches.</p>;
  }
  if (live.view.punches.length === 0) {
    return (
      <p className="px-3 pb-4 text-mist">
        No Punches yet today. Each Punch appears here as soon as the Device sends it.
      </p>
    );
  }
  return (
    <ol className="max-h-[27rem] overflow-y-auto">
      {live.view.punches.map((punch) => (
        <PunchRow key={punchKey(punch)} punch={punch} isNew={punchKey(punch) === live.newestKey} />
      ))}
    </ol>
  );
}

function TodaysCount({ live }: { live: LiveViewState }) {
  return (
    <section aria-label="Today's count">
      <h1 className="font-display text-[2.5rem] leading-tight font-bold text-gold">
        Today's Pooja
      </h1>
      <p className="mt-1 mb-5 text-mist">
        {live.view ? `${dayInWords(live.view.day)}. Pooja Window 05:30 to 18:00.` : ' '}
      </p>
      <PoojaRing
        present={live.view?.studentsPresent ?? null}
        active={live.view?.activeStudents ?? null}
      />
    </section>
  );
}

const LATEST_PUNCHES = 'Latest Punches';
const LIVE_LISTS = [LATEST_PUNCHES, 'Every Student'] as const;

function LiveLists(props: { live: LiveViewState; reports: ReportSource; today: string }) {
  const [list, setList] = useState<(typeof LIVE_LISTS)[number]>(LATEST_PUNCHES);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
        <h2 className="font-display text-2xl font-semibold">{list}</h2>
        <Segments label="List" options={LIVE_LISTS} value={list} onChange={setList} />
      </div>
      {list === LATEST_PUNCHES ? (
        <div aria-live="polite">
          <Punches live={props.live} />
        </div>
      ) : (
        <EveryStudent source={props.reports} today={props.today} />
      )}
    </>
  );
}

export function App(props: {
  source: LiveViewSource;
  students?: StudentSource;
  reports?: ReportSource;
  onLogOut?: () => void;
}) {
  const { source, students = httpStudentSource, reports = httpReportSource, onLogOut } = props;
  const [page, setPage] = useState(LIVE_VIEW);
  const live = useLiveView(source);
  const soon = PAGES[page];
  const [today] = useState(istToday);
  const widePages: Record<string, ReactNode> = {
    [REPORTS]: <ReportsPage source={reports} today={today} />,
    [STUDENTS]: <StudentsPage source={students} today={today} />,
    [LEAVES]: <LeavesPage source={students} today={today} />,
  };

  return (
    <div className="screen">
      <header className="gutter relative z-10 border-b border-line">
        <div className="mx-auto flex max-w-[70rem] flex-wrap items-center gap-x-7 pt-2 md:flex-nowrap md:pt-0">
          <div className="font-display text-3xl font-bold text-gold">EVLOS</div>
          <nav
            aria-label="Main menu"
            className="flex min-w-0 basis-full gap-1 overflow-x-auto py-2 md:basis-auto"
          >
            {Object.keys(PAGES).map((name) => (
              <button
                key={name}
                type="button"
                aria-current={name === page ? 'page' : undefined}
                onClick={() => {
                  setPage(name);
                }}
                className="menu-item"
              >
                {name}
              </button>
            ))}
          </nav>
          {onLogOut && (
            <button type="button" className="menu-item ml-auto" onClick={onLogOut}>
              Log out
            </button>
          )}
        </div>
      </header>

      <div className="gutter relative z-10">
        {widePages[page] ? (
          <main className="mx-auto max-w-[70rem] pt-8 pb-2">{widePages[page]}</main>
        ) : (
          <main className="mx-auto grid max-w-[70rem] gap-7 pt-8 pb-2 md:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] md:gap-10">
            <TodaysCount live={live} />

            <section className="min-w-0 rounded-2xl border border-line bg-night/60 p-2">
              {soon ? (
                <>
                  <h2 className="font-display px-3 py-2 text-2xl font-semibold">{page}</h2>
                  <p className="max-w-prose px-3 pb-4 text-mist">{soon}</p>
                </>
              ) : (
                <LiveLists live={live} reports={reports} today={today} />
              )}
            </section>
          </main>
        )}
      </div>

      <Altar flareKey={live.newestKey} />
    </div>
  );
}
