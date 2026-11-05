import writeXlsxFile from 'write-excel-file/node';
import type { Row } from 'write-excel-file/node';
import type { Report } from '../../use-cases/get-report.js';
import { reportTable } from './report-table.js';

const STUDENT_COLUMN_WIDTHS = [12, 30, 8];
const DAY_COLUMN_WIDTH = 14;

// The Report as an Excel file, with the same table as the CSV (FR-11). Every cell is written
// as text, so a Student ID keeps its leading zeros and a name that starts like a formula is
// shown as typed and never run. The heading is bold and stays in view while scrolling.
export async function reportXlsx(report: Report): Promise<Buffer> {
  const { heading, rows } = reportTable(report);
  const sheet: Row[] = [
    heading.map((text) => ({ value: text, type: String, fontWeight: 'bold' as const })),
    ...rows.map((row) => [...row.student, ...row.statuses].map((text) => text || null)),
  ];
  const columns = heading.map((_, index) => ({
    width: STUDENT_COLUMN_WIDTHS[index] ?? DAY_COLUMN_WIDTH,
  }));
  return writeXlsxFile(sheet, { sheet: 'Report', columns, stickyRowsCount: 1 }).toBuffer();
}
