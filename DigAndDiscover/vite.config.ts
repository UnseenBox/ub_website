import { defineConfig } from 'vite';

/** Shown at the bottom of the Goals card so anyone can tell which build of the game is running. */
const BUILD_STAMP = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

export default defineConfig({
  base: './',
  define: { __BUILD_LABEL__: JSON.stringify(`main_2 - build ${BUILD_STAMP}`) },
  server: { port: 5173, host: 'localhost' },
  preview: { port: 4173, host: 'localhost' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
