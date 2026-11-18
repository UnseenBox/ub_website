import { GameController } from './game/GameController';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('SLIPSHOT: missing #game canvas');
}

const game = new GameController(canvas);
game.start();

// Development-only handle so the physics can be inspected from the console.
if (import.meta.env.DEV) {
  (window as unknown as { slipshot: GameController }).slipshot = game;
}
