import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// A button that opens a small panel under it. It closes on Escape and on a press outside.
export function PopoverMenu(props: {
  name: string;
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => {
      document.removeEventListener('mousedown', away);
    };
  }, [isOpen]);
  return (
    <div
      ref={box}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className="btn-quiet flex min-h-12 items-center gap-2"
        aria-expanded={isOpen}
        onClick={() => {
          setOpen((old) => !old);
        }}
      >
        {props.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="group"
          aria-label={props.name}
          className="absolute right-0 z-20 mt-2 grid min-w-60 gap-1.5 rounded-2xl border-[1.5px] border-line-strong bg-surface p-3"
        >
          {props.children(() => {
            setOpen(false);
          })}
        </div>
      )}
    </div>
  );
}
