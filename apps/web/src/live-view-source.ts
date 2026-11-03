import { fetchPage } from './auth-source.js';

export type NotCountedBecause = 'unknown-student' | 'not-active' | 'outside-pooja-window';

export interface LiveViewPunch {
  studentId: string;
  // Null for a Student ID that belongs to no Student.
  name: string | null;
  punchedAt: number;
  isCounted: boolean;
  notCountedBecause: NotCountedBecause | null;
}

export interface LiveView {
  day: string;
  studentsPresent: number;
  activeStudents: number;
  punches: LiveViewPunch[];
}

export interface LiveViewSource {
  load(): Promise<LiveView>;
  // Calls the listener whenever Punches change. Returns a function that stops listening.
  onChange(listener: () => void): () => void;
}

export const httpLiveViewSource: LiveViewSource = {
  async load() {
    const reply = await fetchPage('/api/live-view');
    if (!reply.ok) {
      throw new Error(`The server answered ${String(reply.status)}`);
    }
    return (await reply.json()) as LiveView;
  },
  onChange(listener) {
    const events = new EventSource('/api/live-view/events');
    events.onmessage = listener;
    // Also fires after a reconnect, so Punches missed while disconnected appear.
    events.onopen = listener;
    return () => {
      events.close();
    };
  },
};
