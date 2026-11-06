import { useEffect, useState } from 'react';
import type { DeviceStatus, DeviceStatusSource } from './device-status-source.js';

const ONE_MINUTE_MS = 60 * 1000;
const seenWords = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// The Device's Last Seen, asked for again every minute. Null until it is known; a failed ask
// keeps the last answer, so a short server hiccup does not flash a warning.
export function useDeviceStatus(source: DeviceStatusSource): DeviceStatus | null {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  useEffect(() => {
    const ask = () => {
      source.load().then(setStatus, () => undefined);
    };
    ask();
    const timer = setInterval(ask, ONE_MINUTE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [source]);
  return status;
}

function words(status: DeviceStatus): string {
  if (status.lastSeenAt === null) {
    return 'The Device has not been in touch yet: check its power, its Wi-Fi and its Cloud server setting.';
  }
  const seen = `Device last seen ${seenWords.format(status.lastSeenAt)}.`;
  return status.isQuiet
    ? `${seen} Punches made since then may still be on it: check its power and Wi-Fi.`
    : seen;
}

// Like "last seen" in a chat app: when the Device was last in touch. A quiet Device is shown
// as a warning, since Punches made since may still be waiting on it.
export function DeviceLastSeen({ status }: { status: DeviceStatus | null }) {
  if (status === null) return null;
  return status.isQuiet ? (
    <p className="notice" role="status">
      {words(status)}
    </p>
  ) : (
    <p className="text-muted">{words(status)}</p>
  );
}
