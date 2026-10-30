import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Locally the database URLs come from .env; in CI they are set as environment variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const WORKSPACES = ['packages/core', 'apps/api', 'apps/web'];

export default defineConfig({
  test: {
    projects: WORKSPACES.map((root) => ({
      extends: true,
      test: { name: root, root, include: ['src/**/*.test.ts'] },
    })),
  },
});
