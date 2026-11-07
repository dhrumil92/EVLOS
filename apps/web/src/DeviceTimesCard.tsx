import type { ReactNode } from 'react';
import { lastSeenShort, useDeviceStatus } from './DeviceLastSeen.js';
import type { DeviceStatus, DeviceStatusSource } from './device-status-source.js';

function Tile(props: { name: string; tone: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${props.tone}`}>
      <dt className="text-sm text-muted">{props.name}</dt>
      <dd className="font-bold">{props.children}</dd>
    </div>
  );
}

// A dot beside the words: green when the Device is in touch, saffron when it is quiet.
function DeviceTile({ status }: { status: DeviceStatus | null }) {
  const isQuiet = status?.isQuiet === true;
  const tone = isQuiet ? 'border-warn-line bg-warn-wash' : 'border-ok-line bg-ok-wash';
  const isUnknown = status === null || status.lastSeenAt === null;
  const dot = isQuiet ? 'bg-focus' : isUnknown ? 'bg-muted' : 'bg-ok';
  return (
    <Tile name="Device" tone={tone}>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {status === null ? 'Checking…' : lastSeenShort(status)}
      </span>
      {isQuiet && (
        <span className="mt-1 block text-sm font-bold text-warn">
          The Device has gone quiet: check its power and Wi-Fi.
        </span>
      )}
    </Tile>
  );
}

// What EVLOS decides by. Nothing here can be changed, so there is nothing to press.
export function DeviceTimesCard({ device }: { device: DeviceStatusSource }) {
  const status = useDeviceStatus(device);
  return (
    <section className="report-card grid gap-4 p-6" aria-label="Device and times">
      <div>
        <h2 className="font-display text-[1.65rem] font-bold">Device and times</h2>
        <p className="text-muted">
          These are fixed for every hostel Day. They are shown so you know how EVLOS decides.
        </p>
      </div>
      <dl className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
        <DeviceTile status={status} />
        <Tile name="Pooja Window" tone="border-line bg-wash">
          05:30 to 18:00, both included
        </Tile>
        <Tile name="Time used everywhere" tone="border-line bg-wash">
          India Standard Time
        </Tile>
      </dl>
    </section>
  );
}
