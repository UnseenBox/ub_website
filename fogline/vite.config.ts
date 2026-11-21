import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5191 },
  // Fogline has no PostCSS needs; an inline (empty) config stops Vite from
  // picking up the website's Tailwind postcss.config.mjs in the repo root.
  css: { postcss: { plugins: [] } },
  build: { target: 'es2020', chunkSizeWarningLimit: 1600 },
});
