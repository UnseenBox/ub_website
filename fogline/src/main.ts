import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { registerFoglineOverrides } from './audio/overrides';
import { BootScene } from './game/BootScene';
import { VIEW } from './game/config';
import { GameOverScene } from './game/GameOverScene';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { installAutoFullscreen } from './game/phoneFullscreen';
import { PauseScene } from './game/PauseScene';
import { SettingsScene } from './game/SettingsScene';
import { ShopScene } from './game/ShopScene';

// Block the context menu and accidental selection/drag anywhere on the page.
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('selectstart', (e) => e.preventDefault());
window.addEventListener('dragstart', (e) => e.preventDefault());

// Go full screen automatically: the browser needs one tap, click or key press first,
// so the game asks on that very first one.
installAutoFullscreen();

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
  scene: [BootScene, MenuScene, GameScene, ShopScene, PauseScene, SettingsScene, GameOverScene],
});

/**
 * Keep the 1280×720 game scaled to the real window. Phaser only re-measures on some
 * resize events, so the game would stay at its first size (cropped) after the window,
 * the browser toolbars, the orientation or full screen changed. Re-fit on every one of
 * those, and size the page to the visible area so mobile toolbars can't leave a gap.
 */
function keepFitted(g: Phaser.Game): void {
  const host = document.getElementById('game');
  const sizeHost = (): void => {
    if (!host) return;
    const vv = window.visualViewport;
    host.style.width = `${Math.round(vv?.width ?? window.innerWidth)}px`;
    host.style.height = `${Math.round(vv?.height ?? window.innerHeight)}px`;
  };
  const refit = (): void => {
    sizeHost();
    // Re-measure the container first: refresh() alone reuses the size measured earlier.
    g.scale.getParentBounds();
    g.scale.refresh();
  };
  // Refit now, once the scene is up, and again a moment later once the layout settles.
  g.events.once(Phaser.Core.Events.READY, refit);
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
  window.addEventListener('fullscreenchange', refit);
  window.visualViewport?.addEventListener('resize', refit);
  if (host && typeof ResizeObserver !== 'undefined') new ResizeObserver(refit).observe(document.documentElement);
  setTimeout(refit, 250);
  // Some browsers and embedded windows change size without firing a resize event,
  // so also notice a changed window size a few times a second.
  let lastW = 0;
  let lastH = 0;
  setInterval(() => {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      refit();
    }
  }, 250);
}

keepFitted(game);

// Debug/test hooks (used by the automated playtest; harmless in production).
Object.assign(window, { __game: game, __audio: audio });
