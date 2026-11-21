import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { registerFoglineOverrides } from './audio/overrides';
import { BootScene } from './game/BootScene';
import { VIEW } from './game/config';
import { GameOverScene } from './game/GameOverScene';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { PauseScene } from './game/PauseScene';
import { ShopScene } from './game/ShopScene';

// Block the context menu and accidental selection/drag anywhere on the page.
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('selectstart', (e) => e.preventDefault());
window.addEventListener('dragstart', (e) => e.preventDefault());

// Swap the synthesized gun, reload, kill and headshot cues for the supplied recordings.
registerFoglineOverrides();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: '#050505',
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [BootScene, MenuScene, GameScene, ShopScene, PauseScene, GameOverScene],
});

// Debug/test hooks (used by the automated playtest; harmless in production).
Object.assign(window, { __game: game, __audio: audio });
