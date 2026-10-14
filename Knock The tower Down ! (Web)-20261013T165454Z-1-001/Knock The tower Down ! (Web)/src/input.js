// Pointer + keyboard input: drag-back-from-sling aiming, release to fire.
// Also tracks draw speed (flick) for the fast-launch risk/reward mechanic.
//
// Everything here is expressed in SCREEN terms and converted through the
// camera, because the gesture must feel identical at every zoom level. The
// drag needed for full power is a fixed number of screen pixels, the grab
// radius around the pouch is a fixed number of screen pixels, and flick speed
// is measured in screen px/sec. Zooming out therefore cannot quietly turn a
// small wrist movement into a maximum-power launch, and the launch velocity
// itself is derived from the normalised power, never from the raw world-space
// pull distance — so no camera state can reach the physics.
import { SLING } from './levels.js';

// Fast-launch tuning: deliberate draws sit ~200-600 px/s, hard flicks 2000+.
export const FLICK_MIN = 400;   // px/s below this -> no bonus
export const FLICK_REF = 1800;  // px/s for full bonus
export const BOOST_MAX = 0.45;  // +45% launch velocity at full flick

// Full-power draw length and minimum firing draw, in screen px at the
// reference framing. Converted to world units per frame via the camera.
const MAX_PULL_PX = 125, MIN_FIRE_PX = 14, GRAB_PX = 130;

// Boost factor from aim.flick (0..1). Pure function of the gesture.
export function launchBoost(aim) {
  const f = Math.max(0, Math.min(1, aim?.flick ?? 0));
  return 1 + BOOST_MAX * f;
}

export function createInput(canvas, toWorld, handlers) {
  const aim = {
    dragging: false, pointerId: null,
    ballX: SLING.x, ballY: SLING.y,
    pull: 0, power: 0, canAim: false, maxPull: MAX_PULL_PX,
    flick: 0, flickEma: 0, lastMoveT: 0, lastX: 0, lastY: 0,
    hoverX: null, hoverY: null,
  };

  // world units per screen px at the current zoom (1 at reference framing)
  const rel = () => Math.max(0.04, handlers.relScale?.() ?? 1);

  function setBall(wx, wy) {
    const maxPull = MAX_PULL_PX / rel();
    aim.maxPull = maxPull;
    let dx = wx - SLING.x, dy = wy - SLING.y;
    const d = Math.hypot(dx, dy);
    if (d > maxPull) { dx *= maxPull / d; dy *= maxPull / d; }
    // limit the forward cone: don't let the pouch push past the fork
    const fwd = maxPull * 0.48;
    if (dx > fwd) dx = fwd;
    aim.ballX = SLING.x + dx; aim.ballY = SLING.y + dy;
    aim.pull = Math.hypot(dx, dy);
    aim.power = Math.min(1, aim.pull / maxPull);
  }

  function trackSpeed(wx, wy, t) {
    // EMA of pointer speed in SCREEN px/sec; dt-based so frame-rate fair.
    // e.timeStamp may be any epoch — only deltas matter.
    const dt = (t - aim.lastMoveT) / 1000;
    if (!(dt > 0) || dt > 0.25) { aim.lastMoveT = t; aim.lastX = wx; aim.lastY = wy; return; }
    const worldPerSec = Math.hypot(wx - aim.lastX, wy - aim.lastY) / dt;
    const inst = Math.min(8000, worldPerSec * rel());
    const k = 1 - Math.exp(-dt * 18); // fast enough to catch 100ms flicks
    aim.flickEma += (inst - aim.flickEma) * k;
    aim.flick = Math.max(0, Math.min(1, (aim.flickEma - FLICK_MIN) / FLICK_REF));
    aim.lastMoveT = t; aim.lastX = wx; aim.lastY = wy;
  }

  function down(e) {
    if (e.button !== undefined && e.button !== 0) return; // pan uses the others
    if (!aim.canAim) return;
    if (aim.dragging) return;
    const w = toWorld(e);
    // generous grab radius around the pouch, constant in screen px
    const grab = Math.max(40, Math.min(900, GRAB_PX / rel()));
    if (Math.hypot(w.x - SLING.x, w.y - SLING.y) > grab) return;
    aim.dragging = true; aim.pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    aim.flick = 0; aim.flickEma = 0;
    aim.lastMoveT = e.timeStamp ?? performance.now();
    aim.lastX = w.x; aim.lastY = w.y;
    setBall(w.x, w.y);
    handlers.onAimStart?.();
    e.preventDefault();
  }
  function move(e) {
    const w = toWorld(e);
    aim.hoverX = w.x; aim.hoverY = w.y;
    if (!aim.dragging || e.pointerId !== aim.pointerId) return;
    trackSpeed(w.x, w.y, e.timeStamp ?? performance.now());
    setBall(w.x, w.y);
    handlers.onAimMove?.(aim.power);
    e.preventDefault();
  }
  function up(e) {
    if (!aim.dragging || (e.pointerId !== undefined && e.pointerId !== aim.pointerId)) return;
    aim.dragging = false; aim.pointerId = null;
    const pull = aim.pull;
    aim.pull = 0;
    // flick stays on aim for onFire -> game.fire reads the final value
    if (pull >= MIN_FIRE_PX / rel() && aim.canAim) handlers.onFire?.();
    else { aim.ballX = SLING.x; aim.ballY = SLING.y; aim.power = 0; aim.flick = 0; handlers.onAimCancel?.(); }
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const key = (e) => handlers.onKey?.(e);
  window.addEventListener('keydown', key);

  return {
    aim,
    resetAim() {
      aim.dragging = false; aim.pointerId = null;
      aim.ballX = SLING.x; aim.ballY = SLING.y; aim.pull = 0; aim.power = 0;
      aim.flick = 0; aim.flickEma = 0;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    },
  };
}
