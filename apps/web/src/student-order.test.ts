import { describe, expect, it } from 'vitest';
import { byName, byRoom } from './student-order.js';

const sorted = (order: typeof byRoom, ...students: [room: string, name: string][]) =>
  students
    .map(([room, name]) => ({ room, name }))
    .sort(order)
    .map((one) => one.name);

describe('the order of Students', () => {
  it('is by room in ascending order', () => {
    expect(sorted(byRoom, ['B-101', 'Asha'], ['A-201', 'Bina'])).toEqual(['Bina', 'Asha']);
  });

  it('puts room A-9 before A-10, by value', () => {
    expect(sorted(byRoom, ['A-10', 'Asha'], ['A-9', 'Bina'])).toEqual(['Bina', 'Asha']);
  });

  it('puts Students in one room in order of name', () => {
    expect(sorted(byRoom, ['A-1', 'Bina'], ['A-1', 'Asha'])).toEqual(['Asha', 'Bina']);
  });

  it('can be by name, A to Z, then by room', () => {
    expect(sorted(byName, ['A-1', 'Bina'], ['A-2', 'Asha'], ['A-1', 'Asha'])).toEqual([
      'Asha',
      'Asha',
      'Bina',
    ]);
  });
});
