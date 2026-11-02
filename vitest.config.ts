import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Locally the database URLs come from .env; in CI they are set as environment variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const WORKSPACES = ['packages/core', 'apps/api', 'apps/web'];

export default defineConfig({
  resolve: {
    // Tests read the core's source, so a new export needs no build first.
    alias: {
      '@evlos/core': fileURLToPath(new URL('packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // Database tests empty evlos_test, so test files must not run at the same time.
    fileParallelism: false,
    // Rules must not depend on the machine's timezone, so tests never run in IST or UTC.
    env: { TZ: 'America/Los_Angeles' },
    projects: WORKSPACES.map((root) => ({
      extends: true,
      test: { name: root, root, include: ['src/**/*.test.{ts,tsx}'] },
    })),
  },
});
