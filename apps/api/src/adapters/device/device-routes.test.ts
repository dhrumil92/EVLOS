import Fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UploadedPunch } from '../../use-cases/record-punches.js';
import { registerDeviceRoutes } from './device-routes.js';

const SERIAL = 'TEST-DEVICE';
const NOW = Date.UTC(2026, 10, 5, 17, 29, 0);
const ATTLOG_URL = `/iclock/cdata?SN=${SERIAL}&table=ATTLOG&Stamp=9999`;
const OPERLOG_URL = `/iclock/cdata?SN=${SERIAL}&table=OPERLOG&OpStamp=9999`;
const PUNCH_LINE = '9001\t2026-11-02 21:27:41\t0\t1\t\t0\t0\n';
const FAKE_TEMPLATE = 'FP PIN=9001\tFID=1\tSize=8\tValid=1\tTMP=ZmFrZS10ZW1wbGF0ZQ==\n';

describe('Device routes', () => {
  let recorded: { deviceSerial: string; uploaded: readonly UploadedPunch[] }[];
  let seen: [string, number][];
  let failStorage: boolean;

  const buildApp = async () => {
    const app = Fastify();
    registerDeviceRoutes(app, {
      devices: {
        isRegistered: (serial) => Promise.resolve(serial === SERIAL),
        markSeen: (serial, at) => {
          seen.push([serial, at]);
          return Promise.resolve();
        },
        lastSeen: () => Promise.resolve(null),
      },
      clock: { now: () => NOW },
      recordPunches: (deviceSerial, uploaded) => {
        if (failStorage) {
          return Promise.reject(new Error('database down'));
        }
        recorded.push({ deviceSerial, uploaded });
        return Promise.resolve(uploaded.length);
      },
    });
    await app.ready();
    return app;
  };

  beforeEach(() => {
    recorded = [];
    seen = [];
    failStorage = false;
  });

  it('marks the Device Last Seen at its 30-second call', async () => {
    const app = await buildApp();

    await app.inject({ method: 'GET', url: `/iclock/getrequest?SN=${SERIAL}` });

    expect(seen).toEqual([[SERIAL, NOW]]);
  });

  it('marks the Device Last Seen when it sends a Punch', async () => {
    const app = await buildApp();

    await app.inject({ method: 'POST', url: ATTLOG_URL, payload: PUNCH_LINE });

    expect(seen).toEqual([[SERIAL, NOW]]);
  });

  it('marks nothing for a Device Serial that is not registered', async () => {
    const app = await buildApp();

    await app.inject({ method: 'GET', url: '/iclock/getrequest?SN=UNREGISTERED' });

    expect(seen).toEqual([]);
  });

  it('stores a Punch from a registered Device, sent with no Content-Type', async () => {
    const app = await buildApp();

    const reply = await app.inject({ method: 'POST', url: ATTLOG_URL, payload: PUNCH_LINE });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBe('OK: 1');
    expect(recorded).toEqual([
      {
        deviceSerial: SERIAL,
        uploaded: [{ studentId: '9001', punchedAt: Date.UTC(2026, 10, 2, 15, 57, 41) }],
      },
    ]);
  });

  it('acknowledges every line, so a rejected line is not uploaded forever', async () => {
    const app = await buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: ATTLOG_URL,
      payload: `damaged line\n${PUNCH_LINE}`,
    });

    expect(reply.body).toBe('OK: 2');
    expect(recorded[0]?.uploaded).toHaveLength(1);
  });

  it('refuses an upload from a Device Serial that is not registered', async () => {
    const app = await buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: '/iclock/cdata?SN=UNREGISTERED&table=ATTLOG&Stamp=9999',
      payload: PUNCH_LINE,
    });

    expect(reply.statusCode).toBe(403);
    expect(recorded).toEqual([]);
  });

  it('refuses an upload with no Device Serial', async () => {
    const app = await buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: '/iclock/cdata?table=ATTLOG',
      payload: PUNCH_LINE,
    });

    expect(reply.statusCode).toBe(403);
    expect(recorded).toEqual([]);
  });

  it('does not acknowledge an upload it could not store, so the Device sends it again', async () => {
    failStorage = true;
    const app = await buildApp();

    const reply = await app.inject({ method: 'POST', url: ATTLOG_URL, payload: PUNCH_LINE });

    expect(reply.statusCode).toBe(500);
    expect(reply.body).not.toContain('OK');
  });

  it('acknowledges a fingerprint upload and stores nothing from it', async () => {
    const app = await buildApp();

    const reply = await app.inject({ method: 'POST', url: OPERLOG_URL, payload: FAKE_TEMPLATE });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).not.toContain('TMP');
    expect(recorded).toEqual([]);
  });

  it('writes nothing from a fingerprint upload to the logs', async () => {
    const logs: string[] = [];
    const app = Fastify({
      logger: {
        level: 'trace',
        stream: {
          write: (line: string) => {
            logs.push(line);
          },
        },
      },
    });
    registerDeviceRoutes(app, {
      devices: {
        isRegistered: () => Promise.resolve(true),
        markSeen: () => Promise.resolve(),
        lastSeen: () => Promise.resolve(null),
      },
      clock: { now: () => NOW },
      recordPunches: () => Promise.resolve(0),
    });
    await app.ready();

    await app.inject({ method: 'POST', url: OPERLOG_URL, payload: FAKE_TEMPLATE });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('')).not.toContain('ZmFrZS10ZW1wbGF0ZQ');
  });

  it('accepts an upload large enough to hold many fingerprints', async () => {
    const app = await buildApp();
    const manyTemplates = FAKE_TEMPLATE.repeat(100_000);

    const reply = await app.inject({ method: 'POST', url: OPERLOG_URL, payload: manyTemplates });

    expect(reply.statusCode).toBe(200);
  });

  it('asks the Device to upload Punches only, with no fingerprints', async () => {
    const app = await buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: `/iclock/cdata?SN=${SERIAL}&options=all&pushver=2.4.0`,
    });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toContain(`GET OPTION FROM: ${SERIAL}`);
    expect(reply.body).toContain('TransFlag=1000000000');
  });

  it('answers OK when the Device polls for commands', async () => {
    const app = await buildApp();

    const reply = await app.inject({ method: 'GET', url: `/iclock/getrequest?SN=${SERIAL}` });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBe('OK');
  });

  it('refuses a poll from a Device Serial that is not registered', async () => {
    const app = await buildApp();

    const reply = await app.inject({ method: 'GET', url: '/iclock/getrequest?SN=UNREGISTERED' });

    expect(reply.statusCode).toBe(403);
  });
});
