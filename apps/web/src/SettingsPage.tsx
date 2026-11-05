import { useCallback, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Confirm } from './ReviewPage.js';
import type { SettingsSource } from './settings-source.js';

const NO_ONE =
  'No one will receive the Review Reminder, Daily Report or Monthly Report. Add an address below.';
const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';

function RecipientList(props: { emails: string[]; onRemove: (email: string) => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  return (
    <ul aria-label="Report Recipients" className="grid gap-2">
      {props.emails.map((email) => (
        <li key={email} className="grid gap-2 border-t border-line pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">{email}</span>
            <button
              type="button"
              className="btn-quiet"
              aria-label={`Remove ${email}`}
              onClick={() => {
                setAsking(email);
              }}
            >
              Remove
            </button>
          </div>
          {asking === email && (
            <Confirm
              question={`Remove ${email}? It will no longer receive the Report emails.`}
              yes="Yes, remove"
              onYes={() => {
                setAsking(null);
                props.onRemove(email);
              }}
              onNo={() => {
                setAsking(null);
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function AddForm(props: { onAdd: (email: string) => Promise<boolean> }) {
  const [email, setEmail] = useState('');
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    void props.onAdd(email).then((added) => {
      if (added) setEmail('');
    });
  };
  // noValidate: the server checks the address, so every refusal reads the same way.
  return (
    <form className="flex flex-wrap items-end gap-3" noValidate onSubmit={submit}>
      <label className="grid gap-1 text-mist">
        Email address
        <input
          className="field"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <button className="btn" type="submit">
        Add
      </button>
    </form>
  );
}

// The Rector's settings. The Report Recipients receive the Review Reminder, Daily Report and
// Monthly Report.
export function SettingsPage({ source }: { source: SettingsSource }) {
  const [emails, setEmails] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    source.reportRecipients().then(setEmails, () => {
      setFailed(true);
    });
  }, [source]);
  useEffect(load, [load]);

  // Shows the server's reason, or reloads the list once the change is saved.
  const act = async (change: Promise<string>) => {
    const answer = await change.catch(() => SERVER_FAILED);
    setMessage(answer === 'done' ? null : answer);
    if (answer === 'done') load();
    return answer === 'done';
  };

  return (
    <div className="grid gap-5">
      <h1 className="font-display text-[2.5rem] leading-tight font-bold text-gold">Settings</h1>
      <section className="report-card grid gap-4" aria-label="Report Recipients">
        <div>
          <h2 className="font-display text-2xl font-semibold">Report Recipients</h2>
          <p className="text-mist">
            These addresses receive the Review Reminder (23:00), the Daily Report (23:30) and the
            Monthly Report (09:00 on the 1st).
          </p>
        </div>
        {failed && <p className="notice">The Report Recipients could not load. Reload the page.</p>}
        {emails?.length === 0 && (
          <p className="notice" role="status">
            {NO_ONE}
          </p>
        )}
        {emails && (
          <RecipientList
            emails={emails}
            onRemove={(email) => void act(source.removeReportRecipient(email))}
          />
        )}
        <AddForm onAdd={(email) => act(source.addReportRecipient(email))} />
        {message && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
