import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DeviceStatusSource } from './device-status-source.js';
import { DeviceTimesCard } from './DeviceTimesCard.js';
import { PasswordCard } from './PasswordCard.js';
import { RecipientsCard } from './RecipientsCard.js';
import type { SettingsSource } from './settings-source.js';

type Section = 'recipients' | 'password' | 'device';

const ICON = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const MENU: { key: Section; label: string; icon: ReactNode }[] = [
  {
    key: 'recipients',
    label: 'Report Recipients',
    icon: (
      <svg {...ICON}>
        <path d="M3 6h18v12H3z" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
  {
    key: 'password',
    label: 'Your password',
    icon: (
      <svg {...ICON}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    key: 'device',
    label: 'Device and times',
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

// The Rector's settings: who receives the Report emails, the password, and the fixed rules.
// The title and the menu are one column at the side, and stay in view beside the cards on a wide
// screen; the cards start at the top of the page. The menu scrolls to a card and does not change
// the web address.
export function SettingsPage(props: { source: SettingsSource; device: DeviceStatusSource }) {
  const [current, setCurrent] = useState<Section>('recipients');
  const places = {
    recipients: useRef<HTMLDivElement>(null),
    password: useRef<HTMLDivElement>(null),
    device: useRef<HTMLDivElement>(null),
  };
  const goTo = (section: Section) => {
    setCurrent(section);
    places[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="grid max-w-full flex-[1_1_14rem] gap-3 lg:sticky lg:top-[4.5rem]">
        <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
          Settings
        </h1>
        <nav aria-label="Settings sections" className="grid gap-1">
          {MENU.map((item) => {
            const isCurrent = item.key === current;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  goTo(item.key);
                }}
                className={`flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] px-3.5 text-left ${isCurrent ? 'border-primary bg-surface font-bold' : 'border-transparent hover:bg-tint'}`}
              >
                <span className={isCurrent ? 'text-primary' : 'text-muted'}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="grid min-w-0 flex-[999_1_40rem] gap-6">
        <div ref={places.recipients} className="scroll-mt-[4.5rem]">
          <RecipientsCard source={props.source} />
        </div>
        <div ref={places.password} className="scroll-mt-[4.5rem]">
          <PasswordCard source={props.source} />
        </div>
        <div ref={places.device} className="scroll-mt-[4.5rem]">
          <DeviceTimesCard device={props.device} />
        </div>
      </div>
    </div>
  );
}
