import { useCallback, useEffect, useState } from 'react';
import { inWords, LeaveStateLabel } from './LeaveStatus.js';
import { ManyStudentsTools } from './ManyStudentsPanels.js';
import type { ListedStudent, StudentSource } from './student-source.js';

// Soonest Expected Return first. Due Back means expected by tomorrow, so Due Back Students
// always come before the other Away Students.
const byWhoIsExpected = (a: ListedStudent, b: ListedStudent) =>
  (a.openLeave?.expectedReturnAt ?? 0) - (b.openLeave?.expectedReturnAt ?? 0);

function countText(away: ListedStudent[]) {
  const dueBack = away.filter((student) => student.leaveState === 'Due Back').length;
  const are =
    away.length === 1 ? '1 Student is Away.' : `${String(away.length)} Students are Away.`;
  return dueBack === 0
    ? are
    : `${are} ${String(dueBack)} ${dueBack === 1 ? 'is' : 'are'} Due Back.`;
}

function AwayList({ away }: { away: ListedStudent[] }) {
  if (away.length === 0) {
    return <p className="text-mist">No Student is Away.</p>;
  }
  return (
    <>
      <p className="text-mist">{countText(away)}</p>
      <ul className="student-scroll grid" aria-label="Away Students">
        {away.map((student) => (
          <li key={student.studentId} className="away-row">
            <span className="text-mist">{student.room}</span>
            <span className="font-semibold">{student.name}</span>
            <LeaveStateLabel state={student.leaveState} />
            {student.openLeave && (
              <span className="text-mist">
                Expected back {inWords(student.openLeave.expectedReturnAt)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// The Leaves page: who is away tonight, and Leave or Return for many Students (FR-4b, FR-5).
export function LeavesPage(props: { source: StudentSource; today: string }) {
  const { source } = props;
  const [students, setStudents] = useState<ListedStudent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStudents(await source.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const away = (students ?? [])
    .filter((student) => student.isActive && student.leaveState !== 'In hostel')
    .sort(byWhoIsExpected);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-[2.5rem] leading-tight font-bold text-gold">Leaves</h1>
        <p className="text-mist">
          See who is away, and record Leaves and Returns for many Students.
        </p>
      </div>
      {failed && (
        <p className="notice">
          The Leaves page cannot reach the EVLOS server. Start it with npm run dev, then reload this
          page.
        </p>
      )}
      <ManyStudentsTools
        students={students ?? []}
        source={source}
        today={props.today}
        onDone={() => void refresh()}
      />
      {students && (
        <section className="report-card grid gap-3" aria-label="Who is away">
          <h2 className="font-display text-2xl font-semibold">Who is away</h2>
          <AwayList away={away} />
        </section>
      )}
    </div>
  );
}
