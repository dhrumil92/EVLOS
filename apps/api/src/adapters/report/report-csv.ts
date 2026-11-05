import type { Report } from '../../use-cases/get-report.js';
import { reportTable, statusText } from './report-table.js';

// Lets Excel read the file as UTF-8, so names in any script show correctly.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const LINE_END = '\r\n';

// A cell is quoted when it holds a comma, a double quote or a line break (RFC 4180).
function cell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Text a person typed, such as a name. One that starts like a formula gets a leading ' so a
// spreadsheet shows it as text and never runs it.
function typedCell(text: string): string {
  return cell(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
}

// The Report as a CSV file: one row per Student, one column per Day (FR-11). A Day that is
// not Finalized is marked in its heading, and shows Needs Review there, never Absent.
export function reportCsv(report: Report): string {
  const { heading, rows } = reportTable(report);
  const lines = [
    heading.map(cell),
    ...rows.map((row) => [...row.student.map(typedCell), ...row.statuses.map(statusText)]),
  ].map((line) => line.join(','));
  return BYTE_ORDER_MARK + lines.join(LINE_END) + LINE_END;
}
