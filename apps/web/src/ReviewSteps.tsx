import type { Review } from './review-source.js';

type StepState = 'done' | 'now' | 'later';

const STEPS = [
  { title: 'Review', note: 'Check the Needs Review list' },
  { title: 'Finalize', note: 'Lock the Day' },
  { title: 'Exclude if needed', note: 'Remove a name from the email' },
  { title: 'Send Notifications', note: 'Email the Absent Students' },
] as const;

// Where the Day is: before Finalize the Rector reviews; after it, Exclude and Send are left
// while an Absent Student is still waiting for a decision.
function stepStates(review: Review): StepState[] {
  if (review.finalization === null) return ['now', 'later', 'later', 'later'];
  const waiting = review.absent.some((one) => one.notification === null && !one.isExcluded);
  return waiting ? ['done', 'done', 'now', 'later'] : ['done', 'done', 'done', 'done'];
}

const BOX: Record<StepState, string> = {
  now: 'border-primary bg-surface',
  done: 'border-line',
  later: 'border-line',
};
const DOT: Record<StepState, string> = {
  now: 'bg-primary text-white',
  done: 'bg-present-wash text-present-ink',
  later: 'border-[1.5px] border-line-strong bg-surface text-muted',
};

export function ReviewSteps({ review }: { review: Review }) {
  const states = stepStates(review);
  return (
    <ol aria-label="Steps for this Day" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, index) => {
        const state = states[index] ?? 'later';
        return (
          <li
            key={step.title}
            aria-current={state === 'now' ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 ${BOX[state]}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-full font-bold ${DOT[state]}`}
            >
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className="grid">
              <span className="font-bold">{step.title}</span>
              <span className="text-sm text-muted">{state === 'done' ? 'Done' : step.note}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
