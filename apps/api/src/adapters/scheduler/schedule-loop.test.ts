import type { ScheduledEmail } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import { ScheduleLoop } from './schedule-loop.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const nov4 = (hour: number, minute = 0) => Date.UTC(2026, 10, 4, hour, minute) - IST_OFFSET_MS;

// A loop whose clock the test moves, recording each step it takes in order.
function setUp(start: number, failures: ScheduledEmail['kind'][] = []) {
  const clock = { time: start, now: () => clock.time };
  const steps: string[] = [];
  const errors: unknown[] = [];
  const loop = new ScheduleLoop({
    clock,
    queue: (email) => {
      const failure = failures.indexOf(email.kind);
      if (failure !== -1) {
        failures.splice(failure, 1);
        return Promise.reject(new Error('database down'));
      }
      steps.push(email.kind);
      return Promise.resolve();
    },
    sendEmails: () => {
      steps.push('send');
      return Promise.resolve();
    },
    onError: (error) => {
      errors.push(error);
    },
  });
  return { clock, loop, steps, errors };
}

describe('ScheduleLoop', () => {
  it('queues the Daily Report once when 23:30 IST passes between two runs', async () => {
    const { clock, loop, steps } = setUp(nov4(23, 29));
    await loop.run();
    steps.length = 0;

    clock.time = nov4(23, 30);
    await loop.run();

    expect(steps).toEqual(['Daily Report', 'send']);
  });

  it('on start at 23:45 IST, queues the evening emails missed earlier that Day', async () => {
    const { loop, steps } = setUp(nov4(23, 45));

    await loop.run();

    expect(steps).toEqual(['Review Reminder', 'Daily Report', 'send']);
  });

  it('does not queue a scheduled email again on later runs', async () => {
    const { clock, loop, steps } = setUp(nov4(23, 45));
    await loop.run();
    steps.length = 0;

    clock.time = nov4(23, 46);
    await loop.run();

    expect(steps).toEqual(['send']);
  });

  it('tries a scheduled email again on the next run when queuing it failed', async () => {
    const { clock, loop, steps, errors } = setUp(nov4(22, 59), ['Review Reminder']);
    await loop.run();
    clock.time = nov4(23, 0);
    await loop.run();
    steps.length = 0;

    clock.time = nov4(23, 1);
    await loop.run();

    expect(errors).toHaveLength(1);
    expect(steps).toEqual(['Review Reminder', 'send']);
  });

  it('still sends the due emails when queuing a scheduled email failed', async () => {
    const { loop, steps, errors } = setUp(nov4(23, 45), ['Review Reminder']);

    await loop.run();

    expect(errors).toHaveLength(1);
    expect(steps).toEqual(['send']);
  });

  it('starts no run while the last one is still going', async () => {
    const { loop, steps } = setUp(nov4(10));

    await Promise.all([loop.run(), loop.run()]);

    expect(steps).toEqual(['send']);
  });
});
