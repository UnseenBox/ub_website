import displayUrl from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url';
import displayExtUrl from '@fontsource/lilita-one/files/lilita-one-latin-ext-400-normal.woff2?url';
import arabicUrl from '@fontsource-variable/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-wght-normal.woff2?url';
import { LEVELS } from '../data/levels/matches';
import { Game } from './core/Game';
import { lang, rtl } from './core/i18n';
import { installTestHooks } from './debug/TestHooks';
import { isCrazyGames, portal } from './portal/Portal';
import './styles.css';

/** How long the splash stays up at minimum, so it is actually seen. */
const SPLASH_MIN_MS = 1100;
/** The closest thing to "splash became visible" this script can know. */
const splashStart = performance.now();

/** Fade the splash out, then take it out of the DOM. */
function dismissSplash(): void {
  const splash = document.getElementById('app-loading');
  if (!splash) return;
  splash.classList.add('is-done');
  window.setTimeout(() => splash.remove(), 550);
}

function boot(): void {
  document.documentElement.lang = lang;
  if (rtl) document.documentElement.dir = 'rtl';
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  if (!(canvas instanceof HTMLCanvasElement) || !overlay) throw new Error('Crazy Goal: page is missing its canvas or overlay');

  portal.loadingStart();
  void portal.init().then(() => portal.applyLocale());
  const game = new Game(canvas, overlay, LEVELS);
  game.start();
  if (import.meta.env.DEV) installTestHooks(game);
  // Keep the splash up for at least SPLASH_MIN_MS so it is actually seen, then fade it out.
  const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
  window.setTimeout(() => {
    portal.loadingStop();
    requestAnimationFrame(dismissSplash);
  }, wait);

  // An invite link carries a friend's id: open on the duel lobby with it filled in.
  // Portal builds have no duels (their server lives elsewhere), so the link is ignored.
  const friend = isCrazyGames ? null : new URLSearchParams(location.search).get('duel');
  if (friend) void game.duel.open(friend);

  // The faces ship with the game: Lilita One for every Latin letter, Baloo Bhaijaan 2 for Arabic.
  // Each is declared across the whole weight range, so asking for 900 uses the face as drawn instead
  // of a smeared fake bold. Until they arrive the fallback stack is used; canvas text is redrawn after.
  if ('FontFace' in window) {
    const all = { weight: '100 900', style: 'normal' } as const;
    const faces = [
      new FontFace('Lilita One', `url(${displayUrl}) format('woff2')`, { ...all, unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }),
      new FontFace('Lilita One', `url(${displayExtUrl}) format('woff2')`, { ...all, unicodeRange: 'U+0100-024F, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2C60-2C7F, U+A720-A7FF' }),
      new FontFace('Baloo Bhaijaan 2', `url(${arabicUrl}) format('woff2')`, { ...all, unicodeRange: 'U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF' }),
    ];
    Promise.allSettled(faces.map((f) => f.load())).then((results) => {
      for (const r of results) if (r.status === 'fulfilled') document.fonts.add(r.value);
      game.fontsChanged();
    });
  }
}

boot();
