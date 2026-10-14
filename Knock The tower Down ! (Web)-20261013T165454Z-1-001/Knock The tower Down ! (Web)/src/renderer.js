// Canvas renderer: ASCII-terminal art direction.
//
// ASCII is the visual language here, not a filter laid over conventional
// shapes. Nothing in this file draws a lit disc, a coloured gradient or a
// cartoon prop: structures, debris, scenery and readouts are all built from
// monospaced glyphs, silhouette fills and negative space. Colour is governed
// entirely by palette.js — greyscale everywhere, two accents reserved for
// information the player has to act on.
//
// Two ideas do most of the work:
//
// 1. SCALE COMES FROM COMPOSITION. The play structures are small objects in a
//    large frame. The sense of size is carried by what surrounds them — the
//    colossal monolith silhouettes on the far layer, the parallax between
//    layers, and the survey ticks running off into the distance — rather than
//    by shrinking the gameplay until it is unreadable.
//
// 2. DETAIL IS A FUNCTION OF ZOOM. Every glyph grid is sized in SCREEN pixels
//    and converted to world units through the camera, so cost is bounded at
//    any zoom while detail genuinely increases as the player moves in. A post
//    that is a six-glyph stroke in the wide shot resolves into a cracked,
//    patterned column up close. That is the reason to zoom.
import { WORLD_W, WORLD_H, GROUND_Y, SLING } from './levels.js';
import { GRAVITY, pointInOBB } from './physics.js';
import { launchBoost } from './input.js';
import { PAL, MAT, DEBRIS } from './palette.js';

const FONT = '"Courier New", Courier, monospace';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------- glyph drawing with a small style cache ----------
   Setting ctx.font per glyph is the single most expensive thing a renderer
   like this can do, so style changes are coalesced. The cache must be
   invalidated whenever the context is saved or restored. */
let _font = null, _fill = null, _alpha = null;
function gReset() { _font = null; _fill = null; _alpha = null; }
function style(g, size, color, alpha) {
  const f = `bold ${size}px ${FONT}`;
  if (f !== _font) { g.font = f; _font = f; }
  if (color !== _fill) { g.fillStyle = color; _fill = color; }
  if (alpha !== _alpha) { g.globalAlpha = alpha; _alpha = alpha; }
}
function txt(g, ch, x, y, size, color, alpha = 1) {
  style(g, size, color, alpha);
  g.fillText(ch, x, y);
}

// deterministic 0..1 from integer coords — stable patterns, no per-frame
// flicker, and no stored arrays that grow as the player pans
function hash2(x, y) {
  let h = (Math.imul(x | 0, 2654435761) ^ Math.imul(y | 0, 40503)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}
function hash3(id, x, y) {
  let h = (Math.imul(id | 0, 2654435761) ^ Math.imul(x | 0, 40503) ^ Math.imul(y | 0, 65599)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/* ---------- parallax layers ----------
   A layer is drawn in its own content space; the translate makes it track the
   camera at `p` of full rate.

   Horizontal only. Every scenery layer stands ON the ground plane, so any
   vertical offset lifts it off the dirt — at a typical framing that floats the
   near rubble a hundred-odd units above the horizon. Depth is carried by the
   horizontal rate and by how much taller the far layers are, which is how a
   ground-plane parallax is supposed to work. */
function layer(g, cv, p, fn) {
  const ox = cv.cx * (1 - p);
  g.save(); gReset();
  g.translate(ox, 0);
  fn({ x0: cv.x0 - ox, x1: cv.x1 - ox, y0: cv.y0, y1: cv.y1 });
  g.restore(); gReset();
}

export function drawScene(g, state, aim, fx, time, cv) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  gReset();

  // Screen-space shake: dividing by the scale keeps a hit feeling equally
  // strong whether the player is zoomed into a joint or watching the skyline.
  const shake = (fx.shake || 0) / cv.scale;
  g.save(); gReset();
  if (shake > 0.2 / cv.scale) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  drawSky(g, cv);
  layer(g, cv, 0.10, (v) => drawMonoliths(g, v, cv));
  layer(g, cv, 0.20, (v) => drawFarCity(g, v, cv));
  layer(g, cv, 0.30, (v) => drawGantries(g, v, cv));
  layer(g, cv, 0.62, (v) => drawRubble(g, v, cv));
  drawGround(g, cv);
  drawSling(g, state, aim, cv, time, false);
  drawAim(g, state, aim, cv);
  drawBodies(g, state, cv, time);
  drawSling(g, state, aim, cv, time, true);
  drawParticles(g, fx, cv);
  drawFloaters(g, fx, cv);
  g.restore(); gReset();

  if (fx.flash > 0.01) {
    g.globalAlpha = 1;
    g.fillStyle = `rgba(255,255,255,${(fx.flash * 0.1).toFixed(3)})`;
    g.fillRect(cv.x0 - 10, cv.y0 - 10, (cv.x1 - cv.x0) + 20, (cv.y1 - cv.y0) + 20);
    gReset();
  }
}

/* ---------- the yard: a demolition site at the foot of a dead city ---------- */

function drawSky(g, cv) {
  // not pure black — silhouettes need something to read against
  g.globalAlpha = 1;
  g.fillStyle = PAL.void;
  g.fillRect(cv.x0 - 10, cv.y0 - 10, (cv.x1 - cv.x0) + 20, (cv.y1 - cv.y0) + 20);
  gReset();
  // sparse dust, stepped in screen space so the count is bounded at any zoom
  const step = 150 / cv.scale;
  const size = clamp(11 / cv.scale, 1, 4000);
  const i0 = Math.floor(cv.x0 / step), i1 = Math.ceil(cv.x1 / step);
  const j0 = Math.floor(cv.y0 / step), j1 = Math.ceil(Math.min(cv.y1, GROUND_Y) / step);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const h = hash2(i, j * 7 + 11);
      if (h > 0.30) continue;
      txt(g, h < 0.1 ? '·' : '.', (i + h) * step, (j + hash2(i * 3, j)) * step, size, PAL.faint, 0.75);
    }
  }
}

