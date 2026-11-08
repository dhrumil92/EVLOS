export type PoojaStatusName = 'Present' | 'Absent' | 'Not Applicable' | 'Pending' | 'Needs Review';

export interface ReportRow {
  studentId: string;
  name: string;
  room: string;
  // One Pooja Status for each Day the Report covers; null on a Day he was not Active.
  statuses: (PoojaStatusName | null)[];
}

export type ReportRequest =
  | { view: 'Day'; day: string }
  | { view: 'Month'; month: string }
  | { view: 'Date range'; from: string; to: string };

// A Day the Report covers, and whether it was Finalized.
export interface ReportDay {
  day: string;
  isFinalized: boolean;
}

export interface Report {
  title: string;
  isFinalized: boolean;
  rows: ReportRow[];
  // The Days the Report covers, in order: each Student's statuses follow the same order.
  reportDays: ReportDay[];
}

export interface ReportSource {
  load(request: ReportRequest): Promise<Report>;
  // Where the browser downloads the same Report as a CSV file: every Student, or only those
  // with the chosen Pooja Status on at least one Day.
  csvUrl(request: ReportRequest, status: PoojaStatusName | 'All'): string;
  // The same, as an Excel file.
  xlsxUrl(request: ReportRequest, status: PoojaStatusName | 'All'): string;
}
