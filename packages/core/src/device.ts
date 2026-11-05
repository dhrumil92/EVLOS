import type { Instant } from './clock.js';

// While it is online, the Device calls EVLOS every 30 seconds and sends each Punch at once.
// After 10 quiet minutes it is probably off its Wi-Fi or switched off, and Punches made since
// may still be waiting on it. Ten minutes ignores a short Wi-Fi hiccup.
const QUIET_AFTER_MS = 10 * 60 * 1000;

// Last Seen: when the Device was last in touch. Null when it has never been in touch.
export function isDeviceQuiet(lastSeen: Instant | null, now: Instant): boolean {
  return lastSeen === null || now - lastSeen >= QUIET_AFTER_MS;
}