// The scale anchors: slab towers thousands of units tall, so the 900-unit
// monument the player is dismantling reads as a toy at their feet. Drawn as
// silhouette fills with glyph-traced edges — negative space carries them, and
// tracing only the perimeter keeps the glyph count low at any zoom.
function drawMonoliths(g, v, cv) {
  // On a monument level the emphasis reverses: the skyline drops below the
  // structure the player is dismantling and thins out, so the monument is the
  // tallest thing in frame and reads as the spectacle rather than as one more
  // object at the feet of something bigger.
  const CELL = cv.epic ? 1000 : 760;
  const rowStep = clamp(15 / cv.scale, 1, 100000);
  const fsize = rowStep * 1.3;
  const i0 = Math.floor(v.x0 / CELL) - 1, i1 = Math.ceil(v.x1 / CELL) + 1;
  for (let i = i0; i <= i1; i++) {
    const h = hash2(i, 991);
    if (h > (cv.epic ? 0.52 : 0.78)) continue;    // gaps in the skyline
    const cxw = i * CELL + hash2(i, 3) * 300;
    const w = 240 + hash2(i, 7) * 300;
    const ht = cv.epic ? 380 + hash2(i, 13) * 560 : 1500 + hash2(i, 13) * 2700;
    const top = GROUND_Y - ht;
    if (cxw + w < v.x0 || cxw - w > v.x1) continue;
    const l = cxw - w / 2, r = cxw + w / 2;
    // body: darker than the sky, so the slab is a hole in the world
    g.globalAlpha = 1; g.fillStyle = PAL.black;
    g.fillRect(l, top, w, GROUND_Y - top);
    gReset();
    // traced edges
    const yA = Math.max(top, v.y0 - rowStep), yB = Math.min(GROUND_Y, v.y1 + rowStep);
    for (let y = yA; y <= yB; y += rowStep) {
      txt(g, '|', l, y, fsize, PAL.dim, 0.95);
      txt(g, '|', r, y, fsize, PAL.dim, 0.95);
    }
    if (top > v.y0 - rowStep && top < v.y1) {
      for (let x = l; x <= r; x += rowStep) txt(g, '_', x, top, fsize, PAL.grey, 0.9);
      // a broken mast on some of them
      if (hash2(i, 29) < 0.5) {
        for (let k = 1; k <= 4; k++) txt(g, '|', cxw, top - k * rowStep, fsize, PAL.dim, 0.8);
      }
    }
    // Interior texture. Enough density to give the slab mass — a pure black
    // rectangle on a near-black sky is not a silhouette, it is nothing — but
    // held at the faintest readable tone so it never competes with the
    // structure the player is actually aiming at.
    const istep = rowStep * 1.9;
    for (let y = yA; y <= yB; y += istep) {
      for (let x = l + istep * 0.5; x < r; x += istep) {
        const hh = hash2((x / istep) | 0, (y / istep) | 0);
        if (hh > 0.52) continue;
        txt(g, hh < 0.08 ? '=' : hh < 0.26 ? ':' : '.', x, y, fsize, PAL.faint, 1);
      }
    }
  }
}

