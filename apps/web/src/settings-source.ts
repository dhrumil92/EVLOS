import { fetchPage } from './auth-source.js';

// 'done', or the reason the server gave for refusing.
export type SettingsAnswer = 'done' | (string & {});

export interface SettingsSource {
  // The Report Recipients, in the order they were added.
  reportRecipients(): Promise<string[]>;
  addReportRecipient(email: string): Promise<SettingsAnswer>;
  removeReportRecipient(email: string): Promise<SettingsAnswer>;
}

const failure = (reply: Response) => new Error(`The server answered ${String(reply.status)}`);

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
};
