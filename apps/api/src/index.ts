import { drizzle } from 'drizzle-orm/node-postgres';
import Fastify from 'fastify';
import pg from 'pg';
import { registerDeviceRoutes } from './adapters/device/device-routes.js';
import { LiveViewers, registerLiveRoutes } from './adapters/http/live-routes.js';
import { PostgresDeviceRegistry } from './adapters/postgres/device-registry.js';
import { PostgresPunchRepository } from './adapters/postgres/punch-repository.js';
import { getLiveView } from './use-cases/get-live-view.js';
import { recordPunches } from './use-cases/record-punches.js';
import type { UploadedPunch } from './use-cases/record-punches.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}
const devicePort = Number(process.env.DEVICE_PORT ?? '8081');
const pagePort = Number(process.env.PAGE_PORT ?? '3000');

const db = drizzle(new pg.Pool({ connectionString: databaseUrl }));
const punches = new PostgresPunchRepository(db);
const clock = { now: () => Date.now() };
const viewers = new LiveViewers();

const deviceApp = Fastify({ logger: true });
registerDeviceRoutes(deviceApp, {
  devices: new PostgresDeviceRegistry(db),
  recordPunches: (deviceSerial: string, uploaded: readonly UploadedPunch[]) =>
    recordPunches(deviceSerial, uploaded, { punches, clock, liveFeed: viewers }),
});

const pageApp = Fastify({ logger: true });
registerLiveRoutes(pageApp, { viewers, getLiveView: () => getLiveView({ punches, clock }) });

// 0.0.0.0 so the Device on the same network can reach this machine.
await deviceApp.listen({ port: devicePort, host: '0.0.0.0' });
// 127.0.0.1 only: there is no login yet, so nobody else on the network may read Punches.
await pageApp.listen({ port: pagePort, host: '127.0.0.1' });
