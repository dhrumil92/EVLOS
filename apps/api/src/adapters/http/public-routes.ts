import rateLimit from '@fastify/rate-limit';
import type { Instant } from '@evlos/core';
import type { FastifyInstance } from 'fastify';
import type { PublicLiveView } from '../../use-cases/get-public-live-view.js';

export interface PublicRoutesDeps {
  getPublicLiveView(): Promise<PublicLiveView>;
  now(): Instant;
}

// However many people watch, the numbers are worked out at most once in this time.
const KEEP_MS = 30 * 1000;
// Each address may ask this often. The page asks twice a minute, and all the Students on the
// hostel Wi-Fi share one internet address, so 1200 lets every one of 360 Students watch at once.
// Each answer comes from the 30-second cache, so even this many costs little; more is a flood.
const TRIES_PER_MINUTE = 1200;

// The last answer, kept for KEEP_MS. Viewers who ask while it is being worked out share the
// same answer, so a crowd at one moment still costs one look at the database.
function keptFor(load: () => Promise<PublicLiveView>, now: () => Instant) {
  let kept: { at: Instant; answer: Promise<PublicLiveView> } | null = null;
  return () => {
    if (kept === null || now() - kept.at >= KEEP_MS) {
      const answer = load();
      kept = { at: now(), answer };
      // A failed answer is not kept, so the next viewer tries again.
      answer.catch(() => {
        kept = null;
      });
    }
    return kept.answer;
  };
}

// The Public Live View (FR-17) runs on its own server, apart from the Rector's: this one has no
// login, no cookies and this single read-only route. It takes no input, so nothing typed into
// the address can reach the database.
export async function registerPublicRoutes(
  app: FastifyInstance,
  deps: PublicRoutesDeps,
): Promise<void> {
  await app.register(rateLimit, { max: TRIES_PER_MINUTE, timeWindow: '1 minute' });
  const view = keptFor(
    () => deps.getPublicLiveView(),
    () => deps.now(),
  );

  app.get('/api/public/live', async (_request, reply) => {
    const answer = await view();
    return reply.header('X-Robots-Tag', 'noindex').header('Cache-Control', 'no-store').send(answer);
  });
}
