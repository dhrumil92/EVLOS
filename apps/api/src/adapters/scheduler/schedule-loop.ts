import { scheduledEmailsDue } from '@evlos/core';
import type { Clock, Instant, ScheduledEmail } from '@evlos/core';

export interface ScheduleLoopDeps {
  clock: Clock;
  // Queues one scheduled email. Must be safe to call twice for the same email.
  queue(email: ScheduledEmail): Promise<void>;
  // Sends every queued email that is due.
  sendEmails(): Promise<void>;
  onError(error: unknown): void;
}

// The in-process schedule (ARCHITECTURE section 4). All times are worked out in IST by the
// core, so the server's own timezone never matters.
export class ScheduleLoop {
  private lastRun: Instant | null = null;
  private isRunning = false;

  constructor(private readonly deps: ScheduleLoopDeps) {}

  // One run: queue the scheduled emails that fell due since the last run, then send every
  // queued email that is due. A run never starts while the last one is still going.
  async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.queueDue().catch((error: unknown) => {
        this.deps.onError(error);
      });
      await this.deps.sendEmails().catch((error: unknown) => {
        this.deps.onError(error);
      });
    } finally {
      this.isRunning = false;
    }
  }

  // Runs now, then every intervalMs. Returns a function that stops it.
  start(intervalMs: number): () => void {
    void this.run();
    const timer = setInterval(() => {
      void this.run();
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }

  private async queueDue(): Promise<void> {
    const now = this.deps.clock.now();
    for (const email of scheduledEmailsDue(this.lastRun, now)) {
      try {
        await this.deps.queue(email);
      } catch (error) {
        // Count from just before this email, so the next run tries it again.
        this.lastRun = email.at - 1;
        throw error;
      }
    }
    this.lastRun = now;
  }
}