// Mid distance: the dead settlement the yard was cut out of. Shorter than the
// monoliths and built from a different architectural language — setback
// tiers, broken roof lines, chimneys and sparse window marks — so the three
// far layers read as progressively nearer without any of them competing with
// the structure being dismantled. Black bodies, traced edges, faintest
// interior tone: exactly the rules the other layers already follow.
function drawFarCity(g, v, cv) {
  const CELL = 430;
  const rowStep = clamp(11 / cv.scale, 1, 100000);
  const fsize = rowStep * 1.25;
  const i0 = Math.floor(v.x0 / CELL) - 1, i1 = Math.ceil(v.x1 / CELL) + 1;
  for (let i = i0; i <= i1; i++) {
    const h = hash2(i, 1971);
    if (h > (cv.epic ? 0.40 : 0.72)) continue;     // gaps in the settlement
    const kind = hash2(i, 71);                     // roof-line personality
    const x = i * CELL + (hash2(i, 5) - 0.5) * 160;
    const w = 120 + hash2(i, 11) * 150;
    const ht = cv.epic ? 220 + hash2(i, 13) * 260 : 320 + hash2(i, 13) * 460;
    const top = GROUND_Y - ht;
    if (x + w < v.x0 || x - w > v.x1) continue;
    g.globalAlpha = 1; g.fillStyle = PAL.black;
    g.fillRect(x, top, w, GROUND_Y - top);
    gReset();
    const yA = Math.max(top, v.y0 - rowStep), yB = Math.min(GROUND_Y, v.y1 + rowStep);
    for (let y = yA; y <= yB; y += rowStep) {
      txt(g, '|', x, y, fsize, PAL.dim, 0.9);
      txt(g, '|', x + w, y, fsize, PAL.dim, 0.9);
    }
    // setbacks: one or two stepped tiers, so the silhouette is not a slab
    const tiers = hash2(i, 23) < 0.5 ? 2 : 1;
    let sx = x, sw = w, sy = top;
    for (let t = 0; t < tiers; t++) {
      if (sy > v.y1 || sy < v.y0 - rowStep) break;
      const inset = 14 + hash2(i, 30 + t) * 22;
      sx += inset; sw -= inset * 2; sy += 90 + hash2(i, 40 + t) * 60;
      if (sw < 24) break;
      for (let x2 = sx; x2 <= sx + sw; x2 += rowStep) txt(g, '_', x2, sy, fsize, PAL.grey, 0.85);
      txt(g, '|', sx, sy + rowStep * 0.5, fsize, PAL.dim, 0.8);
      txt(g, '|', sx + sw, sy + rowStep * 0.5, fsize, PAL.dim, 0.8);
    }
    // roof line, whole or broken
    if (top > v.y0 - rowStep && top < v.y1) {
      const broken = kind > 0.6;
      for (let x2 = x; x2 <= x + w; x2 += rowStep) {
        if (broken && hash2((x2 / rowStep) | 0, 7) < 0.35) continue;
        txt(g, '_', x2, top, fsize, PAL.grey, 0.9);
      }
      if (hash2(i, 53) < 0.45) {                   // a chimney or broken mast
        const mx = x + w * (0.3 + hash2(i, 59) * 0.4);
        const mh = 40 + hash2(i, 61) * 120;
        for (let k = 1; k <= Math.ceil(mh / rowStep); k++) {
          txt(g, '|', mx, top - k * rowStep, fsize, PAL.dim, 0.7);
        }
      }
    }
    // interior: sparse window marks at the faintest readable tone
    const istep = rowStep * 2.2;
    for (let y = yA + istep; y < Math.min(yB, GROUND_Y); y += istep) {
      for (let x2 = x + istep * 0.6; x2 < x + w - istep * 0.3; x2 += istep) {
        const hh = hash2((x2 / istep) | 0, (y / istep) | 0);
        if (hh > 0.16) continue;
        txt(g, hh < 0.05 ? ':' : '.', x2, y, fsize, PAL.faint, 1);
      }
    }
  }
}

