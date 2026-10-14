import './style.css';
import { WORLD_W, WORLD_H, levelView } from './levels.js';
import { createGame } from './game.js';
import { drawScene } from './renderer.js';
import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createUI } from './ui.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = createGame();
const cam = createCamera();
const ui = createUI(game);

// ---- responsive canvas (DPR aware); the camera owns the world transform ----
let cssW = 1920, cssH = 1080, dpr = 1;
function resize() {
  const wrap = document.getElementById('stage-wrap');
  const r = wrap.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = Math.max(2, r.width); cssH = Math.max(2, r.height);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  cam.setViewport(cssW, cssH);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
resize();

// Screen -> world through the camera. Everything that needs world coordinates
// goes through this one function, so aiming, hit testing and the trajectory
// preview can never disagree with what is being drawn.
function toWorldXY(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return cam.toWorld(clientX - r.left, clientY - r.top);
}
const toWorld = (e) => toWorldXY(e.clientX, e.clientY);

const input = createInput(canvas, toWorld, {
  relScale: () => cam.relScale(),
  onAimStart() { sfx.unlock(); },
  onAimMove(p) { sfx.stretch(p); },
  onAimCancel() {},
  onFire() {
    if (game.fire(input.aim)) {
      input.resetAim();
      ui.syncAll();
    }
  },
  onKey(e) {
    if (e.key === 'r' || e.key === 'R') { game.retry(); input.resetAim(); ui.syncAll(); }
    else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (game.state.screen === 'play') { game.state.screen = 'paused'; game.state.canAim = false; }
      else if (game.state.screen === 'paused') { game.state.screen = 'play'; game.state.canAim = !!game.state.loaded; }
      else if (game.state.screen === 'levels') { game.state.screen = 'title'; }
      ui.syncAll();
    } else if (e.key === 'm' || e.key === 'M') { document.getElementById('btn-sound')?.click(); }
    else if (e.key === 'f' || e.key === 'F') { cam.resetView(); }
    else if (e.key === '+' || e.key === '=') { cam.zoomBy(1 / 1.3); }
    else if (e.key === '-' || e.key === '_') { cam.zoomBy(1.3); }
    else if (e.key === 'Enter') {
      if (game.state.screen === 'title') { game.state.screen = 'levels'; ui.syncAll(); }
      else if (game.state.screen === 'result' && game.state.result === 'win') { document.getElementById('btn-next')?.click(); }
    }
  },
});
ui.wire(input);

/* ---------------- camera controls ---------------- */

// Wheel zoom, anchored on the cursor's world position. deltaMode is normalised
// so a mouse wheel (lines) and a trackpad (pixels) feel the same, and the
// listener lives on the canvas so scrolling over a HUD button never zooms the
// world. preventDefault stops the page itself from scrolling.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
  const r = canvas.getBoundingClientRect();
  cam.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY * unit);
}, { passive: false });

// Pan with the middle or right button, so it never competes with aiming.
let panning = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 1 && e.button !== 2) return;
  panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!panning || e.pointerId !== panning.id) return;
  cam.panByScreen(e.clientX - panning.x, e.clientY - panning.y);
  panning.x = e.clientX; panning.y = e.clientY;
});
const endPan = (e) => { if (panning && e.pointerId === panning.id) panning = null; };
canvas.addEventListener('pointerup', endPan);
canvas.addEventListener('pointercancel', endPan);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById('btn-zoom-in')?.addEventListener('click', () => { sfx.click(); cam.zoomBy(1 / 1.45); });
document.getElementById('btn-zoom-out')?.addEventListener('click', () => { sfx.click(); cam.zoomBy(1.45); });
document.getElementById('btn-zoom-fit')?.addEventListener('click', () => { sfx.click(); cam.resetView(); });

// Re-frame whenever the level changes. game.loadDef publishes the framing it
// wants on state.view, so campaign levels, endless maps and the monuments all
// open at a composition chosen for them.
let framedView = null;
function syncFraming(instant) {
  const v = game.state.view || levelView({ blocks: [], targets: [] });
  if (v === framedView) return;
  framedView = v;
  input.resetAim();
  cam.setHome(v, instant);
}
function refreshAimFlag() {
  const can = game.state.screen === 'play' && !!game.state.loaded && !game.state.flying;
  // A drag interrupted by a menu, a level change or a pointerup outside the
  // canvas would otherwise leave the aim overlay stuck on screen.
  if (!can && input.aim.dragging) input.resetAim();
  input.aim.canAim = can;
}

// ---- main loop: fixed-timestep physics, rAF render ----
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
let hudTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // tab-switch guard
  syncFraming(false);

  if (game.state.screen === 'paused') {
    cam.update(dt);           // the camera stays live so the player can look around
    render();
    return;
  }
  // cinematic timescale (hit-stop / cascade slow-mo): sim steps shrink, but
  // the loop keeps running so input/render stay responsive throughout.
  if (game.fx.tsTimer > 0) game.fx.tsTimer -= dt;
  const ts = game.fx.tsTimer > 0 ? game.fx.tsScale : 1;
  acc += dt * ts;
  let n = 0;
  const prevScreen = game.state.screen;
  while (acc >= STEP && n < 4) {
    game.update(STEP);
    acc -= STEP; n++;
    if (game.state.screen !== prevScreen) break; // result reached: stop stepping
  }
  if (n === 4) acc = 0;
  refreshAimFlag();

  // Keep the action in frame without chasing it. Only the live projectile is
  // followed, and only once it approaches the edge of the view, so a collapse
  // is never yanked around by whichever fragment flew furthest.
  if (game.state.flying && !input.aim.dragging) {
    cam.follow(game.state.flying.x, game.state.flying.y);
  }
  cam.update(dt);
  render();

  hudTimer += dt;
  if (hudTimer > 0.15 || game.state.screen !== prevScreen) {
    hudTimer = 0;
    if (game.state.screen === 'play') ui.renderHUD();
    if (game.state.screen === 'result' && game.state.resultShown) {
      game.state.resultShown = false;
      ui.showResult();
    }
  }
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cssW, cssH);
  cam.applyTransform(ctx, dpr);
  const r = cam.viewRect();
  drawScene(ctx, game.state, input.aim, game.fx, game.fx.time, {
    cx: cam.cam.cx, cy: cam.cam.cy,
    scale: cam.scale(), rel: cam.relScale(),
    x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
    epic: game.state.def?.tier === 'bonus',
  });
}

// boot: preload level 1 as the backdrop, stay on the title
game.loadLevel(0);
game.state.screen = 'title';
syncFraming(true);
ui.syncAll();
setTimeout(() => { resize(); syncFraming(true); }, 50);
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

// prevent page scroll/zoom gestures on the stage
document.getElementById('stage-wrap').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
void WORLD_W; void WORLD_H;
