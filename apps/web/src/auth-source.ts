export type LogInAnswer = 'logged-in' | 'refused' | 'too-many';

export interface AuthSource {
  // The logged-in Rector's email, or null when nobody is logged in.
  me(): Promise<string | null>;
  logIn(email: string, password: string): Promise<LogInAnswer>;
  logOut(): Promise<void>;
}

// Announced when the server says the session is over, so the page shows the login again.
export const SESSION_ENDED = 'evlos:session-ended';

export function endSession(): void {
  window.dispatchEvent(new Event(SESSION_ENDED));
}

// fetch for every page API call. The browser sends the session cookie by itself.
export async function fetchPage(url: string, init?: RequestInit): Promise<Response> {
  const reply = await fetch(url, init);
  if (reply.status === 401) {
    endSession();
    throw new Error('The session has ended. Log in again.');
  }
  return reply;
}

const LOG_IN_ANSWERS: Record<number, LogInAnswer> = {
  204: 'logged-in',
  401: 'refused',
  429: 'too-many',
};

export const httpAuthSource: AuthSource = {
  async me() {
    const reply = await fetch('/api/me');
    if (reply.status === 401) return null;
    if (!reply.ok) throw new Error(`The server answered ${String(reply.status)}`);
    return ((await reply.json()) as { email: string }).email;
  },
  async logIn(email, password) {
    const reply = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const answer = LOG_IN_ANSWERS[reply.status];
    if (answer === undefined) throw new Error(`The server answered ${String(reply.status)}`);
    return answer;
  },
  async logOut() {
    await fetch('/api/logout', { method: 'POST' });
  },
};