// Mid distance: skeletal gantries. Open linework, so they read as structure
// without competing with the structure the player is actually shooting at.
function drawGantries(g, v, cv) {
  const CELL = 620;
  const step = clamp(16 / cv.scale, 1, 100000);
  const fsize = step * 1.3;
  const i0 = Math.floor(v.x0 / CELL) - 1, i1 = Math.ceil(v.x1 / CELL) + 1;
  for (let i = i0; i <= i1; i++) {
    const h = hash2(i, 577);
    if (h > 0.46) continue;
    const x = i * CELL + hash2(i, 31) * 420;
    const ht = 240 + hash2(i, 37) * 420;
    const top = GROUND_Y - ht;
    if (x < v.x0 - 200 || x > v.x1 + 200) continue;
    let k = 0;
    for (let y = GROUND_Y; y > top; y -= step, k++) {
      if (y > v.y1 + step || y < v.y0 - step) continue;
      txt(g, '|', x - step * 0.8, y, fsize, PAL.dim, 0.95);
      txt(g, '|', x + step * 0.8, y, fsize, PAL.dim, 0.95);
      txt(g, k % 2 ? '/' : '\\', x, y, fsize, PAL.faint, 0.9);   // cross-bracing
    }
    // the jib
    if (top > v.y0 - step && top < v.y1) {
      const jib = (hash2(i, 41) < 0.5 ? -1 : 1) * (90 + hash2(i, 43) * 140);
      const n = Math.max(2, Math.abs(jib) / step);
      for (let t = 0; t <= n; t++) txt(g, '-', x + (jib * t) / n, top, fsize, PAL.dim, 0.9);
      txt(g, '|', x + jib, top + step, fsize, PAL.faint, 0.8);
      // a sagging load cable from the mast head out along the jib: the
      // gantry reads as a machine, not a stick drawing
      const sag = Math.min(70, Math.abs(jib) * 0.4);
      const cn = Math.max(4, n);
      for (let t2 = 0; t2 <= cn; t2++) {
        const px = x + (jib * t2) / cn;
        const py = top + step * 0.5 + Math.sin((Math.PI * t2) / cn) * sag;
        txt(g, t2 % 3 === 0 ? '+' : t2 % 3 === 1 ? '/' : '\\', px, py, fsize, PAL.dim, 0.55);
      }
    }
  }
}

// Near layer: low rubble on the yard floor. Almost nothing — its job is to
// give the ground plane depth as the camera moves, not to be looked at.
function drawRubble(g, v, cv) {
  const step = clamp(26 / cv.scale, 1, 100000);
  const fsize = step * 1.0;
  const i0 = Math.floor(v.x0 / step) - 1, i1 = Math.ceil(v.x1 / step) + 1;
  for (let i = i0; i <= i1; i++) {
    const h = hash2(i, 733);
    if (h > 0.22) continue;
    const x = i * step;
    const hh = 5 + hash2(i, 17) * 18;
    for (let y = GROUND_Y - 2; y > GROUND_Y - hh; y -= step * 0.9) {
      txt(g, h < 0.09 ? '=' : ',', x, y, fsize, PAL.faint, 0.9);
    }
  }
}

function drawGround(g, cv) {
  // the dirt: flat black below the rule, so the structures sit on nothing
  g.globalAlpha = 1; g.fillStyle = PAL.black;
  g.fillRect(cv.x0 - 10, GROUND_Y, (cv.x1 - cv.x0) + 20, (cv.y1 - GROUND_Y) + 20);
  gReset();
  const step = clamp(13 / cv.scale, 0.6, 100000);
  const fsize = step * 1.35;
  const x0 = Math.floor(cv.x0 / step) * step, x1 = cv.x1 + step;
  // the horizon rule
  for (let x = x0; x <= x1; x += step) txt(g, '=', x, GROUND_Y + step * 0.2, fsize, PAL.grey, 0.95);
  // survey ticks: a quiet ruler, and the clearest cue for how far the sling is
  // from the target once the camera is pulled back
  const tick = 100;
  for (let t = Math.floor(cv.x0 / tick) * tick; t <= cv.x1 + tick; t += tick) {
    const major = Math.abs(t % 500) < 1;
    txt(g, major ? '|' : '\'', t, GROUND_Y + step * (major ? 1.5 : 1.25), fsize * (major ? 1.1 : 0.9),
      major ? PAL.dim : PAL.faint, major ? 0.95 : 0.8);
  }
  // sparse floor stipple, bounded by screen-space stepping
  const sstep = step * 2.6;
  for (let y = GROUND_Y + sstep; y < Math.min(cv.y1 + sstep, GROUND_Y + 900); y += sstep) {
    for (let x = Math.floor(cv.x0 / sstep) * sstep; x <= cv.x1 + sstep; x += sstep) {
      const h = hash2((x / sstep) | 0, (y / sstep) | 0);
      if (h > 0.22) continue;
      txt(g, h < 0.08 ? ':' : '.', x, y, fsize, PAL.faint, 0.85);
    }
  }
  // sub-surface strata: faint banding under the horizon, the clearest cue
  // that the dirt continues when the camera pulls back or pans down
  for (let k = 1; k <= 3; k++) {
    const y = GROUND_Y + 26 + k * 34;
    if (y > cv.y1) break;
    for (let x = Math.floor(cv.x0 / sstep) * sstep; x <= cv.x1 + sstep; x += sstep) {
      const h = hash2((x / sstep) | 0, k * 31);
      if (h > 0.5) continue;
      txt(g, h < 0.15 ? '~' : '=', x, y, fsize * 0.8, PAL.faint, 0.5);
    }
  }
}

