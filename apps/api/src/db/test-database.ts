const TEST_DATABASE = 'evlos_test';

// Tests wipe their database, so they may only ever run against evlos_test (AGENTS.md rule 7).
export function assertTestDatabase(url: string | undefined): asserts url is string {
  const name = databaseName(url);
  if (name !== TEST_DATABASE) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL must point at "${TEST_DATABASE}", ` +
        `but it points at "${name ?? 'nothing'}". Check .env.`,
    );
  }
}

// Only the database name is read, so the password never reaches an error message.
function databaseName(url: string | undefined): string | undefined {
  if (url === undefined || !URL.canParse(url)) {
    return undefined;
  }
  const name = new URL(url).pathname.slice(1);
  return name === '' ? undefined : decodeURIComponent(name);
}
