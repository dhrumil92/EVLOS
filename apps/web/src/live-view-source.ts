export interface LiveViewPunch {
  studentId: string;
  punchedAt: number;
  isCounted: boolean;
}

export interface LiveView {
  day: string;
  studentsPresent: number;
  punches: LiveViewPunch[];
}

export interface LiveViewSource {
  load(): Promise<LiveView>;
  // Calls the listener whenever Punches change. Returns a function that stops listening.
  onChange(listener: () => void): () => void;
}

export const httpLiveViewSource: LiveViewSource = {
  async load() {
    const reply = await fetch('/api/live-view');
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
