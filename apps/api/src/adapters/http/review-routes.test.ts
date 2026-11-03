import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { FinalizeResult, Review, SendResult } from '../../use-cases/review.js';
import type { ReviewRoutesDeps } from './review-routes.js';
import { registerReviewRoutes } from './review-routes.js';

const RECTOR = { id: 1, email: 'rector@example.com' };
const REVIEW: Review = {
  day: '2026-11-03',
  canFinalize: true,
  finalization: null,
  needsReview: [],
  absent: [],
  notFinalizedDays: [],
};

function buildApp(
  answers: {
    review?: Review | null;
    finalize?: FinalizeResult;
    send?: SendResult;
  } = {},
) {
  const calls: unknown[][] = [];
  const deps: ReviewRoutesDeps = {
    getReview: (day) => {
      calls.push(['review', day]);
      return Promise.resolve(answers.review === undefined ? REVIEW : answers.review);
    },
    finalizeDay: (day, doneBy) => {
      calls.push(['finalize', day, doneBy]);
      return Promise.resolve(answers.finalize ?? { outcome: 'finalized', absent: 2 });
    },
    sendNotifications: (day, excluded, doneBy) => {
      calls.push(['send', day, excluded, doneBy]);
      return Promise.resolve(answers.send ?? { outcome: 'queued', queued: 3 });
    },
  };
  const app = Fastify();
  // Stands in for the login check, which has its own tests.
  app.decorateRequest('rector', null);
  app.addHook('onRequest', (request, _reply, done) => {
    request.rector = RECTOR;
    done();
  });
  registerReviewRoutes(app, deps);
  return { app, calls };
}

describe('Review routes', () => {
  it('gives the Review of a Day', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/review?day=2026-11-03' });

    expect(reply.json()).toEqual(REVIEW);
    expect(calls).toEqual([['review', '2026-11-03']]);
  });

  it('answers 400 for a Day that cannot be reviewed', async () => {
    const { app } = buildApp({ review: null });

    const reply = await app.inject({ method: 'GET', url: '/api/review?day=2030-01-01' });

    expect(reply.statusCode).toBe(400);
  });

  it('Finalizes the Day as the logged-in Rector', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: '/api/review/finalize',
      payload: { day: '2026-11-03' },
    });

    expect(reply.json()).toEqual({ outcome: 'finalized', absent: 2 });
    expect(calls).toEqual([['finalize', '2026-11-03', RECTOR.email]]);
  });

  it('answers 409 with the reason when Finalize is refused', async () => {
    const { app } = buildApp({ finalize: { outcome: 'refused', reason: 'already-finalized' } });

    const reply = await app.inject({
      method: 'POST',
      url: '/api/review/finalize',
      payload: { day: '2026-11-03' },
    });

    expect(reply.statusCode).toBe(409);
    expect(reply.json()).toEqual({ reason: 'already-finalized' });
  });

  it('sends Notifications with the Excluded Student IDs, keeping only text', async () => {
    const { app, calls } = buildApp();

    const reply = await app.inject({
      method: 'POST',
      url: '/api/review/send',
      payload: { day: '2026-11-03', excludedStudentIds: ['9002', 7, '9003'] },
    });

    expect(reply.json()).toEqual({ outcome: 'queued', queued: 3 });
    expect(calls).toEqual([['send', '2026-11-03', ['9002', '9003'], RECTOR.email]]);
  });

  it('answers 409 when the Day is not Finalized', async () => {
    const { app } = buildApp({ send: { outcome: 'refused', reason: 'not-finalized' } });

    const reply = await app.inject({
      method: 'POST',
      url: '/api/review/send',
      payload: { day: '2026-11-03' },
    });

    expect(reply.statusCode).toBe(409);
  });
});
