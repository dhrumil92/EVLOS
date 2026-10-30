import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const PURE_CORE = 'Core is pure: take the time from the injected Clock.';
const NO_IO_IN_CORE = 'Core is pure: put I/O behind a port in apps/api.';

export default defineConfig(
  { ignores: ['**/dist/', '**/node_modules/', '**/coverage/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
          defaultProject: 'tsconfig.base.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ['error', 10],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: PURE_CORE,
        },
        { selector: "NewExpression[callee.name='Date']", message: PURE_CORE },
        { selector: "CallExpression[callee.name='Date']", message: PURE_CORE },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'Core is pure: no randomness.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'http', 'pg', 'drizzle-orm', 'drizzle-orm/*'],
              message: NO_IO_IN_CORE,
            },
            { group: ['@evlos/api', '@evlos/web'], message: 'Dependencies point inward.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
