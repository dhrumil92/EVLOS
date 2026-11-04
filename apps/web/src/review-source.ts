import { fetchPage } from './auth-source.js';

export interface ReviewStudent {
  studentId: string;
  name: string;
  room: string;
}

// queued: waiting to be sent. sent: the email has gone. failed: it was given up.
export type NotificationState = 'queued' | 'sent' | 'failed';

export interface Review {
  day: string;
  canFinalize: boolean;
  finalization: { finalizedBy: string; finalizedAt: number } | null;
  needsReview: ReviewStudent[];
  absent: (ReviewStudent & { isExcluded: boolean; notification: NotificationState | null })[];
  notFinalizedDays: string[];
}

// The server's answer, or the reason it refused, such as 'already-finalized'.
export type FinalizeAnswer = { outcome: 'finalized'; absent: number } | { reason: string };
export type SendAnswer = { outcome: 'queued'; queued: number } | { reason: string };

export interface ReviewSource {
  load(day: string): Promise<Review>;
  finalize(day: string): Promise<FinalizeAnswer>;
  send(day: string, excludedStudentIds: string[]): Promise<SendAnswer>;
}

async function post<T>(url: string, body: object): Promise<T> {
  const reply = await fetchPage(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (reply.status >= 500) throw new Error(`The server answered ${String(reply.status)}`);
  return (await reply.json()) as T;
}

export const httpReviewSource: ReviewSource = {
  async load(day) {
    const reply = await fetchPage(`/api/review?day=${encodeURIComponent(day)}`);
    if (!reply.ok) throw new Error(`The server answered ${String(reply.status)}`);
    return (await reply.json()) as Review;
  },
  finalize: (day) => post('/api/review/finalize', { day }),
  send: (day, excludedStudentIds) => post('/api/review/send', { day, excludedStudentIds }),
};
