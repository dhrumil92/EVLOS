import type { StudentForm } from '@evlos/core';
import type { RosterRow } from '../../use-cases/load-roster.js';

export interface Roster {
  rows: RosterRow[];
  // Why the file cannot be read at all, or null.
  problem: string | null;
}

interface Record {
  line: number;
  cells: string[];
}

const COLUMNS: { field: keyof StudentForm; header: string; isRequired: boolean }[] = [
  { field: 'studentId', header: 'Student ID', isRequired: true },
  { field: 'name', header: 'Name', isRequired: true },
  { field: 'room', header: 'Room', isRequired: true },
  { field: 'email', header: 'Email', isRequired: true },
  { field: 'phone', header: 'Phone', isRequired: false },
];

// Reads CSV by hand: commas split cells, a cell in double quotes may hold commas and line
// breaks, and "" inside quotes is one ". Small enough to explain, so no library is needed.
class CsvReader {
  private records: Record[] = [];
  private cells: string[] = [];
  private cell = '';
  private isQuoted = false;
  private line = 1;
  private recordLine = 1;

  read(text: string): Record[] {
    for (let at = 0; at < text.length; at++) {
      at = this.take(text, at);
    }
    this.endRecord();
    return this.records.filter((record) => record.cells.some((cell) => cell.trim() !== ''));
  }

  // Handles the character at `at` and returns the last position it used.
  private take(text: string, at: number): number {
    const char = text.charAt(at);
    if (this.isQuoted) return this.takeQuoted(text, at);
    if (char === '"') this.isQuoted = true;
    else if (char === ',') this.endCell();
    else if (char === '\n') this.endRecord();
    else if (char !== '\r') this.cell += char;
    return at;
  }

  private takeQuoted(text: string, at: number): number {
    const char = text.charAt(at);
    if (char === '"' && text.charAt(at + 1) === '"') {
      this.cell += '"';
      return at + 1;
    }
    if (char === '"') this.isQuoted = false;
    else {
      if (char === '\n') this.line++;
      this.cell += char;
    }
    return at;
  }

  private endCell() {
    this.cells.push(this.cell);
    this.cell = '';
  }

  private endRecord() {
    this.endCell();
    this.records.push({ line: this.recordLine, cells: this.cells });
    this.cells = [];
    this.line++;
    this.recordLine = this.line;
  }
}

// The invisible mark Excel puts at the start of a "CSV UTF-8" file.
export const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const normal = (header: string) => header.trim().toLowerCase();

// Reads the Rector's list, saved from Excel as "CSV UTF-8", into Add a Student forms.
export function readRoster(text: string): Roster {
  const [header, ...records] = new CsvReader().read(
    text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text,
  );
  if (header === undefined) return { rows: [], problem: 'The file is empty.' };

  const headers = header.cells.map(normal);
  const missing = COLUMNS.filter((c) => c.isRequired && !headers.includes(normal(c.header)));
  if (missing.length > 0) {
    const names = missing.map((column) => column.header).join(', ');
    return { rows: [], problem: `The header row is missing these columns: ${names}.` };
  }

  const rows = records.map((record) => {
    const cellOf = (column: (typeof COLUMNS)[number]) =>
      record.cells[headers.indexOf(normal(column.header))] ?? '';
    const form = Object.fromEntries(COLUMNS.map((c) => [c.field, cellOf(c)])) as StudentForm;
    return { line: record.line, form };
  });
  return { rows, problem: null };
}
