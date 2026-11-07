import writeXlsxFile from 'write-excel-file/node';
import type { Cell, CellObject, Row } from 'write-excel-file/node';
import type {
  HostelState,
  PresenceRequest,
  PresenceRow,
  VidyalayaPresence,
} from '../../use-cases/get-vidyalaya-presence.js';

const ROOM_AND_NAME_WIDTHS = [8, 30];
const DAY_COLUMN_WIDTH = 12;
const TOTAL_COLUMN_WIDTH = 16;

// Excel's own Good and Bad styles, as in the Pooja Excel, so the colours look familiar.
const STATE_STYLE: Record<HostelState, Omit<CellObject, 'value'>> = {
  'In hostel': { backgroundColor: '#C6EFCE', textColor: '#006100' },
  Away: { backgroundColor: '#FFC7CE', textColor: '#9C0006' },
};

// A state in its colour; empty on a Day the Student was not Active.
const stateCell = (state: HostelState | null): Cell =>
  state === null ? null : { value: state, ...STATE_STYLE[state] };

const countOf = (row: PresenceRow, state: HostelState) =>
  row.states.filter((one) => one === state).length;

// Vidyalaya Presence as an Excel file (FR-16): one row for each Student in the order given, which
// is by room in ascending order, and one column for each Day, then the Days In hostel and the
// Days Away. Every name and room is written as text, so a room keeps its zeros and a name that
// starts like a formula is shown as typed and never run. The heading is bold and stays in view
// while scrolling.
export async function presenceXlsx(presence: VidyalayaPresence): Promise<Buffer> {
  const heading = ['Room', 'Name', ...presence.days, 'Days In hostel', 'Days Away'];
  const sheet: Row[] = [
    heading.map((text) => ({ value: text, type: String, fontWeight: 'bold' as const })),
    ...presence.rows.map((row) => [
      row.room,
      row.name,
      ...row.states.map(stateCell),
      countOf(row, 'In hostel'),
      countOf(row, 'Away'),
    ]),
  ];
  const columns = heading.map((_, index) => ({
    width:
      ROOM_AND_NAME_WIDTHS[index] ??
      (index >= heading.length - 2 ? TOTAL_COLUMN_WIDTH : DAY_COLUMN_WIDTH),
  }));
  return writeXlsxFile(sheet, {
    sheet: 'Vidyalaya Presence',
    columns,
    stickyRowsCount: 1,
  }).toBuffer();
}

// vidyalaya-presence-2026-11-07.xlsx for a Day, vidyalaya-presence-2026-11.xlsx for a month.
export function presenceFileName(request: PresenceRequest): string {
  const period = request.view === 'Day' ? request.day : request.month;
  return `vidyalaya-presence-${period}.xlsx`;
}
