import { timeOfDay } from './ist-words.js';
import { busiestSlot, nowShare, slotWords } from './punch-band.js';

const AXIS = ['05:30', '08:00', '10:30', '13:00', '15:30', '18:00'];

function bandSummary(counts: readonly number[], nowAt: string | null) {
  const busiest = busiestSlot(counts);
  const most =
    busiest === null
      ? 'no counted Punch yet.'
      : `most between ${slotWords(busiest).replace(' to ', ' and ')}.`;
  return `When the Students punched: ${most}${nowAt ? ` Now is ${nowAt}.` : ''}`;
}

// One bar for each 15 minutes of the Pooja Window, from how many Students made their first
// counted Punch in it, with a saffron line at Now while the window is open. Drawn the same on
// the Rector's Live view and on the Public Live View.
export function PunchBand(props: { counts: readonly number[]; day: string; now: number }) {
  const { counts } = props;
  const tallest = Math.max(1, ...counts);
  const share = nowShare(props.now, props.day);
  const nowAt = share === null ? null : timeOfDay(props.now);
  return (
    <figure className="m-0 grid min-w-0 flex-[3_1_32rem] gap-2.5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-xl font-bold">When the Punches came in</span>
        <span className="text-sm text-muted">each bar is 15 minutes</span>
      </figcaption>
      <div
        role="img"
        aria-label={bandSummary(counts, nowAt)}
        className="relative flex h-[170px] items-end gap-[2px] border-b-2 border-line-strong"
      >
        {counts.map((count, slot) => (
          <span
            key={slot}
            title={`${slotWords(slot)}: ${String(count)} Students`}
            className={`flex-1 ${count > 0 ? 'rounded-t bg-primary' : 'rounded-sm bg-band-empty'}`}
            style={{ height: count > 0 ? `${String((count / tallest) * 150)}px` : '4px' }}
          />
        ))}
        {share !== null && (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -bottom-0.5 w-0.5 bg-focus"
              style={{ left: `${String(share * 100)}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute -top-2 rounded-md bg-now-wash px-2 py-0.5 text-[13px] font-bold whitespace-nowrap text-now-ink"
              style={{ left: `calc(${String(share * 100)}% + 8px)` }}
            >
              Now {nowAt}
            </span>
          </>
        )}
      </div>
      <div aria-hidden="true" className="flex justify-between text-[13px] text-muted">
        {AXIS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </figure>
  );
}
