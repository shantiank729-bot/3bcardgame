import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  test: { globals: true, environment: 'node', testTimeout: 120000 },
});