/* ---------- slingshot + aim ---------- */
function slingBallPos(state, aim) {
  if (state.loaded && aim.dragging) return { x: aim.ballX, y: aim.ballY };
  if (state.loaded) return { x: SLING.x, y: SLING.y };
  return null;
}

function band(g, x0, y0, x1, y1, color, fsize, step) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(len / step));
  const ch = Math.abs(dy) > Math.abs(dx) ? '|' : '-';
  for (let i = 0; i <= steps; i++) txt(g, ch, x0 + (dx * i) / steps, y0 + (dy * i) / steps, fsize, color, 0.95);
}

function drawSling(g, state, aim, cv, t, front) {
  const { x, y } = SLING;
  const step = clamp(13 / cv.scale, 1, 100000);
  const fs = step * 1.25;
  if (!front) {
    for (let i = 0; i <= 6; i++) {
      const px = x - 3 - i * 4.4, py = y + 34 - i * 4.6;
      txt(g, '/', px, py, fs, i === 6 ? PAL.bone : PAL.dim, 1);
    }
    return;
  }
  for (let yy = y + 38; yy < GROUND_Y + 4; yy += step) txt(g, '|', x, yy, fs, PAL.dim, 1);
  txt(g, 'Y', x, y + 34, fs * 1.15, PAL.bone, 1);
  for (let i = 1; i <= 6; i++) {
    const px = x + 3 + i * 4.4, py = y + 34 - i * 4.6;
    txt(g, '\\', px, py, fs, i === 6 ? PAL.bone : PAL.dim, 1);
  }
  txt(g, '#', x - 30, y + 6, fs, PAL.bone, 1);
  txt(g, '#', x + 30, y + 6, fs, PAL.bone, 1);
  const bp = slingBallPos(state, aim);
  if (bp) {
    // the loaded shot and its bands are the one thing the player is about to
    // act with, so they carry the accent
    band(g, x - 30, y + 6, bp.x, bp.y, PAL.acc, fs, step);
    band(g, x + 30, y + 6, bp.x, bp.y, PAL.acc, fs, step);
    drawProjectile(g, bp.x, bp.y, state.loadedType, 0, cv, null, true);
  }
}

// Ballistic preview. It shows where the shot goes and where it first makes
// contact — enough to form a theory and test it, without marking weak points
// or solving the structure for the player.
function predict(state, bp, vx0, vy0) {
  const pts = [];
  let px = bp.x, py = bp.y, vx = vx0, vy = vy0;
  const dt = 1 / 26;
  let hit = null;
  for (let i = 0; i < 44; i++) {
    vy += GRAVITY * dt; px += vx * dt; py += vy * dt;
    if (py > GROUND_Y) { hit = { x: px, y: GROUND_Y, ground: true }; break; }
    pts.push({ x: px, y: py });
    for (const b of state.bodies) {
      if (b.destroyed || b.isTarget) continue;
      if (b.shape === 'rect') {
        if (Math.abs(px - b.x) > b._br + 14 || Math.abs(py - b.y) > b._br + 14) continue;
        if (pointInOBB(px, py, b)) { hit = { x: px, y: py }; break; }
      }
    }
    if (hit) break;
  }
  return { pts, hit };
}

