import { useEffect, useState } from 'react';
import { dayInWords, timeOfDay } from './ist-words.js';
import type { PublicLiveSource, PublicLiveView } from './public-live-source.js';
import { PunchBand } from './PunchBand.js';

const EVERY_30_SECONDS = 30 * 1000;

// Asks for the numbers now and then every refreshMs. A failed ask keeps the last numbers.
function usePublicLive(source: PublicLiveSource, refreshMs: number) {
  const [view, setView] = useState<PublicLiveView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let open = true;
    const ask = () => {
      source.load().then(
        (answer) => {
          if (!open) return;
          setView(answer);
          setFailed(false);
        },
        () => {
          if (open) setFailed(true);
        },
      );
    };
    ask();
    const timer = setInterval(ask, refreshMs);
    return () => {
      open = false;
      clearInterval(timer);
    };
  }, [source, refreshMs]);
  return { view, failed };
}

// Search engines are asked not to list this page.
function useNoIndex() {
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.append(tag);
    return () => {
      tag.remove();
    };
  }, []);
}

function Count({ view }: { view: PublicLiveView }) {
  return (
    <p
      role="status"
      aria-label="Pooja so far"
      className="m-0 flex-[1_1_14rem] self-center text-2xl text-muted"
    >
      <span className="font-display text-[5.5rem] leading-none font-extrabold text-primary">
        {view.present}
      </span>{' '}
      of {view.expected} have done Pooja
    </p>
  );
}

// The Public Live View (FR-17): anyone may open /live with no login. It shows only how many of
// the Students expected at Pooja today have done it, and when they punched. Never a name.
export function PublicLiveViewPage(props: {
  source: PublicLiveSource;
  refreshMs?: number;
  now?: () => number;
}) {
  const { view, failed } = usePublicLive(props.source, props.refreshMs ?? EVERY_30_SECONDS);
  useNoIndex();
  const now = (props.now ?? Date.now)();
  return (
    <div className="screen">
      <main className="gutter mx-auto grid max-w-[64rem] gap-5 pt-8">
        <span className="font-display text-2xl font-extrabold tracking-tight text-primary lowercase">
          EVLOS
        </span>
        <div>
          <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
            {view ? dayInWords(view.day) : "Today's Pooja"}
          </h1>
          <p className="text-muted">Pooja Window 05:30 to 18:00.</p>
        </div>
        {view === null && failed && (
          <p className="notice">
            This page cannot reach EVLOS right now. It tries again every 30 seconds.
          </p>
        )}
        {view && (
          <>
            <section className="report-card flex flex-wrap items-center gap-x-10 gap-y-6 p-7">
              <Count view={view} />
              <PunchBand counts={view.slots} day={view.day} now={now} />
            </section>
            <p className="text-sm text-muted">
              <span>Updated at {timeOfDay(view.updatedAt)}</span>
              {failed && <span> Could not refresh. Trying again in 30 seconds.</span>}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
