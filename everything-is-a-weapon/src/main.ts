import './styles.css';
import { Game } from './core/Game';
import { detectKeyLabels } from './input/KeyLabels';
import { createPortal } from './platform';
import { UI } from './ui/UI';

function required<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

async function boot(): Promise<void> {
  // The portal's SDK has to be up before anything asks it for ads or the save file.
  const portal = createPortal();
  await portal.init();
  portal.loadingStart();
  document.body.classList.add(`portal-${portal.name}`);

  detectKeyLabels();
  const canvas = required<HTMLCanvasElement>('game');
  const game = new Game(canvas, portal);
  game.hud = new UI(game, required('hud'), required('screens'));

  // Browsers only allow audio after a gesture; the first click or key press unlocks it.
  const unlock = (): void => game.audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  // iOS suspends audio when the page is backgrounded and only a touch that ends on the page brings it back.
  window.addEventListener('touchend', unlock);

  required('rotate-dismiss').addEventListener('click', () => document.body.classList.add('portrait-ok'));

  game.start();
  // Inside a portal's frame the keys go nowhere until the frame has focus.
  window.focus();
  window.addEventListener('pointerdown', () => window.focus());
  portal.loadingStop();

  if (import.meta.env.DEV) {
    // Development-only tooling; this branch is removed from production builds.
    void import('./debug/DebugOverlay').then(({ DebugOverlay }) => new DebugOverlay(game, required('debug')));
    void import('./debug/TestHooks').then(({ installTestHooks }) => installTestHooks(game));
    (window as unknown as { __game: Game }).__game = game;
  }
}

boot().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement('div');
  message.className = 'fatal';
  message.textContent = 'This browser could not start the game. Try a current version of Chrome, Edge, Firefox or Safari.';
  document.body.append(message);
});
