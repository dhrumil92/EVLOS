import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pagePort = process.env.PAGE_PORT ?? '3000';
const publicPort = process.env.PUBLIC_PORT ?? '3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // tsc writes to dist, so the site goes in its own folder inside it.
  build: { outDir: 'dist/site' },
  server: {
    // /api/public goes to the Public Live View's own server; it is listed first, as it is longer.
    proxy: {
      '/api/public': `http://127.0.0.1:${publicPort}`,
      '/api': `http://127.0.0.1:${pagePort}`,
    },
  },
});
