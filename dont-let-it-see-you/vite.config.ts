import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 5188,
    strictPort: true,
  },
});
