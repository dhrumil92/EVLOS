import { useEffect, useRef, useState } from 'react';
import { Segments } from './ReportsPage.js';

export const SORTS = ['Room', 'Name A to Z'] as const;
export type StudentSort = (typeof SORTS)[number];

const ALL_FLOORS = 'All floors';
const floorLabel = (floor: number) => `Floor ${String(floor)}`;

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />
    </svg>
  );
}

// The funnel button beside the search, and the small panel it opens.
export function StudentFilter(props: {
  floors: readonly number[];
  floor: number | null;
  sort: StudentSort;
  onFloor: (floor: number | null) => void;
  onSort: (sort: StudentSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const isOn = props.floor !== null || props.sort !== 'Room';

  // A press anywhere outside the panel closes it.
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
    };
  }, [open]);

  return (
    <div className="filter" ref={box}>
      <button
        className="filter-button"
        type="button"
        aria-label={isOn ? 'Filter and sort, on' : 'Filter and sort'}
        aria-expanded={open}
        onClick={() => {
          setOpen((old) => !old);
        }}
      >
        <FunnelIcon />
        {isOn && <span className="filter-dot" />}
      </button>
      {open && (
        <div
          className="filter-panel"
          role="dialog"
          aria-label="Filter and sort"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <p className="filter-heading">Floor</p>
          <Segments
            label="Floor"
            options={[ALL_FLOORS, ...props.floors.map(floorLabel)]}
            value={props.floor === null ? ALL_FLOORS : floorLabel(props.floor)}
            onChange={(chosen) => {
              props.onFloor(chosen === ALL_FLOORS ? null : Number(chosen.replace('Floor ', '')));
            }}
          />
          <p className="filter-heading">Sort by</p>
          <Segments label="Sort by" options={SORTS} value={props.sort} onChange={props.onSort} />
        </div>
      )}
    </div>
  );
}
