import writeXlsxFile from 'write-excel-file/node';
import type { Cell, CellObject, Row } from 'write-excel-file/node';
import type { PoojaStatusName, Report } from '../../use-cases/get-report.js';
import { reportTable, statusText } from './report-table.js';

const STUDENT_COLUMN_WIDTHS = [12, 30, 8];
const DAY_COLUMN_WIDTH = 14;

// Excel's own Good, Bad and Neutral styles, so the colours look familiar to the Rector.
const GREY_TEXT = { textColor: '#808080' };
const STATUS_STYLE: Record<PoojaStatusName, Omit<CellObject, 'value'>> = {
  Present: { backgroundColor: '#C6EFCE', textColor: '#006100' },
  Absent: { backgroundColor: '#FFC7CE', textColor: '#9C0006' },
  'Needs Review': { backgroundColor: '#FFEB9C', textColor: '#9C5700' },
  'Not Applicable': GREY_TEXT,
  Pending: GREY_TEXT,
};

// A Pooja Status cell in its colour; empty on a Day the Student was not Active.
const statusCell = (status: PoojaStatusName | null): Cell =>
  status === null ? null : { value: statusText(status), ...STATUS_STYLE[status] };

// The Report as an Excel file, with the same table as the CSV (FR-11), each Pooja Status in its
// colour. Every cell is written as text, so a Student ID keeps its leading zeros and a name
// that starts like a formula is shown as typed and never run. The heading is bold and stays
// in view while scrolling.
export async function reportXlsx(report: Report): Promise<Buffer> {
  const { heading, rows } = reportTable(report);
  const sheet: Row[] = [
    heading.map((text) => ({ value: text, type: String, fontWeight: 'bold' as const })),
    ...rows.map((row) => [...row.student, ...row.statuses.map(statusCell)]),
  ];
  const columns = heading.map((_, index) => ({
    width: STUDENT_COLUMN_WIDTHS[index] ?? DAY_COLUMN_WIDTH,
  }));
  return writeXlsxFile(sheet, { sheet: 'Report', columns, stickyRowsCount: 1 }).toBuffer();
}
