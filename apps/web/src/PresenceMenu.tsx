import { useState } from 'react';
import { PopoverMenu } from './PopoverMenu.js';
import { presenceUrl } from './presence-url.js';
import { DownloadIcon } from './ReportDownloads.js';

type Which = 'Day' | 'Month';
const WHICH: Which[] = ['Day', 'Month'];

function PresencePanel(props: { today: string; close: () => void }) {
  const [which, setWhich] = useState<Which>('Day');
  const [day, setDay] = useState(props.today);
  const [month, setMonth] = useState(props.today.slice(0, 7));
  const href = presenceUrl(which === 'Day' ? { view: 'Day', day } : { view: 'Month', month });
  return (
    <>
      <p className="text-sm text-muted">
        Every Student by room, In hostel or Away, worked out from the Leaves.
      </p>
      <div role="group" aria-label="Period" className="flex gap-2">
        {WHICH.map((one) => (
          <button
            key={one}
            type="button"
            aria-pressed={one === which}
            onClick={() => {
              setWhich(one);
            }}
            className={`min-h-11 flex-1 rounded-full border-[1.5px] px-4 font-bold ${one === which ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary'}`}
          >
            {one}
          </button>
        ))}
      </div>
      {which === 'Day' ? (
        <label className="grid gap-1 text-sm font-bold text-muted">
          Day
          <input
            className="field font-normal"
            type="date"
            max={props.today}
            value={day}
            onChange={(event) => {
              if (event.target.value) setDay(event.target.value);
            }}
          />
        </label>
      ) : (
        <label className="grid gap-1 text-sm font-bold text-muted">
          Month
          <input
            className="field font-normal"
            type="month"
            max={props.today.slice(0, 7)}
            value={month}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
          />
        </label>
      )}
      <a
        className="btn inline-flex items-center justify-center gap-2 pt-2.5"
        href={href}
        aria-label="Download Vidyalaya Presence as Excel"
        download
        onClick={props.close}
      >
        <DownloadIcon />
        Excel
      </a>
    </>
  );
}

// The Rector's register of who was In hostel or Away, for a Day or a month, as an Excel file.
export function PresenceMenu({ today }: { today: string }) {
  return (
    <PopoverMenu name="Vidyalaya Presence" label="Vidyalaya Presence">
      {(close) => <PresencePanel today={today} close={close} />}
    </PopoverMenu>
  );
}
