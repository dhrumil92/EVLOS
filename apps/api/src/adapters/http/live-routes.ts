import type { FastifyInstance } from 'fastify';
import type { LiveFeed } from '../../ports/live-feed.js';
import type { DeviceStatus } from '../../use-cases/device-status.js';
import type { LiveView } from '../../use-cases/get-live-view.js';

// Keeps the open live view pages and tells each one when Punches change.
export class LiveViewers implements LiveFeed {
  private readonly viewers = new Set<() => void>();

  add(viewer: () => void): () => void {
    this.viewers.add(viewer);
    return () => this.viewers.delete(viewer);
  }

  punchesChanged(): void {
    for (const viewer of this.viewers) {
      viewer();
    }
  }
}

export interface LiveRoutesDeps {
  viewers: LiveViewers;
  getLiveView(): Promise<LiveView>;
  getDeviceStatus(): Promise<DeviceStatus>;
}

export function registerLiveRoutes(app: FastifyInstance, deps: LiveRoutesDeps): void {
  app.get('/api/live-view', () => deps.getLiveView());

  // The Device's Last Seen; the page asks again every minute.
  app.get('/api/device-status', () => deps.getDeviceStatus());

  // Server-Sent Events: the page gets a nudge, then asks for the live view again.
  app.get('/api/live-view/events', (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.flushHeaders();
    const remove = deps.viewers.add(() => {
      reply.raw.write('data: punches-changed\n\n');
    });
    request.raw.on('close', remove);
  });
}