function drawAim(g, state, aim, cv) {
  const bp = slingBallPos(state, aim);
  if (!bp || !aim.dragging || !aim.canAim || aim.power <= 0.06) return;
  const boost = launchBoost(aim);
  const bv = aimVel(aim);
  const vx = bv.x * boost, vy = bv.y * boost;
  const spd = Math.hypot(vx, vy);
  const hotShot = boost > 1.15;
  const arcCol = hotShot ? PAL.hot : PAL.acc;
  const { pts, hit } = predict(state, bp, vx, vy);
  const dotSize = clamp(14 / cv.scale, 2, 100000);
  for (let i = 0; i < pts.length; i++) {
    const a = (1 - i / (pts.length + 6)) * 0.9;
    txt(g, i % 4 === 0 ? '+' : '.', pts[i].x, pts[i].y, dotSize * (1 - i * 0.008), arcCol, a);
  }
  if (hit) {
    // first contact: the single most useful thing to know before releasing
    const s = dotSize * 1.5;
    txt(g, hit.ground ? '_' : 'X', hit.x, hit.y, s, arcCol, 1);
    txt(g, '[', hit.x - s * 0.62, hit.y, s * 0.9, arcCol, 0.8);
    txt(g, ']', hit.x + s * 0.62, hit.y, s * 0.9, arcCol, 0.8);
  }
  // ASCII power bar, anchored to the sling and sized in screen px
  const n1 = Math.round(aim.power * 10);
  const n2 = Math.min(14 - n1, Math.round(aim.power * 10 * (boost - 1)));
  const bar = '[' + '#'.repeat(n1) + '+'.repeat(n2) + '-'.repeat(Math.max(0, 14 - n1 - n2)) + ']';
  const bs = clamp(16 / cv.scale, 3, 100000);
  txt(g, bar, SLING.x, SLING.y + bs * 6.5, bs, hotShot ? PAL.hot : PAL.acc, 0.95);
  txt(g, `${Math.round(spd)} u/s${hotShot ? '  FAST' : ''}`, SLING.x, SLING.y + bs * 8.2,
    bs * 0.85, hotShot ? PAL.hot : PAL.grey, 0.9);
}

export function aimVel(aim) {
  // Launch velocity is derived from the NORMALISED power and the pull
  // direction, never from the raw world-space pull length. That is what makes
  // the shot identical at every zoom level: the camera can change how far the
  // pouch travels in world units, but not how hard the shot leaves the sling.
  const MAX_SPEED = 1300;
  const dx = SLING.x - aim.ballX, dy = SLING.y - aim.ballY;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return { x: 0, y: 0 };
  const s = (aim.power ?? 0) * MAX_SPEED;
  return { x: (dx / d) * s, y: (dy / d) * s };
}

/* ---------- bodies ---------- */
function drawBodies(g, state, cv, time) {
  const pad = 80;
  for (const b of state.bodies) {
    if (b.destroyed) continue;
    // view cull: deep zoom only pays for what is on screen
    const r = (b._br || 20) + pad;
    if (b.x + r < cv.x0 || b.x - r > cv.x1 || b.y + r < cv.y0 || b.y - r > cv.y1) continue;
    if (b.shape === 'rect') drawBlock(g, b, cv, time);
    else if (b.isTarget) drawTarget(g, b, cv, time);
    else drawProjectile(g, b.x, b.y, b.material, b.angle, cv, b, false);
  }
}

// Adaptive glyph grid. The cell is a fixed size in SCREEN pixels, so a block
// is a few strokes in the wide shot and a dense patterned slab up close —
// bounded cost, genuinely more detail as the player moves in.
const CELL_PX = 9;

