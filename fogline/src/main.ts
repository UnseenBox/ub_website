import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { registerFoglineOverrides } from './audio/overrides';
import { BootScene } from './game/BootScene';
import { SCREEN, fitScreen, type ScreenFit } from './game/screen';
import { ResultsScene } from './game/ResultsScene';
import { MapScene } from './game/MapScene';
import { WorkshopScene } from './game/WorkshopScene';
import { LoadoutScene } from './game/LoadoutScene';
import { BarracksScene } from './game/BarracksScene';
import { HQScene } from './game/HQScene';
import { EndingScene } from './game/EndingScene';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { installAutoFullscreen } from './game/phoneFullscreen';
import { PauseScene } from './game/PauseScene';
import { SettingsScene } from './game/SettingsScene';
import { ShopScene } from './game/ShopScene';
import { ReviveScene } from './game/ReviveScene';
import { portal } from './portal/Portal';
import { profile } from './systems/Profile';

// Block the context menu and accidental selection/drag anywhere on the page.
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('selectstart', (e) => e.preventDefault());
window.addEventListener('dragstart', (e) => e.preventDefault());

// Go full screen automatically: the browser needs one tap, click or key press first,
// so the game asks on that very first one.
installAutoFullscreen();

// Swap the synthesized gun, reload, kill and headshot cues for the supplied recordings.
registerFoglineOverrides();

// CrazyGames (only in that build): the SDK boots in the background. Its data module becomes the
// profile's cloud copy (the save with more progress wins), and its mute switch overrides ours.
portal.onCloud = (store) => {
  profile.attachCloud(store);
  audio.setVolumes(profile.get().volumes);
  // A save from another device may be further along: redraw the title screen with it.
  const menu = game.scene.getScene('Menu');
  if (menu?.scene.isActive()) menu.scene.restart();
};
portal.watchMute((muted) => audio.setHold('platform', muted));
void portal.init();
if (import.meta.env.DEV) (window as unknown as { __foglinePortal: typeof portal }).__foglinePortal = portal;

// The part of the window the player can see, and how much of its sides a notch covers.
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)';
document.body.appendChild(probe);

function windowSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  // A pinch zoom shrinks the visual viewport; the game keeps the unzoomed size.
  const zoom = vv?.scale ?? 1;
  return { w: Math.round(vv ? vv.width * zoom : window.innerWidth), h: Math.round(vv ? vv.height * zoom : window.innerHeight) };
}

function fitWindow(): ScreenFit {
  const { w, h } = windowSize();
  const style = getComputedStyle(probe);
  return fitScreen(w, h, Math.max(parseFloat(style.paddingLeft) || 0, parseFloat(style.paddingRight) || 0));
}

Object.assign(SCREEN, fitWindow());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN.width,
  height: SCREEN.height,
  backgroundColor: '#050505',
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [BootScene, MenuScene, GameScene, ShopScene, PauseScene, SettingsScene, ResultsScene, MapScene, WorkshopScene, LoadoutScene, BarracksScene, HQScene, EndingScene, ReviveScene],
});

/**
 * Keep the game filling the real window. The canvas takes the window's shape (see
 * game/screen.ts) and every scene's camera keeps the 1280×720 design area centred in it.
 * Phaser only re-measures on some resize events, so re-fit on every change of the window,
 * the browser toolbars, the orientation or full screen, and size the page to the visible
 * area so mobile toolbars can't leave a gap.
 */
function keepFitted(g: Phaser.Game): void {
  const host = document.getElementById('game');
  const sizeHost = (): void => {
    if (!host) return;
    const { w, h } = windowSize();
    host.style.width = `${w}px`;
    host.style.height = `${h}px`;
  };
  const refit = (): void => {
    sizeHost();
    const next = fitWindow();
    Object.assign(SCREEN, next);
    if (next.width !== g.scale.width || next.height !== g.scale.height) g.scale.setGameSize(next.width, next.height);
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
    const { w, h } = windowSize();
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      refit();
    }
  }, 250);
}

keepFitted(game);

// Every scene is drawn with the design area in the middle of the canvas.
game.events.on(Phaser.Core.Events.PRE_STEP, () => {
  for (const scene of game.scene.getScenes(false)) scene.cameras?.main?.setScroll(-SCREEN.mx, -SCREEN.my);
});

// Debug/test hooks (used by the automated playtest; harmless in production).
Object.assign(window, { __game: game, __audio: audio });
