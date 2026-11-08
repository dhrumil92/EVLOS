import { useState } from 'react';
import { floorsOf, studentsInMonth } from './report-month.js';
import type { MonthStudent } from './report-month.js';
import type { PoojaStatusName, Report } from './report-source.js';
import { useScrollHandoff } from './use-scroll-handoff.js';

const SQUARE: Record<PoojaStatusName, string> = {
  Present: 'square-present',
  Absent: 'square-absent',
  'Not Applicable': 'square-not-applicable',
  'Needs Review': 'square-review',
  Pending: 'square-empty',
};

function Strip({ student }: { student: MonthStudent }) {
  const words = `${student.name}: Present ${String(student.present)}, Not Applicable ${String(student.notApplicable)}, Absent ${String(student.absent)}`;
  return (
    <span role="img" aria-label={words} className="flex gap-0.5">
      {student.cells.map((status, index) => (
        <span
          key={index}
          className={`square ${status === null ? 'square-empty' : SQUARE[status]}`}
        />
      ))}
    </span>
  );
}

function Legend() {
  const items = [
    ['Present', 'square-present'],
    ['Not Applicable', 'square-not-applicable'],
    ['Absent', 'square-absent'],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Colours">
      {items.map(([name, square]) => (
        <li key={name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`square ${square}`} />
          {name}
        </li>
      ))}
    </ul>
  );
}

// Every floor at first, so nothing is filtered.
function FloorChoice(props: {
  floors: number[];
  floor: number | null;
  onFloor: (floor: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-muted">
      Floor
      <select
        className="field"
        value={props.floor === null ? '' : String(props.floor)}
        onChange={(event) => {
          props.onFloor(event.target.value === '' ? null : Number(event.target.value));
        }}
      >
        <option value="">All floors</option>
        {props.floors.map((floor) => (
          <option key={floor} value={String(floor)}>
            Floor {floor}
          </option>
        ))}
      </select>
    </label>
  );
}

// Each Student's month on one line: a small square for every Day, and the Days of each Pooja
// Status. Every Student is listed, the most Absent at the top; the list scrolls inside its card
// and a floor can be chosen.
export function StudentsInMonth({ report }: { report: Report }) {
  const [floor, setFloor] = useState<number | null>(null);
  const students = studentsInMonth(report, floor);
  const handoff = useScrollHandoff();
  return (
    <section aria-label={`Students in ${report.title}`} className="report-card grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Students in {report.title}</h2>
          <p className="text-muted">
            {String(students.length)} {students.length === 1 ? 'Student' : 'Students'}, the most
            Absent first. Each small square is one Day.
          </p>
        </div>
        <FloorChoice floors={floorsOf(report)} floor={floor} onFloor={setFloor} />
      </div>
      {students.length === 0 ? (
        <p className="text-muted">No Student has a Pooja Status in this period.</p>
      ) : (
        <div
          ref={handoff}
          className="student-scroll"
          tabIndex={0}
          aria-label="Student list, scrolls"
        >
          <table className="student-table" aria-label={`Students in ${report.title}`}>
            <thead>
              <tr>
                <th>Room</th>
                <th>Student</th>
                <th>Each Day</th>
                <th>Present</th>
                <th>Not Applicable</th>
                <th>Absent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.studentId}>
                  <td className="font-bold text-muted">{student.room}</td>
                  <td className="font-bold">{student.name}</td>
                  <td>
                    <Strip student={student} />
                  </td>
                  <td>{student.present}</td>
                  <td>{student.notApplicable}</td>
                  <td className={student.absent > 0 ? 'font-bold text-danger' : ''}>
                    {student.absent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Legend />
    </section>
  );
}
