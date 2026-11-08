import { useId, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { NewPasswordField, PasswordAgain } from './PasswordFields.js';
import type { SettingsSource } from './settings-source.js';

const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';
const EMPTY: [string, string, string] = ['', '', ''];

// The logged-in Rector changes the password. The new one is typed twice, and the two are
// compared as they are typed and again here, so a typing slip never becomes the password.
export function PasswordCard({ source }: { source: SettingsSource }) {
  const currentId = useId();
  const [typed, setTyped] = useState(EMPTY);
  const [answer, setAnswer] = useState<{ done: boolean; text: string } | null>(null);
  const [current, first, again] = typed;
  const set = (index: number, value: string) => {
    setTyped((old) => old.map((one, at) => (at === index ? value : one)) as typeof EMPTY);
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (first !== again) {
      setAnswer({ done: false, text: 'The two new passwords are not the same.' });
      return;
    }
    const reply = await source.changePassword(current, first).catch(() => SERVER_FAILED);
    if (reply === 'done') setTyped(EMPTY);
    setAnswer(
      reply === 'done'
        ? { done: true, text: 'Password changed. Every other login has been ended.' }
        : { done: false, text: reply },
    );
  };

  return (
    <section className="report-card flex flex-wrap gap-x-10 gap-y-5 p-6" aria-label="Your password">
      <div className="flex-[1_1_15rem]">
        <h2 className="font-display text-[1.65rem] font-bold">Your password</h2>
        <p className="text-muted">
          Use at least 12 characters. A short sentence you can remember works well.
        </p>
        <p className="mt-3 text-muted">
          After you change it, every other login, on a phone or another computer, is ended. This one
          stays open.
        </p>
      </div>
      <form
        className="grid flex-[2_1_24rem] gap-4"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid gap-1.5">
          <label htmlFor={currentId} className="font-bold">
            Current password
          </label>
          <input
            id={currentId}
            className="field min-h-12"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => {
              set(0, event.target.value);
            }}
          />
        </div>
        <NewPasswordField
          value={first}
          onChange={(value) => {
            set(1, value);
          }}
        />
        <PasswordAgain
          first={first}
          value={again}
          onChange={(value) => {
            set(2, value);
          }}
        />
        <button className="btn min-h-13 justify-self-start px-7 text-[1.05rem]" type="submit">
          Change password
        </button>
        {answer && (
          <p
            className={answer.done ? 'notice' : 'field-error'}
            role={answer.done ? 'status' : 'alert'}
          >
            {answer.text}
          </p>
        )}
      </form>
    </section>
  );
}
