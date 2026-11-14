import Phaser from 'phaser';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import { state } from './core/GameState';
import { BootScene } from './scenes/BootScene';
import { DigScene } from './scenes/DigScene';
import { WorkshopScene } from './scenes/WorkshopScene';
import { HudScene } from './scenes/HudScene';
import { EndOfDayScene } from './scenes/EndOfDayScene';

async function waitForFonts(): Promise<void> {
  if (!document.fonts) return;
  const load = Promise.all([document.fonts.load('700 24px Fredoka'), document.fonts.load('500 24px Fredoka')]);
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
    scene: [BootScene, DigScene, WorkshopScene, HudScene, EndOfDayScene],
  });
  // Dev server only: handy for poking at the running game from the console / tests.
  if (import.meta.env.DEV) (window as unknown as { __dd: unknown }).__dd = { game, state };
}

void start();
