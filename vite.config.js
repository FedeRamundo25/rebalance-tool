import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: resolve(process.cwd(), 'index.html'),
        app: resolve(process.cwd(), 'app.html'),
      },
    },
  },
  server: { port: 5173 },
});
