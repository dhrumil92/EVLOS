import { useCallback, useRef } from 'react';

// A list that scrolls inside its card hands the wheel to the page at its top and its bottom, so
// the Rector keeps scrolling the page without stopping first. Browsers hold the wheel on the
// list until the Rector pauses, so this passes it on by hand. Use the result as the `ref`.
export function useScrollHandoff() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((list: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (list === null) return;
    const onWheel = (event: WheelEvent) => {
      // A wheel that counts lines, as in Firefox, is turned into pixels.
      const by = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const atTop = list.scrollTop <= 0;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if ((by < 0 && atTop) || (by > 0 && atBottom)) {
        window.scrollBy(0, by);
        event.preventDefault();
      }
    };
    // Not passive: the list must be allowed to cancel its own scroll.
    list.addEventListener('wheel', onWheel, { passive: false });
    stop.current = () => {
      list.removeEventListener('wheel', onWheel);
    };
  }, []);
}
