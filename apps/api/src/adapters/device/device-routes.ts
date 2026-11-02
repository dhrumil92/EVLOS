import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DeviceRegistry } from '../../ports/device-registry.js';
import type { UploadedPunch } from '../../use-cases/record-punches.js';
import { parseAttlog } from './parse-attlog.js';

export interface DeviceRoutesDeps {
  devices: DeviceRegistry;
  recordPunches(deviceSerial: string, uploaded: readonly UploadedPunch[]): Promise<number>;
}

interface DeviceQuery {
  SN?: string;
  table?: string;
}

// OPERLOG uploads can carry many fingerprint templates, and too small a limit
// would make the Device repeat the same upload forever.
const UPLOAD_LIMIT_BYTES = 16 * 1024 * 1024;

const lineCount = (body: string) => body.split('\n').filter((line) => line.trim() !== '').length;

// TransFlag lists what the Device uploads, and only the first place (Punches) is on, so that
// fingerprint templates stay on the Device. Stamp=9999 and Realtime=1 keep what it does today.
const deviceOptions = (deviceSerial: string) =>
  [
    `GET OPTION FROM: ${deviceSerial}`,
    'Stamp=9999',
    'OpStamp=9999',
    'ErrorDelay=60',
    'Delay=30',
    'TransInterval=1',
    'TransFlag=1000000000',
    'Realtime=1',
    'Encrypt=0',
  ].join('\n');

export function registerDeviceRoutes(app: FastifyInstance, deps: DeviceRoutesDeps): void {
  // The Device sends no Content-Type header, so every upload arrives through this parser.
  app.addContentTypeParser(
    '*',
    { parseAs: 'string', bodyLimit: UPLOAD_LIMIT_BYTES },
    (_request, body, done) => {
      done(null, body);
    },
  );

  const refuseUnregistered = async (request: FastifyRequest, reply: FastifyReply) => {
    const { SN } = request.query as DeviceQuery;
    if (SN === undefined || !(await deps.devices.isRegistered(SN))) {
      request.log.warn({ deviceSerial: SN }, 'refused an unregistered Device Serial');
      return reply.code(403).type('text/plain').send('Forbidden');
    }
  };

  app.get('/iclock/cdata', { preHandler: refuseUnregistered }, (request, reply) => {
    const { SN = '' } = request.query as DeviceQuery;
    return reply.type('text/plain').send(deviceOptions(SN));
  });

  app.get('/iclock/getrequest', { preHandler: refuseUnregistered }, (_request, reply) =>
    reply.type('text/plain').send('OK'),
  );

  app.post('/iclock/cdata', { preHandler: refuseUnregistered }, async (request, reply) => {
    const { SN = '', table } = request.query as DeviceQuery;
    const body = typeof request.body === 'string' ? request.body : '';
    // Only ATTLOG is read. Other tables, such as OPERLOG with its fingerprint templates,
    // are counted and dropped: their content is never parsed, stored or logged.
    if (table === 'ATTLOG') {
      const { punches, rejectedLines } = parseAttlog(body);
      await deps.recordPunches(SN, punches);
      if (rejectedLines > 0) {
        request.log.warn({ rejectedLines }, 'rejected lines in a Device upload');
      }
    }
    return reply.type('text/plain').send(`OK: ${String(lineCount(body))}`);
  });
}
