import './style.css';
import { Game } from './core/Game';

/**
 * Entry point. Finds the canvas, starts the game, and makes sure a failure here
 * produces a readable message rather than a black rectangle.
 */
function boot(): void {
  const app = document.getElementById('app');
  const canvas = document.getElementById('stage');
  const ui = document.getElementById('ui');

  if (!(canvas instanceof HTMLCanvasElement) || !ui || !app) {
    showFatal('The page did not load correctly. Try a refresh.');
    return;
  }

  try {
    const game = new Game(canvas, ui, app);
    game.start();
    // Handy for poking at the live game from the console during development.
    if (import.meta.env.DEV) {
      (window as unknown as { game: Game }).game = game;
    }
    window.addEventListener('pagehide', () => game.dispose());
  } catch (err) {
    console.error(err);
    showFatal(
      err instanceof Error
        ? `This browser could not start the game: ${err.message}`
        : 'This browser could not start the game.',
    );
  }
}

function showFatal(message: string): void {
  const node = document.createElement('div');
  node.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;text-align:center;' +
    'padding:2rem;color:#9fb0c0;font-family:system-ui,sans-serif;letter-spacing:0.08em;background:#04060a';
  node.textContent = message;
  document.body.append(node);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
