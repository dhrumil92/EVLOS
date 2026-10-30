import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from './test-database.js';

describe('assertTestDatabase', () => {
  it('refuses a URL that points at the development database evlos', () => {
    const url = 'postgres://evlos:secret@localhost:5432/evlos';

    const act = () => {
      assertTestDatabase(url);
    };

    expect(act).toThrow(/evlos_test/);
  });

  it('refuses a URL with no database name', () => {
    const url = 'postgres://evlos:secret@localhost:5432';

    const act = () => {
      assertTestDatabase(url);
    };

    expect(act).toThrow(/evlos_test/);
  });

  it('refuses when TEST_DATABASE_URL is not set', () => {
    const url = undefined;

    const act = () => {
      assertTestDatabase(url);
    };

    expect(act).toThrow(/TEST_DATABASE_URL/);
  });

  it('refuses a value that is not a URL', () => {
    const url = 'evlos_test';

    const act = () => {
      assertTestDatabase(url);
    };

    expect(act).toThrow(/evlos_test/);
  });

  it('never shows the password in the refusal message', () => {
    const url = 'postgres://evlos:secret@localhost:5432/evlos';

    let message = '';
    try {
      assertTestDatabase(url);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('evlos_test');
    expect(message).not.toContain('secret');
  });

  it('accepts a URL that points at evlos_test', () => {
    const url = 'postgres://evlos:secret@localhost:5432/evlos_test';

    const act = () => {
      assertTestDatabase(url);
    };

    expect(act).not.toThrow();
  });
});
