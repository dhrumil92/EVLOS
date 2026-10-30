import { defineConfig } from 'drizzle-kit';

// Used only by `drizzle-kit generate` to write SQL migrations from the schema.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
});
