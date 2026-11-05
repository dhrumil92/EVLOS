export type LogInAnswer = 'logged-in' | 'refused' | 'too-many';

export interface AuthSource {
  // The logged-in Rector's email, or null when nobody is logged in.
  me(): Promise<string | null>;
  logIn(email: string, password: string): Promise<LogInAnswer>;
  logOut(): Promise<void>;
  // Asks for a link by email to set a new password. The answer never says whether the email
  // has an account.
  requestPasswordReset(email: string): Promise<'sent' | 'too-many'>;
  // 'done', or the reason the link could not be used.
  resetPassword(token: string, newPassword: string): Promise<'done' | (string & {})>;
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

// The server allows five tries in 15 minutes.
const TOO_MANY_TRIES = 'Too many tries. Wait 15 minutes, then try again.';

const postJson = (url: string, body: object) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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
  async requestPasswordReset(email) {
    const reply = await postJson('/api/forgot-password', { email });
    if (reply.status === 429) return 'too-many';
    if (!reply.ok) throw new Error(`The server answered ${String(reply.status)}`);
    return 'sent';
  },
  async resetPassword(token, newPassword) {
    const reply = await postJson('/api/reset-password', { token, newPassword });
    if (reply.ok) return 'done';
    if (reply.status === 429) return TOO_MANY_TRIES;
    if (reply.status >= 500) throw new Error(`The server answered ${String(reply.status)}`);
    return ((await reply.json()) as { message: string }).message;
  },
};
