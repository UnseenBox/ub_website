import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
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

// Relative base so the build runs from any static path (itch.io, portals, a sub-folder).
// The CrazyGames build (`--mode crazygames`, see .env.crazygames) goes to its own folder
// so the zip for the portal is packed from there.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [posterSaver()],
  // Duels talk to the website's API. In development that is the site running locally.
  server: { port: 5191, proxy: { '/api': 'http://localhost:3210' } },
  preview: { port: 4191 },
  build: { target: 'es2020', assetsInlineLimit: 0, outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist' },
}));
