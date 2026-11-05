export type PoojaStatusName = 'Present' | 'Absent' | 'Not Applicable' | 'Pending' | 'Needs Review';

export interface ReportRow {
  studentId: string;
  name: string;
  room: string;
  // One Pooja Status for each Day the Report covers; null on a Day he was not Active.
  statuses: (PoojaStatusName | null)[];
}

export interface DayTotals {
  day: number;
  present: number;
  absent: number;
  notApplicable: number;
}

export type ReportRequest =
  | { view: 'Day'; day: string }
  | { view: 'Month'; month: string }
  | { view: 'Date range'; from: string; to: string };

export interface Report {
  title: string;
  isFinalized: boolean;
  rows: ReportRow[];
  // Students by hour of first Punch, from 05:30, for a Day Report.
  hours: number[] | null;
  // Totals for each Day, for a month Report.
  days: DayTotals[] | null;
}

export interface ReportSource {
  load(request: ReportRequest): Promise<Report>;
  // Where the browser downloads the same Report as a CSV file: every Student, or only those
  // with the chosen Pooja Status on at least one Day.
  csvUrl(request: ReportRequest, status: PoojaStatusName | 'All'): string;
  // The same, as an Excel file.
  xlsxUrl(request: ReportRequest, status: PoojaStatusName | 'All'): string;
}
