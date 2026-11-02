import type {
  DayTotals,
  PoojaStatusName,
  Report,
  ReportRequest,
  ReportRow,
  ReportSource,
} from './report-source.js';

// Made-up Students, shown under an "Example data" banner until Phase 4 adds real ones.
const STUDENTS = 360;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIRST = [
  'Aarav',
  'Vivaan',
  'Krish',
  'Dev',
  'Parth',
  'Harsh',
  'Meet',
  'Jay',
  'Rudra',
  'Om',
  'Yash',
  'Nisarg',
  'Tirth',
  'Kavan',
  'Darshan',
  'Hetan',
  'Jainam',
  'Mihir',
  'Pranav',
  'Smit',
];
const LAST = [
  'Shah',
  'Mehta',
  'Patel',
  'Trivedi',
  'Desai',
  'Joshi',
  'Bhatt',
  'Pandya',
  'Vyas',
  'Thakkar',
  'Dave',
  'Parikh',
  'Modi',
  'Sheth',
  'Gandhi',
  'Kothari',
  'Vora',
  'Sanghvi',
];
// Share of Students, out of 100, whose first Punch falls in each hour from 05:30.
const HOUR_SHARES = [6, 21, 23, 12, 7, 5, 3, 3, 2, 4, 5, 6, 3];
const dateFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', ...options });
const inWords = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthInWords = dateFormat({ month: 'long', year: 'numeric' });

function exampleStudent(index: number) {
  const room = Math.floor(index / 3);
  const block = 'ABCD'[Math.floor(room / 30)] ?? 'A';
  const roomNumber = (1 + Math.floor((room % 30) / 10)) * 100 + 1 + (room % 10);
  return {
    studentId: String(3000 + index),
    name: `${FIRST[index % FIRST.length] ?? ''} ${LAST[(index * 7) % LAST.length] ?? ''}`,
    room: `${block}-${String(roomNumber)}`,
  };
}

function statusOn(index: number, date: string, today: string): PoojaStatusName {
  const dateNumber = Number(date.replaceAll('-', ''));
  const roll = (index * 37 + dateNumber * 91 + ((index * dateNumber) % 13)) % 100;
  if (roll < 85) return 'Present';
  if (roll >= 88) return 'Not Applicable';
  return date < today ? 'Absent' : 'Needs Review';
}

function datesBetween(from: string, to: string, today: string): string[] {
  const end = Date.parse(`${to < today ? to : today}T00:00:00Z`);
  const dates: string[] = [];
  for (let day = Date.parse(`${from}T00:00:00Z`); day <= end; day += MS_PER_DAY) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}

function rowsFor(dates: string[], today: string): ReportRow[] {
  return Array.from({ length: STUDENTS }, (_, index) => ({
    ...exampleStudent(index),
    statuses: dates.map((date) => statusOn(index, date, today)),
  }));
}

function hourOf(index: number): number {
  let left = (index * 53) % 100;
  const hour = HOUR_SHARES.findIndex((share) => (left -= share) < 0);
  return hour === -1 ? 0 : hour;
}

function hoursOf(rows: ReportRow[]): number[] {
  const hours = HOUR_SHARES.map(() => 0);
  rows.forEach((row, index) => {
    if (row.statuses[0] !== 'Present') return;
    const hour = hourOf(index);
    hours[hour] = (hours[hour] ?? 0) + 1;
  });
  return hours;
}

function totalsOf(rows: ReportRow[], dates: string[]): DayTotals[] {
  return dates.map((date, position) => {
    const count = (status: PoojaStatusName) =>
      rows.filter((row) => row.statuses[position] === status).length;
    return {
      day: Number(date.slice(8)),
      present: count('Present'),
      absent: count('Absent'),
      notApplicable: count('Not Applicable'),
    };
  });
}

function lastDayOf(month: string): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function reportFor(request: ReportRequest, today: string): Report {
  const base = { isExample: true, hours: null, days: null };
  if (request.view === 'Day') {
    const rows = rowsFor([request.day], today);
    const title = inWords.format(new Date(`${request.day}T12:00:00+05:30`)).replace(',', '');
    return { ...base, title, rows, isFinalized: request.day < today, hours: hoursOf(rows) };
  }
  if (request.view === 'Month') {
    const dates = datesBetween(`${request.month}-01`, lastDayOf(request.month), today);
    const rows = rowsFor(dates, today);
    const title = monthInWords.format(new Date(`${request.month}-15T12:00:00+05:30`));
    return { ...base, title, rows, isFinalized: true, days: totalsOf(rows, dates) };
  }
  const rows = rowsFor(datesBetween(request.from, request.to, today), today);
  return { ...base, title: `${request.from} to ${request.to}`, rows, isFinalized: true };
}

export const exampleReportSource = (today: string): ReportSource => ({
  load: (request) => Promise.resolve(reportFor(request, today)),
});
