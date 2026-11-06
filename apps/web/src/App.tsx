import { useState } from 'react';
import type { ReactNode } from 'react';
import { httpDeviceStatusSource } from './device-status-source.js';
import type { DeviceStatusSource } from './device-status-source.js';
import { httpReportSource } from './http-report-source.js';
import { LeavesPage } from './LeavesPage.js';
import type { Book } from './LeavesPage.js';
import type { LiveViewSource } from './live-view-source.js';
import { LiveViewPage } from './LiveView.js';
import type { ReportSource } from './report-source.js';
import { ReportsPage } from './ReportsPage.js';
import { httpReviewSource } from './review-source.js';
import type { ReviewSource } from './review-source.js';
import { ReviewPage } from './ReviewPage.js';
import { httpSettingsSource } from './settings-source.js';
import type { SettingsSource } from './settings-source.js';
import { SettingsPage } from './SettingsPage.js';
import { httpStudentSource } from './student-source.js';
import type { StudentSource } from './student-source.js';
import { StudentsPage } from './StudentsPage.js';

const LIVE_VIEW = 'Live view';
const REPORTS = 'Reports';
const STUDENTS = 'Students';
const LEAVES = 'Leaves';
const REVIEW = 'Review and Finalize';
const PAGES = [LIVE_VIEW, STUDENTS, LEAVES, REVIEW, REPORTS];
// Not in the page menu: it sits beside Log out.
const SETTINGS = 'Settings';

const istToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now());

// Which book the Leaves page opens on, and the Students it starts with. "times" remounts the
// page, so pressing Return twice for different Students opens the book fresh each time.
interface LeavesOpening {
  book: Book;
  students: readonly string[];
  times: number;
}

function Menu(props: {
  page: string;
  onPage: (page: string) => void;
  onLogOut?: (() => void) | undefined;
}) {
  return (
    <header className="gutter border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[80rem] flex-wrap items-center gap-x-8 pt-2 md:flex-nowrap md:pt-0">
        <div className="font-display text-[1.65rem] font-extrabold tracking-tight text-primary lowercase">
          EVLOS
        </div>
        <nav
          aria-label="Main menu"
          className="flex min-w-0 basis-full gap-6 overflow-x-auto md:basis-auto"
        >
          {PAGES.map((name) => (
            <button
              key={name}
              type="button"
              aria-current={name === props.page ? 'page' : undefined}
              onClick={() => {
                props.onPage(name);
              }}
              className="menu-item"
            >
              {name}
            </button>
          ))}
        </nav>
        <button
          type="button"
          aria-current={props.page === SETTINGS ? 'page' : undefined}
          onClick={() => {
            props.onPage(SETTINGS);
          }}
          className="menu-item ml-auto"
        >
          {SETTINGS}
        </button>
        {props.onLogOut && (
          <button type="button" className="menu-item" onClick={props.onLogOut}>
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

export function App(props: {
  source: LiveViewSource;
  students?: StudentSource;
  reports?: ReportSource;
  review?: ReviewSource;
  settings?: SettingsSource;
  device?: DeviceStatusSource;
  onLogOut?: () => void;
}) {
  const { source, students = httpStudentSource, reports = httpReportSource } = props;
  const [page, setPage] = useState(LIVE_VIEW);
  const [leaves, setLeaves] = useState<LeavesOpening>({
    book: 'Going-to-Home Book',
    students: [],
    times: 0,
  });
  const deviceSource = props.device ?? httpDeviceStatusSource;
  const [today] = useState(istToday);
  const openLeaves = (book: Book, students: readonly string[] = []) => {
    setLeaves((old) => ({ book, students, times: old.times + 1 }));
    setPage(LEAVES);
  };
  const pages: Record<string, ReactNode> = {
    [LIVE_VIEW]: (
      <LiveViewPage
        source={source}
        reports={reports}
        students={students}
        device={deviceSource}
        onOpenLeaves={openLeaves}
      />
    ),
    [REPORTS]: <ReportsPage source={reports} today={today} />,
    [STUDENTS]: <StudentsPage source={students} today={today} onOpenLeaves={openLeaves} />,
    [LEAVES]: (
      <LeavesPage
        key={leaves.times}
        source={students}
        today={today}
        startBook={leaves.book}
        startStudents={leaves.students}
      />
    ),
    [REVIEW]: (
      <ReviewPage
        source={props.review ?? httpReviewSource}
        device={deviceSource}
        reports={reports}
        today={today}
        onOpenLeaves={() => {
          openLeaves('Going-to-Home Book');
        }}
      />
    ),
    [SETTINGS]: <SettingsPage source={props.settings ?? httpSettingsSource} />,
  };

  return (
    <div className="screen">
      <Menu page={page} onPage={setPage} onLogOut={props.onLogOut} />
      <div className="gutter">
        <main className="mx-auto max-w-[80rem] pt-8 pb-2">{pages[page]}</main>
      </div>
    </div>
  );
}
