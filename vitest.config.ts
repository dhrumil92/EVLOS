import { defineConfig } from 'vitest/config';

const WORKSPACES = ['packages/core', 'apps/api', 'apps/web'];

export default defineConfig({
  test: {
    projects: WORKSPACES.map((root) => ({
      extends: true,
      test: { name: root, root, include: ['src/**/*.test.ts'] },
    })),
  },
});
