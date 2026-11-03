import { fetchPage } from './auth-source.js';

export interface Student {
  studentId: string;
  name: string;
  room: string;
  email: string;
  phone: string | null;
}

export type LeaveState = 'In hostel' | 'Away' | 'Due Back';

// The server works out the floor and the Leave state, so each rule lives in one place.
export type ListedStudent = Student & {
  isActive: boolean;
  floor: number;
  leaveState: LeaveState;
  openLeave: { outAt: number; expectedReturnAt: number } | null;
};

// Dates as YYYY-MM-DD and times as HH:MM, in IST, as written in the books.
export interface LeaveForm {
  outDay: string;
  outTime: string;
  expectedReturnDay: string;
  expectedReturnTime: string;
}

export interface ReturnForm {
  returnDay: string;
  returnTime: string;
}

// 'done', or the reason the server gave for refusing.
export type LeaveAnswer = 'done' | (string & {});

export type ManyLeaveRow = LeaveForm & { studentId: string };
export type ManyReturnRow = ReturnForm & { studentId: string };
// The server's answer for one row of a many-Students request.
export interface RowAnswer {
  studentId: string;
  outcome: 'done' | 'refused';
  reason?: string;
}

export interface StudentForm {
  studentId: string;
  name: string;
  room: string;
  email: string;
  phone: string;
}

// What the Rector may edit after adding a Student. The Student ID never changes.
export type StudentDetails = Omit<StudentForm, 'studentId'>;

export type AddResult =
  | { outcome: 'added'; student: Student }
  | { outcome: 'invalid'; fields: string[] }
  | { outcome: 'student-id-used' };

export type EditResult =
  | { outcome: 'edited'; student: Student }
  | { outcome: 'invalid'; fields: string[] }
  | { outcome: 'unknown-student' };

export interface StudentSource {
  list(): Promise<ListedStudent[]>;
  add(form: StudentForm): Promise<AddResult>;
  edit(studentId: string, details: StudentDetails): Promise<EditResult>;
  // Both throw when the server refuses, for example when he is already Deactivated.
  deactivate(studentId: string): Promise<void>;
  activate(studentId: string): Promise<void>;
  recordLeave(studentId: string, form: LeaveForm): Promise<LeaveAnswer>;
  editLeave(studentId: string, form: LeaveForm): Promise<LeaveAnswer>;
  cancelLeave(studentId: string): Promise<LeaveAnswer>;
  returnLeave(studentId: string, form: ReturnForm): Promise<LeaveAnswer>;
  recordLeaves(rows: ManyLeaveRow[]): Promise<RowAnswer[]>;
  returnLeaves(rows: ManyReturnRow[]): Promise<RowAnswer[]>;
}

const failure = (reply: Response) => new Error(`The server answered ${String(reply.status)}`);

async function send(method: 'POST' | 'PUT', url: string, body: object): Promise<Response> {
  return fetchPage(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function invalidFrom(reply: Response) {
  const { invalidFields } = (await reply.json()) as { invalidFields: string[] };
  return { outcome: 'invalid' as const, fields: invalidFields };
}

async function changeActive(studentId: string, action: 'deactivate' | 'activate') {
  const reply = await send('POST', `/api/students/${encodeURIComponent(studentId)}/${action}`, {});
  if (reply.status !== 204) {
    throw failure(reply);
  }
}

const studentUrl = (studentId: string) => `/api/students/${encodeURIComponent(studentId)}`;

// 204 is done; a refusal names its reason; anything else is a fault.
async function leaveAnswer(method: 'POST' | 'PUT', url: string, body: object) {
  const reply = await send(method, url, body);
  if (reply.status === 204) return 'done';
  if (reply.status >= 500) throw failure(reply);
  return ((await reply.json()) as { reason: string }).reason;
}

async function rowAnswers(url: string, rows: object[]): Promise<RowAnswer[]> {
  const reply = await send('POST', url, { rows });
  if (!reply.ok) throw failure(reply);
  return ((await reply.json()) as { results: RowAnswer[] }).results;
}

export const httpStudentSource: StudentSource = {
  async list() {
    const reply = await fetchPage('/api/students');
    if (!reply.ok) {
      throw failure(reply);
    }
    return (await reply.json()) as ListedStudent[];
  },
  async add(form) {
    const reply = await send('POST', '/api/students', form);
    if (reply.status === 201) {
      return { outcome: 'added', student: (await reply.json()) as Student };
    }
    if (reply.status === 409) {
      return { outcome: 'student-id-used' };
    }
    if (reply.status === 400) {
      return invalidFrom(reply);
    }
    throw failure(reply);
  },
  async edit(studentId, details) {
    const reply = await send('PUT', studentUrl(studentId), details);
    if (reply.status === 200) {
      return { outcome: 'edited', student: (await reply.json()) as Student };
    }
    if (reply.status === 404) {
      return { outcome: 'unknown-student' };
    }
    if (reply.status === 400) {
      return invalidFrom(reply);
    }
    throw failure(reply);
  },
  deactivate: (studentId) => changeActive(studentId, 'deactivate'),
  activate: (studentId) => changeActive(studentId, 'activate'),
  recordLeave: (studentId, form) => leaveAnswer('POST', `${studentUrl(studentId)}/leave`, form),
  editLeave: (studentId, form) => leaveAnswer('PUT', `${studentUrl(studentId)}/leave`, form),
  cancelLeave: (studentId) => leaveAnswer('POST', `${studentUrl(studentId)}/leave/cancel`, {}),
  returnLeave: (studentId, form) => leaveAnswer('POST', `${studentUrl(studentId)}/return`, form),
  recordLeaves: (rows) => rowAnswers('/api/leaves/many', rows),
  returnLeaves: (rows) => rowAnswers('/api/returns/many', rows),
};
