// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it, vi } from 'vitest';

/**
 * The closest thing to the reporter's environment that exists without a browser:
 * the REAL production bundle (dist/assets/index-*.js) is imported into a happy-dom
 * window, with its real index.html markup, a no-op 2D canvas context, and real
 * requestAnimationFrame timing. Everything else — boot, HUD, save writes, the
 * tutorial, the flood, deaths, results and retry — is the shipped code.
 *
 * Driven with synthesized clicks the same way players drive it: SKIP chip first,
 * then the flow runs itself.
 *
 * What this guards: "the game is crashing after the tutorial room is finished" —
 * the reported crash showed a bare colored screen, no error, meaning either boot
 * or a transition wedged. Here both must reach and render their screens, and any
 * of it failing paints the fatal box instead of a blank canvas.
 */

/** The dist bundle is a single ESM file whose name carries a content hash. */
const DIST_DIR = join(process.cwd(), 'dist');
const DIST_ASSETS = join(DIST_DIR, 'assets');

function bundlePath(): string {
  const file = readdirSync(DIST_ASSETS).find((name) => /^index-.*\.js$/.test(name));
  if (!file) throw new Error(`dist/assets/index-*.js not found in ${DIST_ASSETS} — run 'npm run build' first`);
  return join(DIST_ASSETS, file);
}

/** Markup from the real dist/index.html: every id the bundle required()s. */
function distBodyMarkup(): string {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
  // The module scripts are imported by the test itself; only markup survives.
  return body.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/** No-op 2D context: every call succeeds, every read is sensible, nothing draws. */
function stub2d(): CanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: 'srgb',
      });
      // Arithmetic on transform reads (getTransform().a ...) behaves like numbers.
      if (prop === Symbol.toPrimitive || prop === 'valueOf' || prop === 'toString') return () => 0;
      return ctx;
    },
    apply: () => ctx,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function buttonByWord(word: string): HTMLElement | null {
  for (const button of Array.from(document.querySelectorAll('button'))) {
    if ((button.textContent ?? '').toUpperCase().includes(word)) return button;
  }
  return null;
}

it('prod bundle: boot → tutorial → skip → flood → defeat results → retry', async () => {
  // The tests before us may have left globals; this file owns its window state.
  localStorage.clear();
  document.body.innerHTML = distBodyMarkup();

  // The two browser capabilities happy-dom lacks: real canvas pixels and rAF.
  // rAF on a 16ms timer gives the loop genuine production pacing.
  HTMLCanvasElement.prototype.getContext = (() => stub2d()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = ((cb: (now: number) => void) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;

  const failures: string[] = [];
  window.addEventListener('error', (event) => {
    failures.push(`window.error: ${(event as ErrorEvent).message ?? String(event)}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    failures.push(`unhandledrejection: ${String((event as PromiseRejectionEvent).reason)}`);
  });

  // Boot the shipped bundle (dynamic: it must run AFTER the patches above).
  const bundle = pathToFileURL(bundlePath()).href;
  await import(/* @vite-ignore */ bundle);

  // First visit: the boot must land in the tutorial room, playing, with no fatal box.
  await vi.waitFor(() => {
    expect(document.querySelector('.fatal-box'), 'no fatal box at boot').toBeNull();
    expect(document.body.classList.contains('playing'), `body: ${document.body.className}`).toBe(true);
  }, { timeout: 15_000, interval: 250 });
  const save = () => JSON.parse(localStorage.getItem('everything-is-a-weapon/save') ?? '{}');

  // The SKIP chip: the fastest exit from the lessons, straight into the flooded room.
  const skipChip = document.querySelector('button.coach-skip')
    ?? buttonByWord('SKIP');
  expect(skipChip, 'the tutorial shows its SKIP chip').toBeTruthy();
  skipChip!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  // The idle, unprotected player loses the flood: hp runs out and the results
  // screen must actually exist.
  const resultsDeadline = Date.now() + 70_000;
  while (Date.now() < resultsDeadline) {
    if (document.querySelector('.screen.results')) break;
    await sleep(500);
  }
  expect(document.querySelector('.screen.results'), 'defeat renders its results screen').toBeTruthy();
  expect(document.querySelector('.fatal-box')).toBeNull();
  expect(save().tutorial, 'the skip was written to the save').toBe('done');
  expect(save().abilities, 'the blast power survived the run').toContain('blast');

  // RETRY re-enters the room through the ad manager's self-paced promise.
  const retry = buttonByWord('RETRY');
  expect(retry, 'defeat offers RETRY').toBeTruthy();
  await vi.waitFor(() => {
    retry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, { timeout: 4_000, interval: 700 });
  await vi.waitFor(() => {
    expect(document.body.classList.contains('playing'), `body after retry: ${document.body.className}`)
      .toBe(true);
  }, { timeout: 20_000, interval: 500 });

  expect(document.querySelector('.fatal-box')).toBeNull();
  expect(failures, `page errors: ${failures.join(' | ')}`).toEqual([]);
}, 150_000);
