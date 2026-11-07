import { useEffect, useRef, useState } from 'react';
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

function PageButton(props: {
  name: string;
  isCurrent: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={props.isCurrent ? 'page' : undefined}
      onClick={props.onClick}
      className={props.className}
    >
      {props.name}
    </button>
  );
}

// The three-line button of a phone.
function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

// On a phone: a panel that slides in from the right edge with the pages, and Settings and Log out
// at the bottom.
// A strip of the page is left at the other edge, dimmed; pressing it, the cross or Escape closes.
function PhoneDrawer(props: {
  page: string;
  onPage: (page: string) => void;
  onLogOut?: (() => void) | undefined;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    // The page behind does not scroll while the panel is open.
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  const row = (isCurrent: boolean) =>
    `flex min-h-12 items-center border-t border-line pr-4 text-left ${isCurrent ? 'border-l-[3px] border-l-primary pl-4 font-bold text-ink' : 'pl-[19px] text-muted'}`;
  const go = (page: string) => () => {
    props.onPage(page);
    props.onClose();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-50 md:hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape') props.onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        className="absolute inset-0 bg-overlay"
        onClick={props.onClose}
      />
      <nav
        aria-label="Pages"
        className="drawer absolute inset-y-0 right-0 flex w-[82%] max-w-80 flex-col overflow-y-auto bg-surface"
      >
        <div className="flex min-h-14 items-center justify-between pl-4 pr-2">
          <span className="font-display text-[1.65rem] font-extrabold tracking-tight text-primary lowercase">
            EVLOS
          </span>
          <button
            ref={closeButton}
            type="button"
            className="gear"
            aria-label="Close"
            onClick={props.onClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {PAGES.map((name) => (
          <PageButton
            key={name}
            name={name}
            isCurrent={name === props.page}
            className={row(name === props.page)}
            onClick={go(name)}
          />
        ))}
        <div className="mt-auto grid">
          <PageButton
            name={SETTINGS}
            isCurrent={props.page === SETTINGS}
            className={row(props.page === SETTINGS)}
            onClick={go(SETTINGS)}
          />
          {props.onLogOut && (
            <button
              type="button"
              className={row(false)}
              onClick={() => {
                props.onLogOut?.();
                props.onClose();
              }}
            >
              Log out
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

// The bar stays at the top while the page scrolls. On a wide screen the pages are in the bar;
// on a phone a three-line button slides them in from the side.
function Menu(props: {
  page: string;
  onPage: (page: string) => void;
  onLogOut?: (() => void) | undefined;
}) {
  const [isOpen, setOpen] = useState(false);
  return (
    <header className="gutter sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 max-w-[80rem] items-center gap-x-8 md:min-h-0">
        <div className="font-display text-[1.65rem] font-extrabold tracking-tight text-primary lowercase">
          EVLOS
        </div>
        <nav aria-label="Main menu" className="hidden min-w-0 gap-6 md:flex">
          {PAGES.map((name) => (
            <PageButton
              key={name}
              name={name}
              isCurrent={name === props.page}
              className="menu-item"
              onClick={() => {
                props.onPage(name);
              }}
            />
          ))}
        </nav>
        <div className="ml-auto hidden gap-5 md:flex">
          <PageButton
            name={SETTINGS}
            isCurrent={props.page === SETTINGS}
            className="menu-item"
            onClick={() => {
              props.onPage(SETTINGS);
            }}
          />
          {props.onLogOut && (
            <button type="button" className="menu-item" onClick={props.onLogOut}>
              Log out
            </button>
          )}
        </div>
        <button
          type="button"
          className="gear ml-auto md:hidden"
          aria-label="Menu"
          aria-expanded={isOpen}
          onClick={() => {
            setOpen((old) => !old);
          }}
        >
          <MenuIcon />
        </button>
      </div>
      {isOpen && (
        <PhoneDrawer
          page={props.page}
          onPage={props.onPage}
          onLogOut={props.onLogOut}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
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
  onLogOut?: (() => void) | undefined;
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
    [STUDENTS]: (
      <StudentsPage source={students} reports={reports} today={today} onOpenLeaves={openLeaves} />
    ),
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
    [SETTINGS]: (
      <SettingsPage source={props.settings ?? httpSettingsSource} device={deviceSource} />
    ),
  };

  return (
    <div className="screen">
      <Menu page={page} onPage={setPage} onLogOut={props.onLogOut} />
      <div className="gutter">
        <main className="mx-auto max-w-[80rem] pt-4 pb-2">{pages[page]}</main>
      </div>
    </div>
  );
}
