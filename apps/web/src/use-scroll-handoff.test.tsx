// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollHandoff } from './use-scroll-handoff.js';

function List() {
  const handoff = useScrollHandoff();
  return <div ref={handoff} data-testid="list" />;
}

// jsdom has no layout, so the list is given a height, a scroll height and a place.
function listAt(scrollTop: number) {
  const view = render(<List />);
  const list = view.getByTestId('list');
  Object.defineProperty(list, 'clientHeight', { value: 100, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 500, configurable: true });
  Object.defineProperty(list, 'scrollTop', { value: scrollTop, configurable: true });
  return { list, view };
}

const wheel = (list: HTMLElement, deltaY: number, deltaMode = 0) => {
  const event = new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true });
  list.dispatchEvent(event);
  return event;
};

const scrollBy = vi.fn();

beforeEach(() => {
  scrollBy.mockClear();
  window.scrollBy = scrollBy as typeof window.scrollBy;
});
afterEach(cleanup);

describe('a list that scrolls inside its card', () => {
  it('scrolls the page when the wheel goes down at the bottom of the list', () => {
    const { list } = listAt(400);

    const event = wheel(list, 60);

    expect(scrollBy).toHaveBeenCalledWith(0, 60);
    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls the page when the wheel goes up at the top of the list', () => {
    const { list } = listAt(0);

    const event = wheel(list, -60);

    expect(scrollBy).toHaveBeenCalledWith(0, -60);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the wheel to the list in the middle', () => {
    const { list } = listAt(150);

    const down = wheel(list, 60);
    const up = wheel(list, -60);

    expect(scrollBy).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
    expect(up.defaultPrevented).toBe(false);
  });

  it('keeps scrolling the list when it can still go on in that direction', () => {
    const atTop = listAt(0);
    wheel(atTop.list, 60);
    cleanup();
    const atBottom = listAt(400);
    wheel(atBottom.list, -60);

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('treats a wheel that counts lines, as in Firefox, as sixteen pixels a line', () => {
    const { list } = listAt(400);

    wheel(list, 3, 1);

    expect(scrollBy).toHaveBeenCalledWith(0, 48);
  });

  it('stops handing over the wheel once it is taken off the page', () => {
    const { list, view } = listAt(400);

    view.unmount();
    wheel(list, 60);

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
