import Phaser from 'phaser';
import '@fontsource/rye/400.css';
import { state } from './core/GameState';
import { BootScene } from './scenes/BootScene';
import { DigScene } from './scenes/DigScene';
import { WorkshopScene } from './scenes/WorkshopScene';
import { HudScene } from './scenes/HudScene';
import { EndOfDayScene } from './scenes/EndOfDayScene';
import { StoreScene } from './scenes/StoreScene';
import { GoalsScene } from './scenes/GoalsScene';
import { PauseScene } from './scenes/PauseScene';
import { CollectionScene } from './scenes/CollectionScene';
import { RelocateScene } from './scenes/RelocateScene';
import { LedgerScene } from './scenes/LedgerScene';
import { GameOverScene } from './scenes/GameOverScene';
import { portal } from './ads/Portal';

async function waitForFonts(): Promise<void> {
  if (!document.fonts) return;
  const load = Promise.all([document.fonts.load('400 24px Rye')]);
  // Never block the game on a slow font: fall back after a short wait.
  await Promise.race([load.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2500))]);
}

/** WebGL cannot create its render targets for a 0x0 window (e.g. a hidden iframe). */
async function waitForViewport(): Promise<void> {
  for (let i = 0; i < 100 && (window.innerWidth < 2 || window.innerHeight < 2); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function start(): Promise<void> {
  void portal.init(); // the ad SDK loads in the background and never blocks the game
  await Promise.all([waitForFonts(), waitForViewport()]);
  document.getElementById('loading')?.remove();
  const game = new Phaser.Game({
    type: Phaser.AUTO, // WebGL with automatic Canvas fallback
    parent: 'game',
    backgroundColor: '#7fcfff',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    render: { antialias: true, powerPreference: 'high-performance' },
    input: { activePointers: 2 },
    audio: { noAudio: true }, // sounds are synthesized by our own lightweight Sfx module
    disableContextMenu: true,
    banner: false,
    // Scene order = draw order: the HUD always renders on top.
    scene: [BootScene, DigScene, WorkshopScene, HudScene, EndOfDayScene, StoreScene, GoalsScene, PauseScene, CollectionScene, RelocateScene, LedgerScene, GameOverScene],
  });
  // Dev server only: handy for poking at the running game from the console / tests.
  if (import.meta.env.DEV) (window as unknown as { __dd: unknown }).__dd = { game, state };
}

void start();
