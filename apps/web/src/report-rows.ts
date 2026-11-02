import type { PoojaStatusName, ReportRow } from './report-source.js';

export type SortBy = 'Room' | 'Name';
export type StatusFilter = 'All' | PoojaStatusName;

// numeric: true puts room A-9 before A-10.
const byText = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const ORDERS: Record<SortBy, (a: ReportRow, b: ReportRow) => number> = {
  Room: (a, b) => byText.compare(a.room, b.room) || byText.compare(a.name, b.name),
  Name: (a, b) => byText.compare(a.name, b.name) || byText.compare(a.room, b.room),
};

export function visibleRows(
  rows: readonly ReportRow[],
  sortBy: SortBy,
  status: StatusFilter,
): ReportRow[] {
  const kept = status === 'All' ? rows : rows.filter((row) => row.statuses.includes(status));
  return [...kept].sort(ORDERS[sortBy]);
}

export const countOf = (row: ReportRow, status: PoojaStatusName): number =>
  row.statuses.filter((one) => one === status).length;
