import { defineConfig, type Plugin } from 'vite';

/**
 * The CrazyGames SDK's own script tag, first in <head>, in the CrazyGames build only, so the SDK
 * exists before any game code runs and the loading signal is never missed on a slow phone.
 * Other builds never load it.
 */
function crazySdkTag(enabled: boolean): Plugin {
  return {
    name: 'crazygames-sdk-tag',
    transformIndexHtml() {
      if (!enabled) return [];
      return [{ tag: 'script', attrs: { src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head-prepend' }];
    },
  };
}

// Relative base so the build runs from any static path (itch.io, portals, a sub-folder).
// The CrazyGames build (`npm run build:crazygames`, see .env.crazygames) goes to its own
// folder so the portal zip is packed from there.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [crazySdkTag(mode === 'crazygames')],
  server: { port: 5191 },
  // Fogline has no PostCSS needs; an inline (empty) config stops Vite from
  // picking up the website's Tailwind postcss.config.mjs in the repo root.
  css: { postcss: { plugins: [] } },
  build: { target: 'es2020', chunkSizeWarningLimit: 1600, outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist' },
}));
