import { useCallback, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { SettingsSource } from './settings-source.js';

const NO_ONE =
  'No one will receive the Review Reminder, Daily Report or Monthly Report. Add an address below.';
const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';

// The three emails the Report Recipients get, and when.
const EMAILS = [
  {
    name: 'Review Reminder',
    when: 'At 23:00',
    what: 'Only on a night the Day is not Finalized and someone Needs Review.',
  },
  {
    name: 'Daily Report',
    when: 'At 23:30, every night',
    what: 'Whether or not the Day is Finalized.',
  },
  {
    name: 'Monthly Report',
    when: 'At 09:00 on the 1st',
    what: 'Every Student, every Day of the month.',
  },
];

function Row(props: {
  email: string;
  isAsking: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { email } = props;
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 first:border-t-0 ${props.isAsking ? 'bg-danger-wash' : ''}`}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-tint font-bold text-primary"
      >
        {email.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-[1_1_14rem] [overflow-wrap:anywhere]">
        <strong>{email}</strong>
        {props.isAsking && (
          <span className="block text-sm font-bold text-danger">
            Stop sending the reports to this address?
          </span>
        )}
      </span>
      {props.isAsking ? (
        <span className="flex gap-2">
          <button type="button" className="btn-quiet" onClick={props.onKeep}>
            Keep
          </button>
          <button type="button" className="btn btn-danger" onClick={props.onRemove}>
            Yes, remove
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="min-h-11 px-3 font-bold text-danger hover:underline"
          aria-label={`Remove ${email}`}
          onClick={props.onAsk}
        >
          Remove
        </button>
      )}
    </li>
  );
}

function RecipientList(props: { emails: string[]; onRemove: (email: string) => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const { emails } = props;
  return (
    <div className="grid gap-2">
      <h3 className="text-lg font-bold">
        Sent to {emails.length} {emails.length === 1 ? 'address' : 'addresses'}
      </h3>
      <ul aria-label="Report Recipients" className="overflow-hidden rounded-2xl border border-line">
        {emails.map((email) => (
          <Row
            key={email}
            email={email}
            isAsking={asking === email}
            onAsk={() => {
              setAsking(email);
            }}
            onKeep={() => {
              setAsking(null);
            }}
            onRemove={() => {
              setAsking(null);
              props.onRemove(email);
            }}
          />
        ))}
      </ul>
    </div>
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
    <form className="grid gap-1.5" noValidate onSubmit={submit}>
      <label htmlFor="new-recipient" className="font-bold">
        Add an address
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="new-recipient"
          className="field min-h-12 flex-[1_1_18rem]"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          aria-describedby="new-recipient-help"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <button className="btn min-h-12 px-6" type="submit">
          Add
        </button>
      </div>
      <span id="new-recipient-help" className="text-sm text-muted">
        Your own address, or anyone who should see the reports. If the list is empty, nobody gets
        them.
      </span>
    </form>
  );
}

// The Report Recipients receive the Review Reminder, Daily Report and Monthly Report.
export function RecipientsCard({ source }: { source: SettingsSource }) {
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
    <section className="report-card grid gap-5 p-6" aria-label="Report Recipients">
      <div>
        <h2 className="font-display text-[1.65rem] font-bold">Report Recipients</h2>
        <p className="max-w-[68ch] text-muted">
          Every address here gets the three emails below. Students never get these; they only get a
          Notification when you Send Notifications.
        </p>
      </div>
      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
        {EMAILS.map((one) => (
          <li key={one.name} className="rounded-2xl border border-line bg-wash px-4 py-3">
            <span className="block font-bold">{one.name}</span>
            <span className="block text-sm text-muted">{one.when}</span>
            <span className="block text-sm text-muted">{one.what}</span>
          </li>
        ))}
      </ul>
      {failed && <p className="notice">The Report Recipients could not load. Reload the page.</p>}
      {emails?.length === 0 && (
        <p className="notice" role="status">
          {NO_ONE}
        </p>
      )}
      {emails !== null && emails.length > 0 && (
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
  );
}
