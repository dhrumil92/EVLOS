import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GROUPS, groupCounts, SORTS } from './student-list.js';
import type { ListChoices, StudentSort } from './student-list.js';
import type { ListedStudent } from './student-source.js';

// A button that opens a small panel under it. It closes on Escape and on a press outside.
function Menu(props: { name: string; label: string; children: (close: () => void) => ReactNode }) {
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

// One button for the five filters: Active, in hostel, Away, Due Back and Deactivated.
function FilterMenu(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  const counts = groupCounts(props.students);
  return (
    <Menu name="Filter" label={`Filter: ${props.choices.group}`}>
      {(close) =>
        GROUPS.map((group) => {
          const isOn = group === props.choices.group;
          return (
            <button
              key={group}
              type="button"
              aria-pressed={isOn}
              onClick={() => {
                props.onChoices({ group });
                close();
              }}
              className={`flex min-h-11 items-center justify-between gap-6 rounded-xl px-3 text-left font-bold ${isOn ? 'bg-primary text-white' : 'hover:bg-tint'}`}
            >
              {group}{' '}
              <span className={`font-normal ${isOn ? 'text-on-primary-muted' : 'text-muted'}`}>
                {counts[group]}
              </span>
            </button>
          );
        })
      }
    </Menu>
  );
}

// One button for the floor and the sort order.
function SortMenu(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  const { choices } = props;
  const floors = [...new Set(props.students.map((s) => s.floor))].sort((a, b) => a - b);
  return (
    <Menu name="Floor and sort" label="Floor and sort">
      {() => (
        <>
          <label className="grid gap-1 text-sm font-bold text-muted">
            Floor
            <select
              className="field font-normal"
              value={choices.floor === null ? '' : String(choices.floor)}
              onChange={(event) => {
                props.onChoices({
                  floor: event.target.value === '' ? null : Number(event.target.value),
                });
              }}
            >
              <option value="">All floors</option>
              {floors.map((floor) => (
                <option key={floor} value={String(floor)}>
                  Floor {floor}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-muted">
            Sort by
            <select
              className="field font-normal"
              value={choices.sort}
              onChange={(event) => {
                props.onChoices({ sort: event.target.value as StudentSort });
              }}
            >
              {SORTS.map((sort) => (
                <option key={sort}>{sort}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </Menu>
  );
}

// The two menus that sit before Add a Student.
export function StudentMenus(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  return (
    <>
      <FilterMenu {...props} />
      <SortMenu {...props} />
    </>
  );
}