function drawBlock(g, b, cv, t) {
  const M = MAT[b.material] || MAT.wood;
  const cell = CELL_PX / cv.scale;
  const cols = Math.max(1, Math.round(b.w / cell));
  const rows = Math.max(1, Math.round(b.h / cell));
  const cw = b.w / cols, chh = b.h / rows;
  const fsize = Math.max(cw, chh) * 1.32;
  const hpFrac = b.maxHp > 0 ? clamp(b.hp / b.maxHp, 0, 1) : 1;
  const stress = clamp(b.stress || 0, 0, 1);
  const flash = b.flash || 0;

  g.save(); gReset();
  g.translate(b.x, b.y); g.rotate(b.angle);

  // Occlude. Without a backing plate the scenery shows straight through every
  // block and the structures stop reading as solid objects — at a wide framing
  // that is the difference between a tower and a smear of glyphs. Glass gets a
  // barely-there plate instead, so it still reads as something you see through.
  g.globalAlpha = 1;
  g.fillStyle = PAL.black;
  if (b.material === 'glass') g.globalAlpha = 0.55;
  g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
  gReset();

  // An impact inverts the block: bone plate, black glyphs. A terminal's way of
  // shouting, and it reads at any zoom without adding a glow or a colour.
  const inverted = flash > 0.02;
  if (inverted) {
    g.globalAlpha = Math.min(0.9, flash);
    g.fillStyle = PAL.white;
    g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    gReset();
  }

  const thin = cols === 1 || rows === 1;
  const x0 = -b.w / 2 + cw / 2, y0 = -b.h / 2 + chh / 2;
  // a hashed fault line: cracks open along it as the block takes damage
  const fault = hash3(b.id, 7, 3);

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const px = x0 + ix * cw, py = y0 + iy * chh;
      const h = hash3(b.id, ix, iy);
      const edge = ix === 0 || iy === 0 || ix === cols - 1 || iy === rows - 1;
      let ch = null, col = M.tone, alpha = 0.95;

      if (thin) {
        // wide shot: the member collapses to a single stroke, oriented along
        // its own long axis so beams read as beams and posts as posts
        ch = b.w >= b.h ? M.thinH : M.thinV;
        col = M.edge;
      } else if (edge) {
        if (hpFrac < 0.34 && h < 0.5) continue;                 // the wall has opened up
        if (hpFrac < 0.62 && h < 0.3) { ch = h < 0.15 ? '/' : '\\'; col = M.dim; }
        else { ch = M.border; col = M.edge; }
      } else {
        // decorative interior pattern: braces/latticing drawn strictly inside
        // the block's physical bounds. The simulation never sees it and it
        // never implies support the block does not actually have — the same
        // technique the Lattice monument documents (look at physics.js level
        // notes in levels.js). The material's own density pattern still shows
        // through wherever no brace falls.
        let patCh = null;
        if (b.pattern && b.w >= 30 && b.h >= 30) {
          const gx = ix - (cols - 1) / 2, gy = iy - (rows - 1) / 2;
          const t = b.pattern === 'lattice' ? 2 : 3;
          const d1 = ((gx + gy) % t + t) % t, d2 = ((gx - gy) % t + t) % t;
          if (d1 === 0) patCh = '/';
          else if (d2 === 0) patCh = '\\';
        }
        if (patCh) { ch = patCh; col = M.dim; alpha = 0.55; }
        else if (h > M.density) continue;                       // material density
        else {
          ch = M.fill[Math.floor(h * 97) % M.fill.length];
          col = h < 0.3 ? M.dim : M.tone;
          // timber reads as grain: emphasise rows across the long axis
          if (b.material === 'wood' && b.w >= b.h && iy % 2 === 0 && h > 0.2) { ch = '='; col = M.dim; }
        }
      }

      // damage: the pattern degrades toward fracture glyphs before failing
      if (!thin && hpFrac < 0.72) {
        const near = Math.abs((ix / Math.max(1, cols - 1)) - fault) < 0.34;
        if (near && h > hpFrac * 0.9) { ch = h > 0.66 ? 'x' : h > 0.4 ? '/' : '\\'; col = M.edge; alpha = 1; }
      }
      // a fresh hit shows where it landed, before any damage registers
      if (stress > 0.25 && h < stress * 0.4) { ch = 'x'; col = M.edge; }
      if (inverted) col = PAL.black;
      if (ch) txt(g, ch, px, py, fsize, col, alpha);
    }
  }
  g.restore(); gReset();
}

const CORE_CH = '@';
function drawTarget(g, b, cv, t) {
  const r = b.r;
  const squash = b.squash || 0;
  const hurt = b.hp < b.maxHp * 0.5 && !b.dead;
  // Cores are the objective, so they hold the accent. At a wide framing they
  // are only a few pixels across, which is exactly when that matters most.
  const size = Math.max(r * 2.1, 11 / cv.scale);
  g.save(); gReset();
  g.translate(b.x, b.y);
  g.scale(1 + squash * 0.25, 1 - squash * 0.25);
  const ringR = Math.max(r + 8, size * 0.62);
  for (let k = 0; k < 3; k++) {
    const a = t * 2.2 + (b.coreIdx || 0) + (k * Math.PI * 2) / 3;
    const flick = hurt ? (Math.sin(t * 30 + k * 9) > 0 ? 1 : 0.25) : 1;
    txt(g, hurt ? '+' : '*', Math.cos(a) * ringR, Math.sin(a) * ringR, size * 0.5, PAL.white, 0.9 * flick);
  }
  const pulse = 1 + Math.sin(t * 4 + (b.coreIdx || 0) * 2) * 0.06;
  const alpha = hurt ? 0.65 + 0.35 * Math.abs(Math.sin(t * 12)) : 1;
  txt(g, CORE_CH, 0, 0, size * pulse, PAL.acc, alpha);
  if ((b.flash || 0) > 0.02) txt(g, '*', 0, 0, size * 1.1, PAL.white, Math.min(1, b.flash));
  g.restore(); gReset();
  if (b.touchedGround && !b.dead && !b.startsGrounded) {
    txt(g, '!', b.x, b.y - r - size * 0.8 + Math.sin(t * 6) * 3, size, PAL.hot, 1);
  }
}

