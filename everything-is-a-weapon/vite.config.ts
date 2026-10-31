import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** CrazyGames asks for its SDK to be loaded in the page head, before the game's own code. */
function crazyGamesSdk(): Plugin {
  return {
    name: 'crazygames-sdk',
    transformIndexHtml: () => [
      { tag: 'script', attrs: { src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head-prepend' },
    ],
  };
}

/**
 * GameMonetize.com's SDK is configured through `window.SDK_OPTIONS`, which has to exist
 * before their loader script runs. The gameId comes from the GAMEMONETIZE_GAME_ID
 * environment variable.
 *
 * The config goes first in the head, but the loader itself is injected at the end of the
 * body, deliberately NOT in the head: their SDK fires an automatic preroll ad on startup
 * (window.sdk.showBanner() on every non-localhost page whose URL has no "account" in it),
 * and its ad code does `document.body.appendChild(...)`. This build inlines ~0.5 MB of
 * game code in the head, so a head-loaded sdk.js can execute before the parser reaches
 * <body>: the appendChild then throws, the SDK reports "The SDK failed", and no ad ever
 * plays again. A body-end loader can only run once <body> exists, so the preroll works.
 */
function gameMonetizeSdk(env: Record<string, string>): Plugin {
  const gameId = env.GAMEMONETIZE_GAME_ID ?? '';
  return {
    name: 'gamemonetize-sdk',
    transformIndexHtml: () => [
      {
        tag: 'script',
        children: `
window.SDK_OPTIONS = {
  gameId: ${JSON.stringify(gameId)},
  onEvent: function (a) {
    (window.__GM_EVENTS__ = window.__GM_EVENTS__ || []).push(a && a.name);
    if (typeof window.__GM_ON_EVENT__ === "function") window.__GM_ON_EVENT__(a);
  }
};`,
        injectTo: 'head-prepend',
      },
      {
        tag: 'script',
        children: `
(function (a, b, c) {
  var d = a.getElementsByTagName(b)[0];
  a.getElementById(c) || (a = a.createElement(b), a.id = c, a.src = "https://api.gamemonetize.com/sdk.js", d.parentNode.insertBefore(a, d))
})(document, "script", "gamemonetize-sdk");`,
        injectTo: 'body',
      },
    ],
  };
}

/**
 * Folds the stylesheet and the script into index.html, so the portal build is one file with
 * nothing else to fetch. A portal's file host can then neither lose the assets folder nor
 * refuse to serve it (Vite's own tags ask for the files with `crossorigin`, which some
 * hosts answer without the headers that needs, leaving a bare unstyled page).
 */
function singleFile(): Plugin {
  const CLOSE = '</' + 'script>';
  /** Swaps the whole tag that points at `name` (a <link>, or a <script> with its end tag). */
  const swapTag = (html: string, name: string, replacement: string): string | null => {
    const at = html.indexOf(`"./${name}"`);
    if (at < 0) return null;
    const start = html.lastIndexOf('<', at);
    let end = html.indexOf('>', at) + 1;
    if (html.startsWith(CLOSE, end)) end += CLOSE.length;
    return html.slice(0, start) + replacement + html.slice(end);
  };
  /** A literal end tag inside inlined code would close the element early. */
  const guard = (code: string, tag: string): string => code.split('</' + tag).join('<\\/' + tag);
  return {
    name: 'single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = Object.values(bundle).find((file) => file.type === 'asset' && file.fileName.endsWith('.html'));
      if (!page || page.type !== 'asset') return;
      let html = String(page.source);
      for (const file of Object.values(bundle)) {
        if (file === page) continue;
        let inline: string;
        if (file.type === 'chunk') inline = `<script type="module">${guard(file.code, 'script')}${CLOSE}`;
        else if (file.fileName.endsWith('.css')) inline = `<style>${guard(String(file.source), 'style')}</style>`;
        else continue;
        const swapped = swapTag(html, file.fileName, inline);
        if (swapped === null) continue;
        html = swapped;
        delete bundle[file.fileName];
      }
      page.source = html;
    },
  };
}

/**
 * Development only: lets a page running on the dev server save an image it has drawn on a
 * canvas (`POST /__cover/<name>.png`) into covers/. Used to render the store covers with
 * the game's own character art.
 */
function coverSaver(): Plugin {
  return {
    name: 'cover-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__cover/', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          mkdirSync('covers', { recursive: true });
          const file = join('covers', basename(req.url ?? 'cover.png'));
          writeFileSync(file, Buffer.concat(chunks));
          res.end(file);
        });
      });
    },
  };
}

/**
 * `vite build` is the plain web build (studio website, Vercel) and goes to dist/.
 * `vite build --mode crazygames` is the CrazyGames build and goes to dist-crazygames/.
 * `vite build --mode gamemonetize` is the GameMonetize.com build and goes to dist-gamemonetize/.
 */
export default defineConfig(({ mode }) => {
  const portal = mode === 'crazygames' || mode === 'gamemonetize' ? mode : null;
  return {
    // Relative paths only: portals serve the game from a folder they choose.
    base: './',
    // Recorded sounds ship as files next to the page — except in the single-file
    // portal builds, which must stay one file and keep the synthesiser.
    define: { __SAMPLES__: JSON.stringify(portal === null || portal === 'crazygames') },
    publicDir: portal === null ? undefined : false,
    plugins:
      portal === 'crazygames'
        ? [crazyGamesSdk(), singleFile(), coverSaver()]
        : portal === 'gamemonetize'
          ? [gameMonetizeSdk(loadEnv(mode, process.cwd(), '')), singleFile(), coverSaver()]
          : [coverSaver()],
    build: {
      target: 'es2020',
      sourcemap: false,
      outDir: portal === 'crazygames' ? 'dist-crazygames' : portal === 'gamemonetize' ? 'dist-gamemonetize' : 'dist',
      // Portal builds must stay one self-contained file (see singleFile()): images
      // referenced from CSS, e.g. the main-menu key art, are inlined as data URLs.
      // The web build keeps them as separate files for caching.
      assetsInlineLimit: portal === null ? 4096 : 4_000_000,
    },
    server: { port: 5173, strictPort: false },
  };
});
