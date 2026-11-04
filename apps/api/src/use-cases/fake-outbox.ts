import type { OutgoingEmail } from '../ports/outbox-repository.js';

// An in-memory outbox for use-case tests. Like the real one, it queues each dedupe key once.
export function fakeOutbox() {
  const queued: OutgoingEmail[] = [];
  const outbox = {
    queue: (emails: OutgoingEmail[]) => {
      const fresh = emails.filter((one) => !queued.some((old) => old.dedupeKey === one.dedupeKey));
      queued.push(...fresh);
      return Promise.resolve(fresh.length);
    },
  };
  return { outbox, queued };
}