export function drawProjectile(g, x, y, type, angle = 0, cv, body = null, pouch = false) {
  const r = body?.r ?? (type === 'bouncy' ? 10 : type === 'splitter' ? 11 : 13);
  const hot = (body?.boosted || 0) > 1.15;
  // Loaded in the pouch it is the player's instrument, so it takes the accent;
  // in flight it is white, and only an overdrive launch stays hot.
  const col = pouch ? PAL.acc : hot ? PAL.hot : PAL.white;
  const size = Math.max(r * 2, 10 / cv.scale);

  // motion trail: a short stroke that draws the eye to the shot in a wide frame
  if (body?.trail && body.trail.length > 1) {
    const n = body.trail.length;
    for (let i = 0; i < n; i++) {
      const tr = body.trail[i];
      txt(g, '·', tr.x, tr.y, size * 0.6, col, (i / n) * 0.5);
    }
  }
  g.save(); gReset();
  g.translate(x, y);
  if (type === 'rock') {
    txt(g, '#', 0, 0, size * 1.45, col, 1);
    g.rotate(angle || 0);
    txt(g, '#', -r * 0.55, -r * 0.35, size * 0.7, col, 0.75);
    txt(g, '#', r * 0.5, r * 0.4, size * 0.7, col, 0.75);
  } else if (type === 'bouncy') {
    txt(g, 'o', 0, 0, size * 1.6, col, 1);
    txt(g, '·', 0, 0, size * 0.7, col, 0.9);
  } else {
    g.rotate(angle || 0);
    txt(g, '*', 0, 0, size * 1.9, col, 1);
    txt(g, '+', 0, 0, size * 0.9, col, 0.85);
  }
  g.restore(); gReset();
}

/* ---------- ASCII particles / floaters ---------- */
const P_CH = { rect: '#', spark: '+', ring: 'o', dot: '.' };
export function drawParticles(g, fx, cv) {
  const minSize = 9 / cv.scale;
  for (const p of fx.particles) {
    if (p.life <= 0) continue;
    if (p.x < cv.x0 - 40 || p.x > cv.x1 + 40 || p.y < cv.y0 - 40 || p.y > cv.y1 + 40) continue;
    const a = Math.max(0, p.life / p.maxLife);
    g.save(); gReset();
    g.translate(p.x, p.y); g.rotate(p.rot);
    txt(g, p.ch || P_CH[p.shape] || '.', 0, 0, Math.max(minSize, p.size * 2.3), p.color, a);
    g.restore(); gReset();
  }
  const CH = ['*', '+', '#', '·'];
  let ci = 0;
  for (const c of fx.confetti) {
    if (c.life <= 0) continue;
    g.save(); gReset();
    g.translate(c.x, c.y); g.rotate(c.rot);
    txt(g, CH[ci++ % CH.length], 0, 0, Math.max(minSize, 15), c.color, Math.min(1, c.life));
    g.restore(); gReset();
  }
}

export function drawFloaters(g, fx, cv) {
  for (const f of fx.floaters) {
    if (f.life <= 0) continue;
    const a = Math.min(1, f.life * 2);
    const big = f.text.indexOf('COMBO') === 0 || f.text.indexOf('COLLAPSE') === 0;
    // floater text is UI, so it is sized in screen px and never shrinks away
    const size = clamp((big ? 30 : f.small ? 14 : 21) / cv.scale, 4, 100000);
    const yy = f.y - (1 - f.life / f.max) * 60;
    txt(g, f.text, f.x, yy, size, f.color, a);
  }
  gReset();
}

// kept for the module's public shape; the backdrop is stateless and procedural
export function updateDecor() {}
