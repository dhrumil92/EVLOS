import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pagePort = process.env.PAGE_PORT ?? '3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // tsc writes to dist, so the site goes in its own folder inside it.
  build: { outDir: 'dist/site' },
  server: { proxy: { '/api': `http://127.0.0.1:${pagePort}` } },
});
