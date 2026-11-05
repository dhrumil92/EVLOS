import { fetchPage } from './auth-source.js';

// 'done', or the reason the server gave for refusing.
export type SettingsAnswer = 'done' | (string & {});

export interface SettingsSource {
  // The Report Recipients, in the order they were added.
  reportRecipients(): Promise<string[]>;
  addReportRecipient(email: string): Promise<SettingsAnswer>;
  removeReportRecipient(email: string): Promise<SettingsAnswer>;
  changePassword(currentPassword: string, newPassword: string): Promise<SettingsAnswer>;
}

const failure = (reply: Response) => new Error(`The server answered ${String(reply.status)}`);
// The server allows five password tries in 15 minutes.
const TOO_MANY_TRIES = 'Too many tries. Wait 15 minutes, then try again.';

// A 2xx answer is done; a refusal gives its message; a server fault is thrown.
async function answerOf(reply: Response): Promise<SettingsAnswer> {
  if (reply.ok) return 'done';
  if (reply.status >= 500) throw failure(reply);
  return ((await reply.json()) as { message: string }).message;
}

export const httpSettingsSource: SettingsSource = {
  async reportRecipients() {
    const reply = await fetchPage('/api/report-recipients');
    if (!reply.ok) throw failure(reply);
    return (await reply.json()) as string[];
  },
  async addReportRecipient(email) {
    return answerOf(
      await fetchPage('/api/report-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }),
    );
  },
  async removeReportRecipient(email) {
    return answerOf(
      await fetchPage(`/api/report-recipients/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      }),
    );
  },
  async changePassword(currentPassword, newPassword) {
    const reply = await fetchPage('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (reply.status === 429) return TOO_MANY_TRIES;
    return answerOf(reply);
  },
};
