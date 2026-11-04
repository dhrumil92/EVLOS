import type {
  PoojaStatusName,
  Report,
  ReportRequest,
  ReportRow,
} from '../../use-cases/get-report.js';

// Lets Excel read the file as UTF-8, so names in any script show correctly.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const LINE_END = '\r\n';

// Not Applicable is shown as "-" everywhere (UBIQUITOUS_LANGUAGE.md, ambiguity 5).
const STATUS_TEXT: Record<PoojaStatusName, string> = {
  Present: 'Present',
  Absent: 'Absent',
  'Not Applicable': '-',
  Pending: 'Pending',
  'Needs Review': 'Needs Review',
};

// A cell is quoted when it holds a comma, a double quote or a line break (RFC 4180).
function cell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Text a person typed, such as a name. One that starts like a formula gets a leading ' so a
// spreadsheet shows it as text and never runs it.
function typedCell(text: string): string {
  return cell(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
}

const byRoomThenName = (first: ReportRow, second: ReportRow) =>
  first.room.localeCompare(second.room) || first.name.localeCompare(second.name);

// The Report as a CSV file: one row per Student, one column per Day (FR-11). A Day that is
// not Finalized is marked in its heading, and shows Needs Review there, never Absent.
export function reportCsv(report: Report): string {
  const heading = [
    'Student ID',
    'Name',
    'Room',
    ...report.reportDays.map(({ day, isFinalized }) =>
      isFinalized ? day : `${day} (Not Finalized)`,
    ),
  ];
  const rows = [...report.rows]
    .sort(byRoomThenName)
    .map((row) => [
      typedCell(row.studentId),
      typedCell(row.name),
      typedCell(row.room),
      ...row.statuses.map((status) => (status === null ? '' : STATUS_TEXT[status])),
    ]);
  const lines = [heading.map(cell), ...rows].map((line) => line.join(','));
  return BYTE_ORDER_MARK + lines.join(LINE_END) + LINE_END;
}

// Only called for a Report that could be made, so the dates in it are real dates.
export function csvFileName(request: ReportRequest): string {
  if (request.view === 'Day') return `EVLOS Report ${request.day}.csv`;
  if (request.view === 'Month') return `EVLOS Report ${request.month}.csv`;
  return `EVLOS Report ${request.from} to ${request.to}.csv`;
}
