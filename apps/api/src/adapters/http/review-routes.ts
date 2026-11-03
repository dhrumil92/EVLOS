import type { FastifyInstance } from 'fastify';
import type { FinalizeResult, Review, SendResult } from '../../use-cases/review.js';
import { rectorOf } from './auth-routes.js';

export interface ReviewRoutesDeps {
  getReview(day: string): Promise<Review | null>;
  finalizeDay(day: string, doneBy: string): Promise<FinalizeResult>;
  sendNotifications(day: string, excluded: string[], doneBy: string): Promise<SendResult>;
}

const fieldsOf = (body: unknown) => (body ?? {}) as Record<string, unknown>;
const dayFrom = (body: unknown) => {
  const day = fieldsOf(body).day;
  return typeof day === 'string' ? day : '';
};
const excludedFrom = (body: unknown) => {
  const ids = fieldsOf(body).excludedStudentIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
};

export function registerReviewRoutes(app: FastifyInstance, deps: ReviewRoutesDeps): void {
  app.get<{ Querystring: { day?: string } }>('/api/review', async (request, reply) => {
    const review = await deps.getReview(request.query.day ?? '');
    return review ?? reply.code(400).send({ reason: 'invalid-day' });
  });

  app.post('/api/review/finalize', async (request, reply) => {
    const result = await deps.finalizeDay(dayFrom(request.body), rectorOf(request).email);
    if (result.outcome === 'finalized') return result;
    return reply.code(result.reason === 'invalid-day' ? 400 : 409).send({ reason: result.reason });
  });

  app.post('/api/review/send', async (request, reply) => {
    const result = await deps.sendNotifications(
      dayFrom(request.body),
      excludedFrom(request.body),
      rectorOf(request).email,
    );
    if (result.outcome === 'queued') return result;
    return reply.code(409).send({ reason: result.reason });
  });
}
