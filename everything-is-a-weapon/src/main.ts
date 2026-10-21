import './styles.css';
import './ui-kit/legacy/bonk-cartoon-ui.css';
import './ui-kit/legacy/bonk-overlay-ui.css';
import './ui-kit/bonk-ui-kit.css';
import './ui-kit/bonk2/theme.css';
import './ui-kit/bonk2/lobby.css';
import './ui-kit/bonk2/rooms.css';
import './ui-kit/bonk2/hud.css';
import './ui-kit/bonk2/panels.css';
import './ui-kit/bonk2/results.css';
import './ui-kit/diagnostics.css';
import { Game } from './core/Game';
import { detectKeyLabels } from './input/KeyLabels';
import { createPortal } from './platform';
import { installCredits } from './ui/screens/credits';
import { UI } from './ui/UI';

function required<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

/**
 * A crash used to leave the last painted frame or a bare backdrop behind, with the
 * cause only in the console. Put the error on top instead, with a way out.
 */
function showFatal(error: unknown): void {
  console.error(error);
  const text = error instanceof Error ? error.message : String(error);
  const box = document.createElement('div');
  box.className = 'fatal-box';
  const title = document.createElement('h2');
  title.textContent = 'BONK! hit a snag';
  const message = document.createElement('p');
  message.textContent = 'The game stopped before it could draw the next frame.';
  const detail = document.createElement('pre');
  detail.textContent = text.slice(0, 800) || 'Unknown error';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'fatal-reload';
  reload.textContent = 'RELOAD';
  reload.addEventListener('click', () => window.location.reload());
  box.append(title, message, detail, reload);

  let panel = document.querySelector<HTMLElement>('.fatal');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'fatal';
    document.body.append(panel);
  }
  panel.replaceChildren(box);
}

window.addEventListener('error', (event) => {
  if (event.error) showFatal(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  showFatal(event.reason);
});

async function boot(): Promise<void> {
  // The portal's SDK has to be up before anything asks it for ads or the save file.
  const portal = createPortal();
  await portal.init();
  portal.loadingStart();
  document.body.classList.add(`portal-${portal.name}`);

  detectKeyLabels();
  const canvas = required<HTMLCanvasElement>('game');
  const game = new Game(canvas, portal);
  const screens = required<HTMLElement>('screens');
  game.hud = new UI(game, required('hud'), screens);
  installCredits();

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

boot().catch(showFatal);
