import type {
  PoojaStatusName,
  Report,
  ReportRequest,
  ReportRow,
} from '../../use-cases/get-report.js';

// The Report as plain text cells, shared by the CSV and the Excel file so both always hold
// the same table: one row per Student, one column per Day (FR-11).
export interface ReportTable {
  heading: string[];
  rows: {
    // Student ID, name and room: text a person typed.
    student: [string, string, string];
    // One per Day; null on a Day the Student was not Active.
    statuses: (PoojaStatusName | null)[];
  }[];
}

// Not Applicable is shown as "-" everywhere (UBIQUITOUS_LANGUAGE.md, ambiguity 5).
const STATUS_TEXT: Record<PoojaStatusName, string> = {
  Present: 'Present',
  Absent: 'Absent',
  'Not Applicable': '-',
  Pending: 'Pending',
  'Needs Review': 'Needs Review',
};

// A Pooja Status as written in a Report file; empty on a Day the Student was not Active.
export const statusText = (status: PoojaStatusName | null): string =>
  status === null ? '' : STATUS_TEXT[status];

const byRoomThenName = (first: ReportRow, second: ReportRow) =>
  first.room.localeCompare(second.room) || first.name.localeCompare(second.name);

// A Day that is not Finalized is marked in its heading, and shows Needs Review there, never
// Absent. Students are listed by room, then by name.
export function reportTable(report: Report): ReportTable {
  const heading = [
    'Student ID',
    'Name',
    'Room',
    ...report.reportDays.map(({ day, isFinalized }) =>
      isFinalized ? day : `${day} (Not Finalized)`,
    ),
  ];
  const rows = [...report.rows].sort(byRoomThenName).map((row) => ({
    student: [row.studentId, row.name, row.room] as [string, string, string],
    statuses: row.statuses,
  }));
  return { heading, rows };
}

// Only called for a Report that could be made, so the dates in it are real dates.
export function reportFileName(request: ReportRequest, extension: 'csv' | 'xlsx'): string {
  if (request.view === 'Day') return `EVLOS Report ${request.day}.${extension}`;
  if (request.view === 'Month') return `EVLOS Report ${request.month}.${extension}`;
  return `EVLOS Report ${request.from} to ${request.to}.${extension}`;
}
