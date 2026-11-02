import { describe, expect, it } from 'vitest';
import type { Clock, Instant } from './clock.js';
import type { Leave } from './leave.js';
import { PoojaStatus, poojaStatusOf } from './pooja-status.js';
import type { StudentDay } from './pooja-status.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY = '2026-11-10';

// An instant on the given date in November 2026 at an IST clock time.
const istOn = (date: number, hour: number, minute = 0, second = 0): Instant =>
  Date.UTC(2026, 10, date, hour, minute, second) - IST_OFFSET_MS;

// An instant on DAY at an IST clock time.
const ist = (hour: number, minute = 0, second = 0): Instant => istOn(10, hour, minute, second);

const clockAt = (instant: Instant): Clock => ({ now: () => instant });
const lateTonight = clockAt(ist(23, 0));

const leave = (outAt: Instant, returnedAt: Instant | null): Leave => ({
  outAt,
  expectedReturnAt: istOn(20, 10),
  returnedAt,
});

const studentDay = (facts: Partial<StudentDay>): StudentDay => ({
  day: DAY,
  punches: [],
  leaves: [],
  isFinalized: false,
  ...facts,
});

describe('Present', () => {
  it('is Present with a Punch at 05:30:00 IST', () => {
    const status = poojaStatusOf(studentDay({ punches: [ist(5, 30, 0)] }), lateTonight);

    expect(status).toBe(PoojaStatus.PRESENT);
  });

  it('is Present with a Punch at 18:00:00 IST', () => {
    const status = poojaStatusOf(studentDay({ punches: [ist(18, 0, 0)] }), lateTonight);

    expect(status).toBe(PoojaStatus.PRESENT);
  });

  it('is Present as soon as the Punch arrives, before the window closes', () => {
    const status = poojaStatusOf(studentDay({ punches: [ist(7)] }), clockAt(ist(7, 0, 1)));

    expect(status).toBe(PoojaStatus.PRESENT);
  });

  it('stays Present when the Student punched at 07:00 and left at 08:00', () => {
    const facts = studentDay({ punches: [ist(7)], leaves: [leave(ist(8), null)] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.PRESENT);
  });

  it('is Present when the Student returned at 16:00 and punched at 17:00', () => {
    const facts = studentDay({
      punches: [ist(17)],
      leaves: [leave(istOn(9, 9), ist(16))],
    });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.PRESENT);
  });

  it('stays Present after Finalize', () => {
    const facts = studentDay({ punches: [ist(7)], isFinalized: true });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.PRESENT);
  });
});

describe('a Punch that does not count', () => {
  it('ignores a Punch at 18:00:01 IST', () => {
    const facts = studentDay({ punches: [ist(18, 0, 1)] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('ignores a Punch at 05:29:59 IST', () => {
    const facts = studentDay({ punches: [ist(5, 29, 59)] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('ignores a Punch inside the window of another Day', () => {
    const facts = studentDay({ punches: [istOn(9, 7)] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });
});

describe('Not Applicable', () => {
  const statusWith = (away: Leave) => poojaStatusOf(studentDay({ leaves: [away] }), lateTonight);

  it('is Not Applicable with an open Leave from an earlier Day', () => {
    expect(statusWith(leave(istOn(9, 9), null))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is Not Applicable when the Leave starts inside the window', () => {
    expect(statusWith(leave(ist(10), null))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is Not Applicable when the Student returned at 08:00 without a Punch', () => {
    expect(statusWith(leave(istOn(9, 9), ist(8)))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is Not Applicable when the whole Leave sits inside the window', () => {
    expect(statusWith(leave(ist(9), ist(11)))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is Not Applicable when the Out Time is exactly 18:00:00 IST', () => {
    expect(statusWith(leave(ist(18, 0, 0), null))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is Not Applicable when the Return Time is exactly 05:30:00 IST', () => {
    expect(statusWith(leave(istOn(9, 9), ist(5, 30, 0)))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is shown as soon as the Student is Away, before the window closes', () => {
    const facts = studentDay({ leaves: [leave(ist(9), null)] });

    expect(poojaStatusOf(facts, clockAt(ist(9, 0, 1)))).toBe(PoojaStatus.NOT_APPLICABLE);
  });

  it('is never Absent, even after Finalize', () => {
    const facts = studentDay({ leaves: [leave(ist(9), null)], isFinalized: true });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NOT_APPLICABLE);
  });
});

describe('in the hostel for the whole window', () => {
  it('reaches Needs Review when the Return Time was 05:29:59 IST', () => {
    const facts = studentDay({ leaves: [leave(istOn(9, 9), ist(5, 29, 59))] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('reaches Needs Review when the Out Time was 18:00:01 IST', () => {
    const facts = studentDay({ leaves: [leave(ist(18, 0, 1), null)] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('reaches Needs Review when a closed Leave ended on an earlier Day', () => {
    const facts = studentDay({ leaves: [leave(istOn(7, 9), istOn(8, 9))] });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('reaches Needs Review when a later Leave began after this Day', () => {
    const facts = studentDay({ leaves: [leave(istOn(11, 9), null)] });

    expect(poojaStatusOf(facts, clockAt(istOn(12, 9)))).toBe(PoojaStatus.NEEDS_REVIEW);
  });
});

describe('Pending', () => {
  it('is Pending at 10:00 IST with no Punch', () => {
    expect(poojaStatusOf(studentDay({}), clockAt(ist(10)))).toBe(PoojaStatus.PENDING);
  });

  it('is still Pending at 18:00:00 IST, the last second of the window', () => {
    expect(poojaStatusOf(studentDay({}), clockAt(ist(18, 0, 0)))).toBe(PoojaStatus.PENDING);
  });
});

describe('Needs Review', () => {
  it('is Needs Review at 18:00:01 IST with no Punch and the Day not Finalized', () => {
    expect(poojaStatusOf(studentDay({}), clockAt(ist(18, 0, 1)))).toBe(PoojaStatus.NEEDS_REVIEW);
  });

  it('stays Needs Review on later Days until Finalize', () => {
    expect(poojaStatusOf(studentDay({}), clockAt(istOn(15, 10)))).toBe(PoojaStatus.NEEDS_REVIEW);
  });
});

describe('Absent', () => {
  it('becomes Absent only when the Day is Finalized', () => {
    const facts = studentDay({ isFinalized: true });

    expect(poojaStatusOf(facts, lateTonight)).toBe(PoojaStatus.ABSENT);
  });
});
