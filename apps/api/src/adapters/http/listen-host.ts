import { isIP } from 'node:net';

// The address a server listens on, read from a setting such as PAGE_HOST. It defaults to this
// machine only (127.0.0.1). On the VM the setting is 0.0.0.0 so Caddy, in another container, can
// reach the server; Compose still publishes no port of it to the internet. A wrong value stops
// the server at start.
export function listenHostFrom(
  env: Record<string, string | undefined>,
  name: 'PAGE_HOST' | 'PUBLIC_HOST',
): string {
  const host = (env[name] ?? '').trim();
  if (host === '') return '127.0.0.1';
  if (isIP(host) === 0) {
    throw new Error(`${name} must be an IP address such as 127.0.0.1 or 0.0.0.0. Check .env.`);
  }
  return host;
}
