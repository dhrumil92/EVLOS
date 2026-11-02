import { drizzle } from 'drizzle-orm/node-postgres';
import Fastify from 'fastify';
import pg from 'pg';
import { registerDeviceRoutes } from './adapters/device/device-routes.js';
import { PostgresDeviceRegistry } from './adapters/postgres/device-registry.js';
import { PostgresPunchRepository } from './adapters/postgres/punch-repository.js';
import { recordPunches } from './use-cases/record-punches.js';
import type { UploadedPunch } from './use-cases/record-punches.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}
const devicePort = Number(process.env.DEVICE_PORT ?? '8081');

const db = drizzle(new pg.Pool({ connectionString: databaseUrl }));
const punches = new PostgresPunchRepository(db);
const clock = { now: () => Date.now() };

const app = Fastify({ logger: true });
registerDeviceRoutes(app, {
  devices: new PostgresDeviceRegistry(db),
  recordPunches: (deviceSerial: string, uploaded: readonly UploadedPunch[]) =>
    recordPunches(deviceSerial, uploaded, { punches, clock }),
});

// 0.0.0.0 so the Device on the same network can reach this machine.
await app.listen({ port: devicePort, host: '0.0.0.0' });
