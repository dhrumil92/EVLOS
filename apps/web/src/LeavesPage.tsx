import { useState } from 'react';
import type { ReactNode } from 'react';
import { awayInOrder } from './back-book.js';
import { BackFromHomeBook } from './BackFromHomeBook.js';
import { GoingToHomeBook } from './GoingToHomeBook.js';
import { inWords, LeaveStateLabel } from './LeaveStatus.js';
import type { ListedStudent, StudentSource } from './student-source.js';
import { useStudents } from './use-students.js';

export type Book = 'Going-to-Home Book' | 'Back-from-Home Book';

function countText(away: ListedStudent[]) {
  const dueBack = away.filter((student) => student.leaveState === 'Due Back').length;
  const are =
    away.length === 1 ? '1 Student is Away.' : `${String(away.length)} Students are Away.`;
  return dueBack === 0
    ? are
    : `${are} ${String(dueBack)} ${dueBack === 1 ? 'is' : 'are'} Due Back.`;
}

function BookTab(props: {
  book: Book;
  line: string;
  icon: ReactNode;
  chosen: Book;
  onChoose: (book: Book) => void;
}) {
  const isChosen = props.book === props.chosen;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isChosen}
      onClick={() => {
        props.onChoose(props.book);
      }}
      className={`flex items-center gap-4 rounded-2xl border-[1.5px] px-5 py-4 text-left ${isChosen ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink hover:bg-tint'}`}
    >
      <span aria-hidden="true" className={isChosen ? 'text-white' : 'text-primary'}>
        {props.icon}
      </span>
      <span className="grid">
        <span className="font-display text-xl font-bold">{props.book}</span>
        <span className={`text-sm ${isChosen ? 'text-on-primary-muted' : 'text-muted'}`}>
          {props.line}
        </span>
      </span>
    </button>
  );
}

const ICON = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' };
const GOING_ICON = (
  <svg {...ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h10v16H4z" />
    <path d="M14 12h7" />
    <path d="M18 9l3 3-3 3" />
  </svg>
);
const BACK_ICON = (
  <svg {...ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 4H10v16h10z" />
    <path d="M10 12H3" />
    <path d="M6 9l-3 3 3 3" />
  </svg>
);

function AwayNow(props: { away: ListedStudent[]; onOpenReturns: () => void }) {
  const { away } = props;
  return (
    <section className="report-card grid gap-2" aria-label="Away now">
      <h2 className="font-display text-xl font-bold">Away now</h2>
      {away.length === 0 ? (
        <p className="text-muted">No Student is Away.</p>
      ) : (
        <>
          <p className="text-sm text-muted">{countText(away)}</p>
          {away.some((student) => student.leaveState === 'Due Back') && (
            <p className="text-sm text-muted">Due Back first.</p>
          )}
          <ul className="grid" aria-label="Away Students">
            {away.map((student) => (
              <li
                key={student.studentId}
                className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-t border-line py-2"
              >
                <span className="font-bold text-muted">{student.room}</span>
                <span className="truncate font-bold">{student.name}</span>
                <LeaveStateLabel state={student.leaveState} />
                {student.openLeave && (
                  <span className="col-start-2 col-end-4 text-sm text-muted">
                    Expected back {inWords(student.openLeave.expectedReturnAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-quiet mt-2" onClick={props.onOpenReturns}>
            Open the Back-from-Home Book
          </button>
        </>
      )}
    </section>
  );
}

function GoodToKnow() {
  return (
    <section className="report-card grid gap-2" aria-label="Good to know">
      <h2 className="font-display text-lg font-bold">Good to know</h2>
      <ul className="grid list-disc gap-1.5 pl-5 text-muted">
        <li>The Out Time cannot be later than now.</li>
        <li>
          A Leave that touches the Pooja Window makes that Day Not Applicable for the Student.
        </li>
        <li>A line with a problem stays here with the reason. The other lines still save.</li>
      </ul>
    </section>
  );
}

// The open book. Lines for Students sent from another page need their rooms, so the
// Going-to-Home Book waits for the Student list before it starts.
function OpenBook(props: {
  book: Book;
  students: ListedStudent[] | null;
  source: StudentSource;
  today: string;
  goingStart: readonly string[];
  startTicked: readonly string[];
  onSaved: () => void;
  onOpenReturns: (studentId: string) => void;
}) {
  if (props.book === 'Back-from-Home Book') {
    return (
      <BackFromHomeBook
        students={props.students ?? []}
        source={props.source}
        today={props.today}
        startTicked={props.startTicked}
        onSaved={props.onSaved}
      />
    );
  }
  if (props.students === null && props.goingStart.length > 0) return null;
  return (
    <GoingToHomeBook
      students={props.students ?? []}
      source={props.source}
      today={props.today}
      startStudents={props.goingStart}
      onSaved={props.onSaved}
      onOpenReturns={props.onOpenReturns}
    />
  );
}

// The Leaves page: one tab for each paper book, copied line by line (FR-4b, FR-5), and who
// is Away now. startBook and startStudents let another page open a book already filled in: a
// line for each Student in the Going-to-Home Book, or each Student ticked in the other book.
export function LeavesPage(props: {
  source: StudentSource;
  today: string;
  startBook?: Book;
  startStudents?: readonly string[];
}) {
  const { source } = props;
  const { students, failed, refresh } = useStudents(source);
  const [book, setBook] = useState<Book>(props.startBook ?? 'Going-to-Home Book');
  const sent = props.startStudents ?? [];
  // A Student sent from a Going-to-Home line who is already Away starts ticked.
  const [startTicked, setStartTicked] = useState<readonly string[]>(
    props.startBook === 'Back-from-Home Book' ? sent : [],
  );
  const away = awayInOrder(students ?? []);
  const openReturns = (studentId: string | null = null) => {
    setStartTicked(studentId === null ? [] : [studentId]);
    setBook('Back-from-Home Book');
  };

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
          Leaves
        </h1>
        <p className="text-muted">Pick the book you have open and copy it line by line.</p>
      </div>
      {failed && (
        <p className="notice">
          The Leaves page cannot reach the EVLOS server. Start it with npm run dev, then reload this
          page.
        </p>
      )}
      <div role="tablist" aria-label="Which book" className="grid gap-3 sm:grid-cols-2">
        <BookTab
          book="Going-to-Home Book"
          line="Record Leaves for Students who left"
          icon={GOING_ICON}
          chosen={book}
          onChoose={setBook}
        />
        <BookTab
          book="Back-from-Home Book"
          line={`Record Returns. ${countText(away)}`}
          icon={BACK_ICON}
          chosen={book}
          onChoose={setBook}
        />
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[3_1_40rem]">
          <OpenBook
            book={book}
            students={students}
            source={source}
            today={props.today}
            goingStart={book === props.startBook ? sent : []}
            startTicked={startTicked}
            onSaved={() => void refresh()}
            onOpenReturns={openReturns}
          />
        </div>
        <aside className="grid min-w-0 flex-[1_1_18rem] gap-5">
          {students && (
            <AwayNow
              away={away}
              onOpenReturns={() => {
                openReturns();
              }}
            />
          )}
          <GoodToKnow />
        </aside>
      </div>
    </div>
  );
}
