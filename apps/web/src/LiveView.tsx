import { useEffect, useState } from 'react';
import { awayInOrder } from './back-book.js';
import { DeviceLastSeen, useDeviceStatus } from './DeviceLastSeen.js';
import type { DeviceStatusSource } from './device-status-source.js';
import { dayInWords, timeOfDay } from './ist-words.js';
import type { Book } from './LeavesPage.js';
import { inWords, LeaveStateLabel } from './LeaveStatus.js';
import type { LiveViewPunch, LiveViewSource, NotCountedBecause } from './live-view-source.js';
import { firstPunchSlots } from './punch-band.js';
import { PunchBand } from './PunchBand.js';
import type { ReportSource } from './report-source.js';
import type { ListedStudent, StudentSource } from './student-source.js';
import { punchKey, useLiveView } from './use-live-view.js';
import type { LiveViewState } from './use-live-view.js';

const NOTE = 'Outside Pooja Window (05:30–18:00)';
// Why a Punch is shown but not counted (FR-2).
const NOT_COUNTED: Record<NotCountedBecause, string> = {
  'outside-pooja-window': NOTE,
  'unknown-student': 'Not a Student',
  'not-active': 'Not Active',
};
const ONE_MINUTE_MS = 60 * 1000;

type OpenLeaves = (book: Book, students: readonly string[]) => void;
interface Waiting {
  studentId: string;
  name: string;
  room: string;
}

// The clock, read again every minute, so Now moves along the band.
function useNow(now: () => number) {
  const [at, setAt] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => {
      setAt(now());
    }, ONE_MINUTE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [now]);
  return at;
}

