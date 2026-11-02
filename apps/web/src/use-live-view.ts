import { useEffect, useRef, useState } from 'react';
import type { LiveView, LiveViewPunch, LiveViewSource } from './live-view-source.js';

export const punchKey = (punch: LiveViewPunch) => `${punch.studentId}-${String(punch.punchedAt)}`;

export interface LiveViewState {
  view: LiveView | null;
  failed: boolean;
  // The Punch that has just arrived, so the page can mark it.
  newestKey: string | null;
}

export function useLiveView(source: LiveViewSource): LiveViewState {
  const [state, setState] = useState<LiveViewState>({ view: null, failed: false, newestKey: null });
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    let open = true;
    const refresh = async () => {
      try {
        const view = await source.load();
        if (!open) return;
        const previous = lastCount.current;
        lastCount.current = view.punches.length;
        const newest = view.punches[0];
        const arrived = previous !== null && view.punches.length > previous;
        setState((old) => ({
          view,
          failed: false,
          newestKey: arrived && newest ? punchKey(newest) : old.newestKey,
        }));
      } catch {
        if (open) setState((old) => ({ ...old, failed: true }));
      }
    };
    void refresh();
    const stop = source.onChange(() => void refresh());
    return () => {
      open = false;
      stop();
    };
  }, [source]);

  return state;
}
