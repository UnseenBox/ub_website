import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * Development only: lets the running game save an image it composed on a canvas
 * (`POST /__poster`) as poster.jpg, so store and site artwork is made from the real game.
 */
function posterSaver(): Plugin {
  return {
    name: 'poster-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__poster', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          // `/__poster` writes the poster; `/__poster/<name>` writes a test capture.
          const name = basename(req.url ?? '').replace(/[^a-z0-9_-]/gi, '');
          const file = name ? join('.shots', `${name}.jpg`) : 'poster.jpg';
          if (name) mkdirSync('.shots', { recursive: true });
          writeFileSync(file, Buffer.concat(chunks));
          res.end(file);
        });
      });
    },
  };
}

/**
 * Free Kicks is a separate, un-bundled module (free-kicks/ next to this file): two scripts and two
 * stylesheets. The build copies them to dist/assets/ under their own names and adds the tags to
 * index.html; the dev server serves them from /free-kicks/. The Classic bundle never imports them.
 * The CrazyGames portal edition does not include Free Kicks. See docs/FREE_KICKS.md.
 */
function freeKicks(mode: string): Plugin {
  const dir = fileURLToPath(new URL('./free-kicks/', import.meta.url));
  const css = ['game-modes.css', 'free-kicks.css'];
  const js = ['game-modes.js', 'free-kicks.js'];
  const on = mode !== 'crazygames';
  return {
    name: 'crazy-kora-free-kicks',
    generateBundle() {
      if (!on) return;
      for (const name of [...css, ...js]) {
        this.emitFile({ type: 'asset', fileName: `assets/${name}`, source: readFileSync(join(dir, name)) });
      }
    },
    transformIndexHtml(_html, ctx) {
      if (!on) return;
      const base = ctx.server ? '/free-kicks/' : './assets/';
      return [
        ...css.map((name) => ({ tag: 'link', attrs: { rel: 'stylesheet', href: base + name }, injectTo: 'head' as const })),
        // defer: they run after the page and after the (deferred) module entry has published window.CrazyKoraAssets.
        ...js.map((name) => ({ tag: 'script', attrs: { defer: true, src: base + name }, injectTo: 'body' as const })),
      ];
    },
  };
}

// Relative base so the build runs from any static path (itch.io, portals, a sub-folder).
// The CrazyGames build (`--mode crazygames`, see .env.crazygames) goes to its own folder
// so the zip for the portal is packed from there.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [posterSaver(), freeKicks(mode)],
  // Duels talk to the website's API. In development that is the site running locally.
  server: { port: 5191, proxy: { '/api': 'http://localhost:3210' } },
  preview: { port: 4191 },
  build: { target: 'es2020', assetsInlineLimit: 0, outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist' },
}));
