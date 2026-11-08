import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ReviewStudent } from './review-source.js';

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

// When the Device is quiet, a Punch may still be on it, so going back is the main choice and
// Finalize is the smaller one (FR-8). Escape and the first button both go back.
function Buttons(props: { deviceQuiet: boolean; onFinalize: () => void; onBack: () => void }) {
  const safe = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    safe.current?.focus();
  }, []);
  const finalize = props.deviceQuiet ? (
    <button className="btn-outline-danger min-h-13" type="button" onClick={props.onFinalize}>
      Finalize anyway
    </button>
  ) : (
    <button className="btn min-h-13 px-6" type="button" onClick={props.onFinalize}>
      Yes, Finalize the Day
    </button>
  );
  return (
    <div className="flex flex-wrap-reverse justify-end gap-3 border-t border-line pt-4">
      <button
        ref={safe}
        className={props.deviceQuiet ? 'btn min-h-13 px-6' : 'btn-quiet min-h-13'}
        type="button"
        onClick={props.onBack}
      >
        {props.deviceQuiet ? 'Go back and check the Device' : 'Go back'}
      </button>
      {finalize}
    </div>
  );
}

function QuietDeviceWarning() {
  return (
    <div
      role="alert"
      className="grid gap-1.5 rounded-2xl border-[1.5px] border-warn-line bg-warn-wash px-4 py-3.5 text-warn"
    >
      <p className="font-bold">
        The Device has not been in touch for 10 minutes or more, so Punches may still be on it.
      </p>
      <p>
        If one arrives after you Finalize, that Student stays Absent and is shown as a Punch After
        Finalize. Check that the Device is on and the hostel Wi-Fi works, then wait for it to be
        seen again.
      </p>
    </div>
  );
}

function WhatFinalizeDoes({ names }: { names: readonly ReviewStudent[] }) {
  return (
    <div className="grid gap-2">
      <h3 className="font-bold">What Finalize does</h3>
      {names.length === 0 ? (
        <p>No Student becomes Absent.</p>
      ) : (
        <>
          <p>These {plural(names.length, 'Student')} become Absent:</p>
          <ul aria-label="Students who become Absent" className="flex flex-wrap gap-2">
            {names.map((student) => (
              <li
                key={student.studentId}
                className="rounded-full border border-line bg-wash px-3 py-1 text-[15px]"
              >
                <strong>{student.name}</strong> <span className="text-muted">{student.room}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul className="grid list-disc gap-1 pl-5">
        <li>The Day is locked and cannot be opened again.</li>
        <li>No email goes out yet. You choose who gets one next.</li>
      </ul>
    </div>
  );
}

export function FinalizeConfirm(props: {
  dayWords: string;
  names: readonly ReviewStudent[];
  deviceQuiet: boolean;
  onFinalize: () => void;
  onBack: () => void;
}) {
  const goBackOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') props.onBack();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-overlay px-4 pt-24 pb-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalize-title"
        onKeyDown={goBackOnEscape}
        className="grid w-full max-w-[37.5rem] gap-5 rounded-3xl bg-surface p-7"
      >
        <h2 id="finalize-title" className="font-display text-3xl font-extrabold">
          Finalize {props.dayWords}?
        </h2>
        {props.deviceQuiet && <QuietDeviceWarning />}
        <WhatFinalizeDoes names={props.names} />
        <Buttons
          deviceQuiet={props.deviceQuiet}
          onFinalize={props.onFinalize}
          onBack={props.onBack}
        />
      </section>
    </div>
  );
}
