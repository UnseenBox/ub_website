import fontUrl from '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?url';
import { LEVELS } from '../data/levels/houma';
import { Game } from './core/Game';
import { lang, rtl } from './core/i18n';
import { installTestHooks } from './debug/TestHooks';
import { isCrazyGames, portal } from './portal/Portal';
import './styles.css';

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
  // The first painted frame ends loading: the menu is up and the game is ready.
  requestAnimationFrame(() => portal.loadingStop());

  // An invite link carries a friend's id: open on the duel lobby with it filled in.
  // Portal builds have no duels (their server lives elsewhere), so the link is ignored.
  const friend = isCrazyGames ? null : new URLSearchParams(location.search).get('duel');
  if (friend) void game.duel.open(friend);

  // The display face ships with the game. Until it arrives (or if it never does) the
  // fallback stack is used; the canvas text is redrawn once it lands.
  if ('FontFace' in window) {
    const face = new FontFace('Unbounded', `url(${fontUrl}) format('woff2')`, { weight: '200 900', style: 'normal' });
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        game.fontsChanged();
      })
      .catch(() => {
        /* fallback fonts are fine */
      });
  }
}

boot();
