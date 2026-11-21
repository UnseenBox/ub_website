import { defineConfig, type Plugin } from 'vite';

/** Shown at the bottom of the Goals card so anyone can tell which build of the game is running. */
const BUILD_STAMP = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/**
 * The new animated loading screen lives in index.html between the LOADER_V2 markers. It is kept in the dev server
 * and the CrazyGames Basic Launch build; every other build gets the old plain "Loading..." text (see src/config/features.ts).
 */
function loaderVariant(mode: string): Plugin {
  return {
    name: 'loader-variant',
    transformIndexHtml(html, ctx) {
      const v2 = Boolean(ctx.server) || mode === 'crazygames-basic' || mode === 'website';
      if (v2) return html.replace(/<!--\/?LOADER_V2-->/g, '');
      return html.replace(/<!--LOADER_V2-->[\s\S]*?<!--\/LOADER_V2-->/, '<div id="loading">Loading...</div>');
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [loaderVariant(mode)],
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
}));