// Today's Students with no Punch yet: Pending while the window is open, Needs Review after.
// Asked for again whenever a Punch arrives, so a Student leaves the list as they punch.
function useWaiting(reports: ReportSource, day: string | null, punches: number) {
  const [waiting, setWaiting] = useState<{ title: string; students: Waiting[] } | null>(null);
  useEffect(() => {
    if (day === null) return;
    let isCurrent = true;
    reports.load({ view: 'Day', day }).then(
      (report) => {
        if (!isCurrent) return;
        const needsReview = report.rows.some((row) => row.statuses[0] === 'Needs Review');
        const title = needsReview ? 'Needs Review' : 'Pending';
        setWaiting({ title, students: report.rows.filter((row) => row.statuses[0] === title) });
      },
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [reports, day, punches]);
  return waiting;
}

function useAway(students: StudentSource) {
  const [away, setAway] = useState<ListedStudent[] | null>(null);
  useEffect(() => {
    let isCurrent = true;
    students.list().then(
      (list) => {
        if (isCurrent) setAway(awayInOrder(list));
      },
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [students]);
  return away;
}

function Heading(props: {
  day: string | null;
  device: DeviceStatusSource;
  onOpenLeaves: OpenLeaves;
}) {
  const device = useDeviceStatus(props.device);
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
          {props.day ? dayInWords(props.day) : "Today's Pooja"}
        </h1>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-quiet min-h-12"
            type="button"
            onClick={() => {
              props.onOpenLeaves('Back-from-Home Book', []);
            }}
          >
            Record Return
          </button>
          <button
            className="btn min-h-12"
            type="button"
            onClick={() => {
              props.onOpenLeaves('Going-to-Home Book', []);
            }}
          >
            Record Leave
          </button>
        </div>
      </div>
      <p className="text-muted">Pooja Window 05:30 to 18:00.</p>
      <DeviceLastSeen status={device} />
    </div>
  );
}

function Counts(props: {
  live: LiveViewState;
  waiting: { title: string; students: Waiting[] } | null;
  away: ListedStudent[] | null;
}) {
  const { view } = props.live;
  const rows = [
    { label: props.waiting?.title ?? 'Pending', value: props.waiting?.students.length },
    { label: 'Away on Leave', value: props.away?.length },
    { label: 'Due Back', value: props.away?.filter((s) => s.leaveState === 'Due Back').length },
  ];
  return (
    <div className="grid min-w-0 flex-[1_1_15rem] content-start gap-3.5">
      <p className="leading-none">
        <span className="font-display text-7xl font-extrabold tracking-tight text-primary">
          {view?.studentsPresent ?? '–'}
        </span>
        <span className="ml-2 text-xl text-muted">of {view?.activeStudents ?? '–'} Present</span>
      </p>
      <ul aria-label="Today's counts" className="grid gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between border-t border-line pt-2">
            <span>{row.label}</span>
            <strong>{row.value ?? '–'}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WaitingCard({ waiting }: { waiting: { title: string; students: Waiting[] } | null }) {
  if (waiting === null) return null;
  const { title, students } = waiting;
  return (
    <section className="report-card grid content-start gap-1" aria-label={title}>
      <h2 className="font-display text-xl font-bold">
        {title} <span className="font-medium text-muted">{students.length}</span>
      </h2>
      <p className="mb-2 text-sm text-muted">
        {title === 'Pending'
          ? 'No Punch inside the Pooja Window yet.'
          : 'No Punch, and the Pooja Window has closed. Finalize on Review and Finalize.'}
      </p>
      {students.length === 0 ? (
        <p className="text-muted">Nobody. Every Student has punched or is Away.</p>
      ) : (
        <ul aria-label={`${title} Students`} className="grid">
          {students.map((student) => (
            <li
              key={student.studentId}
              className="flex justify-between gap-2 border-t border-line py-2"
            >
              <span className="font-bold">{student.name}</span>
              <span className="text-muted">Room {student.room}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AwayCard(props: { away: ListedStudent[] | null; onOpenLeaves: OpenLeaves }) {
  const { away } = props;
  if (away === null) return null;
  return (
    <section className="report-card grid content-start gap-1" aria-label="Away">
      <h2 className="font-display text-xl font-bold">
        Away <span className="font-medium text-muted">{away.length}</span>
      </h2>
      <p className="mb-2 text-sm text-muted">
        Due Back first. Press Return when the name is in the Back-from-Home Book.
      </p>
      {away.length === 0 ? (
        <p className="text-muted">No Student is Away.</p>
      ) : (
        <ul aria-label="Away Students" className="grid">
          {away.map((student) => (
            <li
              key={student.studentId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2.5"
            >
              <span className="grid min-w-0 flex-[1_1_9rem]">
                <span className="font-bold">{student.name}</span>
                {student.openLeave && (
                  <span className="text-sm text-muted">
                    Expected back {inWords(student.openLeave.expectedReturnAt)}
                  </span>
                )}
              </span>
              <LeaveStateLabel state={student.leaveState} />
              <button
                className="btn-quiet"
                type="button"
                aria-label={`Record Return for ${student.name}`}
                onClick={() => {
                  props.onOpenLeaves('Back-from-Home Book', [student.studentId]);
                }}
              >
                Return
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PunchRow({ punch, isNew }: { punch: LiveViewPunch; isNew: boolean }) {
  return (
    <li
      className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-t border-line py-2.5 ${isNew ? 'just-arrived' : ''}`}
    >
      <span className="font-bold">{timeOfDay(punch.punchedAt)}</span>
      <span className="grid min-w-0">
        <span className="truncate font-bold">{punch.name ?? `Student ID ${punch.studentId}`}</span>
        {punch.name && <span className="text-sm text-muted">Student ID {punch.studentId}</span>}
        <span
          className={`text-sm font-bold ${punch.isCounted ? 'text-present-ink' : 'text-muted'}`}
        >
          {punch.notCountedBecause ? NOT_COUNTED[punch.notCountedBecause] : 'Present'}
        </span>
      </span>
    </li>
  );
}

function PunchesCard({ live }: { live: LiveViewState }) {
  const body = () => {
    if (live.failed) {
      return (
        <p className="text-muted">
          The live view cannot reach the EVLOS server. Start it with npm run dev, then reload this
          page.
        </p>
      );
    }
    if (live.view === null) return <p className="text-muted">Loading today's Punches.</p>;
    if (live.view.punches.length === 0) {
      return (
        <p className="text-muted">
          No Punches yet today. Each Punch appears here as soon as the Device sends it.
        </p>
      );
    }
    return (
      <ol className="max-h-[30rem] overflow-y-auto">
        {live.view.punches.map((punch) => (
          <PunchRow
            key={punchKey(punch)}
            punch={punch}
            isNew={punchKey(punch) === live.newestKey}
          />
        ))}
      </ol>
    );
  };
  return (
    <section className="report-card grid content-start gap-2" aria-label="Latest Punches">
      <h2 className="font-display text-xl font-bold">Latest Punches</h2>
      <div aria-live="polite">{body()}</div>
    </section>
  );
}

// The Live view (FR-2, FR-3): today's count, when the Punches came in, who is Pending, who is
// Away, and each Punch as it arrives.
export function LiveViewPage(props: {
  source: LiveViewSource;
  reports: ReportSource;
  students: StudentSource;
  device: DeviceStatusSource;
  now?: () => number;
  onOpenLeaves: OpenLeaves;
}) {
  const live = useLiveView(props.source);
  const now = useNow(props.now ?? Date.now);
  const day = live.view?.day ?? null;
  const waiting = useWaiting(props.reports, day, live.view?.punches.length ?? 0);
  const away = useAway(props.students);
  return (
    <div className="grid gap-6">
      <Heading day={day} device={props.device} onOpenLeaves={props.onOpenLeaves} />
      <section aria-label="Today's Pooja" className="book-card flex flex-wrap gap-x-12 gap-y-7 p-7">
        <Counts live={live} waiting={waiting} away={away} />
        {live.view && (
          <PunchBand
            counts={firstPunchSlots(live.view.punches, live.view.day)}
            day={live.view.day}
            now={now}
          />
        )}
      </section>
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        <WaitingCard waiting={waiting} />
        <AwayCard away={away} onOpenLeaves={props.onOpenLeaves} />
        <PunchesCard live={live} />
      </div>
    </div>
  );
}
