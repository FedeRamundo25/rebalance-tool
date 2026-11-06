import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Rutas relativas para que funcione en GitHub Pages subfolders
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  }
});
