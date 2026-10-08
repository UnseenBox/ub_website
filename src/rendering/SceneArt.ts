import { AWARENESS, VIEW } from '../core/Tuning';
import { TAU, Rng, clamp01, type Rect } from '../core/Mathx';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { WorldObject } from '../world/WorldObject';
import type { NoiseRipple } from '../interactions/NoiseSystem';
import {
  PALETTE,
  arcMeter,
  circle,
  halo,
  hashNoise,
  rimLightCircle,
  rimLightRect,
  roundRect,
  surveyMark,
  taperedLine,
  withAlpha,
  type Ctx,
} from './DrawUtils';

/**
 * Which lamp dominates a point, and how hard. Rim lighting needs a direction to
 * point at, and taking the single strongest source gives a crisp, readable edge
 * rather than the mush you get from averaging every light in the room.
 */
export interface DominantLight {
  x: number;
  y: number;
  strength: number;
}

export function dominantLight(room: Room, x: number, y: number, out: DominantLight): DominantLight {
  out.x = VIEW.width * 0.5;
  out.y = -200;
  out.strength = 0;
  for (const l of room.lights) {
    if (!l.on) continue;
    const c = l.contributionAt(x, y);
    if (c > out.strength) {
      out.strength = c;
      out.x = l.x;
      out.y = l.y;
    }
  }
  return out;
}

const SCRATCH_LIGHT: DominantLight = { x: 0, y: 0, strength: 0 };

// --- the room --------------------------------------------------------------

/**
 * The floor is a measured surface. Every room in the building has been surveyed
 * by somebody, and the crosses they left are the one motif that carries through
 * all twelve of them.
 */
export function drawFloor(ctx: Ctx, room: Room): void {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Large, soft unevenness in the concrete. Static, so it never boils.
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const x = hashNoise(i * 3.1, 1.7) * VIEW.width;
    const y = hashNoise(i * 7.3, 5.1) * VIEW.height;
    const r = 60 + hashNoise(i * 2.2, 9.4) * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = hashNoise(i * 11.9, 3.3) > 0.5;
    g.addColorStop(0, withAlpha(dark ? PALETTE.floorDeep : PALETTE.wallTop, 0.09));
    g.addColorStop(1, withAlpha(dark ? PALETTE.floorDeep : PALETTE.wallTop, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Survey marks.
  const step = 96;
  for (let y = step * 0.75; y < VIEW.height; y += step) {
    for (let x = step * 0.75; x < VIEW.width; x += step) {
      surveyMark(ctx, x, y, 7, 0.5);
    }
  }

  // Scuffed arcs where doors have swung and furniture has been dragged.
  ctx.save();
  ctx.strokeStyle = withAlpha(PALETTE.floorMark, 0.18);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = hashNoise(i * 17.3, 2.9) * VIEW.width;
    const y = hashNoise(i * 5.7, 13.1) * VIEW.height;
    const r = 40 + hashNoise(i * 4.4, 8.8) * 70;
    const a0 = hashNoise(i * 9.1, 1.1) * TAU;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + 1.1);
    ctx.stroke();
  }
  ctx.restore();

  void room;
}

/**
 * Walls are extruded slabs: a pale face, a brighter cap, a hard black shadow
 * underneath, and a rim on whichever side the light is on.
 */
export function drawWalls(ctx: Ctx, walls: readonly Rect[], room: Room): void {
  for (const w of walls) {
    // Contact shadow first, so it sits under the slab.
    ctx.fillStyle = withAlpha(PALETTE.wallShadow, 0.85);
    ctx.fillRect(w.x - 2, w.y + 3, w.w + 4, w.h + 7);
  }
  for (const w of walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(w.x, w.y, w.w, Math.min(6, w.h));

    const l = dominantLight(room, w.x + w.w * 0.5, w.y + w.h * 0.5, SCRATCH_LIGHT);
    rimLightRect(ctx, w.x, w.y, w.w, w.h, l.x, l.y, 0.25 + l.strength * 0.75, 1.8);
  }
}

/** Dried blood. Authored into rooms as set dressing, and splashed on death. */
export interface BloodDecal {
  x: number;
  y: number;
  size: number;
  seed: number;
  fresh: number;
}

export function drawBlood(ctx: Ctx, decals: readonly BloodDecal[]): void {
  ctx.save();
  for (const d of decals) {
    const rng = new Rng(d.seed);
    ctx.fillStyle = d.fresh > 0.5 ? PALETTE.blood : PALETTE.bloodDark;

    // A pool is one ragged outline, not a pile of circles: sample a closed loop
    // with a radius that lurches, and let it spread along one axis the way a
    // liquid does on a flat floor.
    const spread = rng.range(0.9, 1.5);
    const lean = rng.next() * TAU;
    const points = 26;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * TAU;
      const wobble =
        0.62 +
        Math.sin(a * 3 + d.seed) * 0.17 +
        Math.sin(a * 7 - d.seed * 0.5) * 0.1 +
        rng.range(-0.06, 0.06);
      const r = d.size * wobble;
      const px = Math.cos(a) * r * spread;
      const py = Math.sin(a) * r * 0.72;
      const x = d.x + px * Math.cos(lean) - py * Math.sin(lean);
      const y = d.y + px * Math.sin(lean) + py * Math.cos(lean);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Runs: thin fingers creeping away from the mass along the floor.
    for (let i = 0; i < 5; i++) {
      const a = lean + rng.range(-0.9, 0.9) + (rng.chance(0.5) ? Math.PI : 0);
      const len = d.size * rng.range(0.6, 1.4);
      const w = rng.range(1.4, 3.6);
      ctx.beginPath();
      ctx.moveTo(d.x + Math.cos(a) * d.size * 0.5, d.y + Math.sin(a) * d.size * 0.36);
      ctx.lineTo(
        d.x + Math.cos(a + 0.12) * (d.size * 0.5 + len),
        d.y + Math.sin(a + 0.12) * (d.size * 0.36 + len * 0.7),
      );
      ctx.lineWidth = w;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Flung droplets, small and sharp.
    for (let i = 0; i < 16; i++) {
      const a = rng.next() * TAU;
      const r = d.size * rng.range(0.7, 2.1);
      const rr = rng.range(0.7, 2.6);
      ctx.beginPath();
      ctx.ellipse(
        d.x + Math.cos(a) * r * spread,
        d.y + Math.sin(a) * r * 0.7,
        rr,
        rr * rng.range(0.5, 0.9),
        a,
        0,
        TAU,
      );
      ctx.fill();
    }

    if (d.fresh > 0.5) {
      // Wet blood catches a highlight. Dried blood does not.
      ctx.fillStyle = withAlpha('#ff5a6e', 0.3);
      ctx.beginPath();
      ctx.ellipse(d.x - d.size * 0.2, d.y - d.size * 0.18, d.size * 0.26, d.size * 0.12, lean, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function shadowBlob(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(8,10,14,${alpha})`);
  g.addColorStop(1, 'rgba(8,10,14,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(0.001, rx));
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  circle(ctx, x, y, rx);
  ctx.fill();
  ctx.restore();
}

// --- props: the lit body ----------------------------------------------------

/**
 * The solid, light-receiving part of a prop. Anything that glows is drawn later,
 * in `drawObjectEmissive`, so that the lighting pass cannot dim it.
 */
export function drawObjectBody(ctx: Ctx, o: WorldObject, room: Room): void {
  if (!o.revealed || o.taken) return;
  const x = o.x;
  const y = o.y;
  const w = o.w;
  const h = o.h;

  shadowBlob(ctx, x, y + h * 0.4, w * 0.62, h * 0.26, 0.75);

  const l = dominantLight(room, x, y, SCRATCH_LIGHT);
  const rim = 0.2 + l.strength * 0.8;

  ctx.save();
  switch (o.def.art) {
    case 'door':
      drawDoorBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'exit':
      drawExitBody(ctx, x, y, w, h);
      break;
    case 'lamp':
      drawLampBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'locker':
      drawLockerBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'table':
      drawTableBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'drawer':
      drawDrawerBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'fan':
      drawFanBody(ctx, o, x, y, w, l, rim);
      break;
    case 'chair':
      drawChairBody(ctx, x, y, w, h, l, rim);
      break;
    case 'glass':
      drawGlassBody(ctx, o, x, y, w, h, l, rim);
      break;
    case 'key':
    case 'trinket':
      // Carryables are pure glow. Nothing to light.
      break;
    case 'mirror':
      drawMirrorBody(ctx, x, y, w, h, l, rim);
      break;
    case 'switch':
    case 'button':
    case 'panel':
    case 'alarm':
    case 'phone':
    case 'radio':
    case 'screen':
    case 'projector':
    case 'clock':
    case 'vent':
    case 'block':
    default:
      slab(ctx, x, y, w, h, l, rim, o.def.art === 'block' ? 2 : 2);
      break;
  }
  ctx.restore();
}

/** The default prop: a pale box with a dark outline and a lit edge. */
function slab(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  l: DominantLight,
  rim: number,
  radius = 2,
): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, radius);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.5, w, h, l.x, l.y, rim);
}

function drawDoorBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  ctx.save();
  ctx.translate(x, y - h * 0.5);
  ctx.rotate(-o.open * 1.1);
  roundRect(ctx, -w * 0.5, 0, w, h, 1);
  ctx.fillStyle = PALETTE.propDeep;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.5, w, h, l.x, l.y, rim * (1 - o.open));
}

function drawExitBody(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  // A hole in the wall. It is never lit; it is where the light stops.
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = '#05070a';
  ctx.fill();
}

function drawLampBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  ctx.strokeStyle = PALETTE.propDeep;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.45);
  ctx.lineTo(x, y - h * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.1);
  ctx.lineTo(x + w * 0.5, y - h * 0.1);
  ctx.lineTo(x + w * 0.3, y - h * 0.45);
  ctx.lineTo(x - w * 0.3, y - h * 0.45);
  ctx.closePath();
  ctx.fillStyle = o.isOn ? PALETTE.propLit : PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.45, w, h * 0.35, l.x, l.y, rim);
}

function drawLockerBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  slab(ctx, x, y, w, h, l, rim);
  ctx.fillStyle = withAlpha('#04060a', 0.95 * o.open);
  ctx.fillRect(x - w * 0.42, y - h * 0.42, w * 0.84, h * 0.84);
  ctx.save();
  ctx.translate(x - w * 0.42, y);
  ctx.rotate(-o.open * 1.0);
  ctx.fillStyle = PALETTE.propDeep;
  ctx.fillRect(0, -h * 0.42, w * 0.84, h * 0.84);
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(0, -h * 0.42, w * 0.84, h * 0.84);
  ctx.fillStyle = PALETTE.propLit;
  ctx.fillRect(w * 0.7, -3, 3, 7);
  ctx.restore();
  // Slatted vents, which is most of what makes a locker read as a locker.
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = y - h * 0.3 + i * 7;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.2, yy);
    ctx.lineTo(x + w * 0.2, yy);
    ctx.stroke();
  }
}

function drawTableBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  ctx.fillStyle = withAlpha('#0a0d12', 0.6);
  roundRect(ctx, x - w * 0.5 + 3, y - h * 0.5 + 5, w, h, 3);
  ctx.fill();
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 3);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.5, w, h, l.x, l.y, rim);
  if (o.occupied) {
    ctx.fillStyle = withAlpha('#04060a', 0.8);
    roundRect(ctx, x - w * 0.3, y - h * 0.22, w * 0.6, h * 0.5, 3);
    ctx.fill();
  }
}

function drawDrawerBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  slab(ctx, x, y, w, h, l, rim);
  const slide = o.open * 8;
  roundRect(ctx, x - w * 0.42, y - h * 0.22 + slide, w * 0.84, h * 0.46, 1);
  ctx.fillStyle = o.open > 0.4 ? '#04060a' : PALETTE.propDeep;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PALETTE.propLit;
  ctx.fillRect(x - 5, y + h * 0.02 + slide, 10, 2);
}

function drawFanBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, l: DominantLight, rim: number): void {
  circle(ctx, x, y, w * 0.5);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const spin = o.isOn ? o.animPhase * 9 : o.animPhase * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, o.isOn ? 0.5 : 0.9);
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.36, 0);
    ctx.stroke();
  }
  ctx.restore();
  rimLightCircle(ctx, x, y, w * 0.5, l.x, l.y, rim);
}

function drawChairBody(ctx: Ctx, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  roundRect(ctx, x - w * 0.4, y - h * 0.2, w * 0.8, h * 0.6, 2);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.propDeep;
  ctx.fillRect(x - w * 0.4, y - h * 0.5, w * 0.8, 4);
  rimLightRect(ctx, x - w * 0.4, y - h * 0.5, w * 0.8, h, l.x, l.y, rim);
}

function drawGlassBody(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  if (o.state === 'broken') return;
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = withAlpha(PALETTE.propLit, 0.5);
  ctx.fill();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.5, w, h, l.x, l.y, rim * 1.3, 1.2);
}

function drawMirrorBody(ctx: Ctx, x: number, y: number, w: number, h: number, l: DominantLight, rim: number): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = PALETTE.propLit;
  ctx.fill();
  rimLightRect(ctx, x - w * 0.5, y - h * 0.5, w, h, l.x, l.y, rim * 1.4, 2);
}

// --- props: the part that glows ---------------------------------------------

/** Everything about a prop that light cannot dim. Drawn after the light pass. */
export function drawObjectEmissive(
  ctx: Ctx,
  o: WorldObject,
  hovered: boolean,
  reachable: boolean,
): void {
  if (!o.revealed || o.taken) return;
  const t = o.animPhase;
  const x = o.x;
  const y = o.y;
  const w = o.w;
  const h = o.h;

  switch (o.def.art) {
    case 'key':
      emissiveKey(ctx, x, y, t);
      break;
    case 'trinket':
      halo(ctx, x, y, 18, PALETTE.warm, 0.3);
      roundRect(ctx, x - w * 0.5, y - h * 0.5 + Math.sin(t * 1.6), w, h, 1);
      ctx.strokeStyle = withAlpha(PALETTE.warm, 0.9);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    case 'exit':
      emissiveExit(ctx, o, x, y, w, h, t);
      break;
    case 'switch':
      if (o.state === 'on') {
        ctx.fillStyle = withAlpha(PALETTE.warm, 0.95);
        ctx.fillRect(x - w * 0.22, y - h * 0.34, w * 0.44, h * 0.3);
        halo(ctx, x, y, 16, PALETTE.warm, 0.3);
      }
      break;
    case 'panel':
      ctx.fillStyle = o.state === 'on' ? PALETTE.warm : PALETTE.alarm;
      circle(ctx, x, y + h * 0.38, 2.4);
      ctx.fill();
      halo(ctx, x, y + h * 0.38, 14, o.state === 'on' ? PALETTE.warm : PALETTE.alarm, 0.25);
      break;
    case 'button':
      circle(ctx, x, y, w * 0.26);
      ctx.fillStyle = o.isOn ? PALETTE.eye : withAlpha(PALETTE.alarm, 0.8);
      ctx.fill();
      halo(ctx, x, y, 15, o.isOn ? PALETTE.eye : PALETTE.alarm, 0.3);
      break;
    case 'lamp':
      if (o.isOn) halo(ctx, x, y - h * 0.1, 40 + Math.sin(t * 2) * 3, PALETTE.warm, 0.5);
      break;
    case 'phone':
      if (o.state === 'ringing') emissiveRinging(ctx, x, y, t);
      break;
    case 'radio':
      if (o.isOn) emissiveRadio(ctx, o, x, y, w, h, t);
      break;
    case 'screen':
      if (o.isOn) emissiveScreen(ctx, x, y, w, h, t);
      break;
    case 'projector':
      if (o.isOn) emissiveProjector(ctx, x, y, w, t);
      break;
    case 'alarm':
      if (o.isOn) emissiveAlarm(ctx, x, y, t);
      break;
    case 'mirror':
      if (o.isOn) halo(ctx, x, y, 44, PALETTE.eye, 0.3);
      break;
    case 'glass':
      if (o.state === 'broken') emissiveBrokenGlass(ctx, o, x, y, w);
      break;
    case 'clock':
      if (o.isOn) {
        const a = t * 1.2;
        ctx.strokeStyle = withAlpha(PALETTE.propLit, 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * w * 0.3, y + Math.sin(a) * w * 0.3);
        ctx.stroke();
      }
      break;
    default:
      break;
  }

  if (o.busy) drawProgress(ctx, o);

  if (hovered && o.def.interactable) {
    drawHoverBrackets(ctx, o, reachable, t);
  }
}

function emissiveKey(ctx: Ctx, x: number, y: number, t: number): void {
  const bob = Math.sin(t * 2) * 1.2;
  halo(ctx, x, y + bob, 30, PALETTE.gold, 0.5);
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  circle(ctx, -5, 0, 3.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1.6, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(4, 0);
  ctx.lineTo(4, 3.4);
  ctx.moveTo(6.6, 0);
  ctx.lineTo(6.6, 2.6);
  ctx.stroke();
  ctx.restore();
}

function emissiveExit(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  const open = o.state === 'open';
  if (open) {
    halo(ctx, x, y, 70 + Math.sin(t * 2.4) * 6, PALETTE.eye, 0.45);
    ctx.strokeStyle = withAlpha(PALETTE.eye, 0.95);
    ctx.lineWidth = 2;
    roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
    ctx.stroke();
    // A floor spill, so the way out is visible from across the room.
    const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
    g.addColorStop(0, withAlpha(PALETTE.eye, 0.18));
    g.addColorStop(1, withAlpha(PALETTE.eye, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 120, y - 120, 240, 240);
    return;
  }
  ctx.strokeStyle = withAlpha(PALETTE.alarm, 0.75);
  ctx.lineWidth = 1.4;
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.stroke();
  ctx.fillStyle = withAlpha(PALETTE.alarm, 0.85);
  ctx.fillRect(x - 4, y - 2, 8, 5);
  ctx.beginPath();
  ctx.arc(x, y - 2, 3, Math.PI, 0);
  ctx.stroke();
}

function emissiveRinging(ctx: Ctx, x: number, y: number, t: number): void {
  const r = 18 + ((t * 90) % 56);
  ctx.strokeStyle = withAlpha(PALETTE.warm, Math.max(0, 0.75 - r / 80));
  ctx.lineWidth = 1.8;
  circle(ctx, x, y, r);
  ctx.stroke();
  halo(ctx, x, y, 46, PALETTE.warm, 0.45);
}

function emissiveRadio(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  ctx.strokeStyle = withAlpha(PALETTE.eye, 0.95);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const bar = 2 + Math.abs(Math.sin(t * 6 + i)) * 6;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.34 + i * 5, y + h * 0.2);
    ctx.lineTo(x - w * 0.34 + i * 5, y + h * 0.2 - bar);
    ctx.stroke();
  }
  halo(ctx, x, y, 34, PALETTE.eye, 0.22);
  void o;
}

function emissiveScreen(ctx: Ctx, x: number, y: number, w: number, h: number, t: number): void {
  const flick = 0.5 + Math.abs(Math.sin(t * 13)) * 0.5;
  roundRect(ctx, x - w * 0.4, y - h * 0.34, w * 0.8, h * 0.6, 1);
  ctx.fillStyle = withAlpha(PALETTE.cold, 0.55 + flick * 0.35);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#ffffff', 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const yy = y - h * 0.26 + i * h * 0.18 + ((t * 30) % (h * 0.18));
    ctx.beginPath();
    ctx.moveTo(x - w * 0.36, yy);
    ctx.lineTo(x + w * 0.36, yy);
    ctx.stroke();
  }
  halo(ctx, x, y, 62, PALETTE.cold, 0.4);
}

function emissiveProjector(ctx: Ctx, x: number, y: number, w: number, t: number): void {
  circle(ctx, x + w * 0.34, y, 4);
  ctx.fillStyle = PALETTE.cold;
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const len = 170;
  ctx.fillStyle = withAlpha(PALETTE.cold, 0.1 + Math.sin(t * 9) * 0.03);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.34, y);
  ctx.lineTo(x + w * 0.34 + len, y - 48);
  ctx.lineTo(x + w * 0.34 + len, y + 48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  halo(ctx, x, y, 38, PALETTE.cold, 0.3);
}

function emissiveAlarm(ctx: Ctx, x: number, y: number, t: number): void {
  const r = 20 + ((t * 170) % 100);
  ctx.strokeStyle = withAlpha(PALETTE.alarm, Math.max(0, 0.85 - r / 120));
  ctx.lineWidth = 2;
  circle(ctx, x, y, r);
  ctx.stroke();
  halo(ctx, x, y, 60, PALETTE.alarm, 0.5);
}

function emissiveBrokenGlass(ctx: Ctx, o: WorldObject, x: number, y: number, w: number): void {
  ctx.strokeStyle = withAlpha(PALETTE.cold, 0.7);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + o.animPhase * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * w * 1.2, y + Math.sin(a) * w * 0.8);
    ctx.stroke();
  }
}

/**
 * Hover feedback as four corner brackets rather than a dashed box. It reads as a
 * targeting reticle, which is the right language for a game about pointing.
 */
function drawHoverBrackets(ctx: Ctx, o: WorldObject, reachable: boolean, t: number): void {
  const col = reachable ? PALETTE.eye : PALETTE.fogDim;
  const pad = 6 + Math.sin(t * 4) * 1.2;
  const x = o.x - o.w * 0.5 - pad;
  const y = o.y - o.h * 0.5 - pad;
  const w = o.w + pad * 2;
  const h = o.h + pad * 2;
  const arm = Math.min(8, Math.min(w, h) * 0.35);

  ctx.save();
  ctx.strokeStyle = withAlpha(col, reachable ? 0.95 : 0.45);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + arm); ctx.lineTo(x, y); ctx.lineTo(x + arm, y);
  ctx.moveTo(x + w - arm, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + arm);
  ctx.moveTo(x + w, y + h - arm); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - arm, y + h);
  ctx.moveTo(x + arm, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - arm);
  ctx.stroke();
  ctx.restore();
}

function drawProgress(ctx: Ctx, o: WorldObject): void {
  const w = 28;
  const y = o.y - o.h * 0.5 - 11;
  ctx.fillStyle = withAlpha('#000000', 0.8);
  ctx.fillRect(o.x - w * 0.5 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = PALETTE.eye;
  ctx.fillRect(o.x - w * 0.5, y, w * clamp01(o.progress), 3);
}

// --- the character ---------------------------------------------------------

export function drawPlayer(ctx: Ctx, p: Player, room: Room): void {
  if (p.hidden) return;
  const breathe = Math.sin(p.breathPhase) * 0.6;
  const swing = Math.sin(p.walkPhase) * 3.4;
  const lean = Math.cos(p.facing) * 1.2;
  const l = dominantLight(room, p.x, p.y, SCRATCH_LIGHT);

  shadowBlob(ctx, p.x, p.y + 9, 12, 4.5, 0.85);

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.strokeStyle = PALETTE.propDeep;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-2 + swing * 0.5, 9);
  ctx.moveTo(2, 2);
  ctx.lineTo(2 - swing * 0.5, 9);
  ctx.stroke();

  ctx.fillStyle = p.dead ? PALETTE.bloodDark : PALETTE.prop;
  taperedLine(ctx, lean * 0.5, -10 + breathe, 0, 4, 5.6, 4.2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.fillStyle = p.dead ? PALETTE.bloodDark : PALETTE.propEdge;
  circle(ctx, lean * 0.7, -14 + breathe, 4.5);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.wallShadow, 0.9);
  ctx.stroke();
  ctx.restore();

  rimLightCircle(ctx, p.x + lean * 0.7, p.y - 14 + breathe, 4.5, l.x, l.y, 0.35 + l.strength * 0.65, 1.4);
  rimLightRect(ctx, p.x - 5, p.y - 10, 10, 14, l.x, l.y, 0.25 + l.strength * 0.6, 1.3);
}

/** The character's own faint presence, drawn after the light so it is never lost. */
export function drawPlayerMarker(ctx: Ctx, p: Player, time: number): void {
  if (p.hidden) {
    const a = 0.2 + Math.sin(time * 2.2) * 0.08;
    halo(ctx, p.x, p.y, 18, PALETTE.eye, a);
    return;
  }
  halo(ctx, p.x, p.y + 2, 24, PALETTE.player, 0.07);
  if (p.panic > 0.4) halo(ctx, p.x, p.y - 6, 30, PALETTE.alarm, (p.panic - 0.4) * 0.3);
}

// --- creatures -------------------------------------------------------------

function eyeColor(tell: number, asleep: boolean): string {
  if (asleep) return PALETTE.eyeDim;
  if (tell >= 0.95) return PALETTE.alarm;
  if (tell >= AWARENESS.alert) return '#ff9a5a';
  if (tell >= AWARENESS.investigate) return PALETTE.warm;
  if (tell >= AWARENESS.suspicious) return '#e4e97d';
  return PALETTE.eyeDim;
}

/**
 * The creature's body, drawn before the light.
 *
 * It is painted in near black, so the lighting pass cannot lift it: whatever the
 * room is burning with, these things stay holes in it. That is the whole read of
 * the reference image, and it means a creature is always legible as an absence.
 */
export function drawEnemyBody(ctx: Ctx, e: Enemy): void {
  const t = e.animPhase;
  const asleep = e.looksAsleep && e.state.current === 'IDLE';
  const breathe = Math.sin(t * (asleep ? 0.9 : 1.8 + e.tell * 3)) * (asleep ? 1.6 : 0.9);
  const h = e.def.height;

  shadowBlob(ctx, e.x, e.y + h * 0.12, e.def.awareness.bodyRadius * 1.6, 6, 0.9);

  ctx.save();
  ctx.translate(e.x, e.y);
  switch (e.def.kind) {
    case 'HOUND':
      houndBody(ctx, e, breathe, t);
      break;
    case 'SLEEPER':
      sleeperBody(ctx, breathe, asleep);
      break;
    case 'MIRROR':
      mirrorBody(ctx, e, breathe);
      break;
    case 'SCOUT':
      scoutBody(ctx, e, breathe, t);
      break;
    case 'PARASITE':
      parasiteBody(ctx, e, breathe);
      break;
    case 'ANALYST':
      tallBody(ctx, e, breathe, h, 'analyst');
      break;
    case 'MIMIC':
      tallBody(ctx, e, breathe, h, 'mimic');
      break;
    case 'LIAR':
      tallBody(ctx, e, breathe, h, 'liar');
      break;
    case 'WATCHER':
    default:
      tallBody(ctx, e, breathe, h, 'watcher');
      break;
  }
  ctx.restore();
}

const BODY = '#04060a';
const BODY_EDGE = '#141a22';

function tallBody(
  ctx: Ctx,
  e: Enemy,
  breathe: number,
  h: number,
  variant: 'watcher' | 'liar' | 'mimic' | 'analyst',
): void {
  const sway = Math.sin(e.animPhase * 0.7) * 1.4;
  const top = -h + breathe;

  ctx.fillStyle = BODY;
  taperedLine(ctx, sway * 0.5, top + 12, 0, 8, 9.5, 13);
  ctx.fill();
  ctx.strokeStyle = BODY_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();

  const lift = clamp01(e.tell) * 0.8;
  ctx.strokeStyle = BODY;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, top + 20);
  ctx.lineTo(-11 - lift * 5, top + 36 - lift * 12);
  ctx.moveTo(7, top + 20);
  ctx.lineTo(11 + lift * 5, top + 36 - lift * 12);
  ctx.stroke();

  ctx.save();
  ctx.translate(sway * 0.7, top + 4);
  ctx.rotate(e.facing + Math.PI * 0.5);
  ctx.fillStyle = BODY;
  if (variant === 'analyst') {
    roundRect(ctx, -11, -6, 22, 12, 2);
    ctx.fill();
  } else {
    circle(ctx, 0, 0, 8.8);
    ctx.fill();
  }
  ctx.restore();
}

function houndBody(ctx: Ctx, e: Enemy, breathe: number, t: number): void {
  const gait = Math.sin(t * (4 + e.moveSpeedNow * 0.06)) * 3;
  ctx.save();
  ctx.rotate(e.facing);
  ctx.strokeStyle = BODY;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const bx = -10 + (i % 2) * 20;
    const by = i < 2 ? -7 : 7;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (i % 2 ? gait : -gait), by + 9);
    ctx.stroke();
  }
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 9.5 + breathe * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(21, 0, 9.5, 6.4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function sleeperBody(ctx: Ctx, breathe: number, asleep: boolean): void {
  const rise = asleep ? 0 : 10;
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, -8 - rise * 0.4, 25, 15 + breathe + rise * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -8 - rise * 0.4, 25, 6, 0, 0, Math.PI);
  ctx.fill();
}

function mirrorBody(ctx: Ctx, e: Enemy, breathe: number): void {
  const h = e.def.height;
  ctx.fillStyle = BODY;
  taperedLine(ctx, 0, -h + breathe, 0, 6, 5.5, 9.5);
  ctx.fill();
}

function scoutBody(ctx: Ctx, e: Enemy, breathe: number, t: number): void {
  const h = e.def.height;
  const hop = Math.abs(Math.sin(t * 5)) * (e.moveSpeedNow > 4 ? 2.4 : 0.4);
  ctx.save();
  ctx.translate(0, -hop);
  ctx.strokeStyle = BODY;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = e.facing + Math.PI + (i - 1) * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(Math.cos(a) * 9, -h * 0.4 + 12 + Math.sin(a) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = BODY;
  circle(ctx, 0, -h * 0.55 + breathe, 9.4);
  ctx.fill();
  ctx.restore();
}

function parasiteBody(ctx: Ctx, e: Enemy, breathe: number): void {
  const h = e.def.height;
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.45, 16.5 + breathe * 0.5, h * 0.45 + breathe, 0, 0, TAU);
  ctx.fill();
}

/**
 * The aperture, the tell, and the flinch. Drawn after the light pass, because a
 * creature's eye is the brightest thing in any room it is standing in.
 */
export function drawEnemyEye(ctx: Ctx, e: Enemy): void {
  const tell = e.tell;
  const asleep = e.looksAsleep && e.state.current === 'IDLE';
  const col = eyeColor(tell, asleep);
  const t = e.animPhase;
  const breathe = Math.sin(t * (asleep ? 0.9 : 1.8 + tell * 3)) * (asleep ? 1.6 : 0.9);
  const h = e.def.height;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = col;
  ctx.shadowBlur = 12 + clamp01(tell) * 26;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;

  switch (e.def.kind) {
    case 'HOUND': {
      ctx.save();
      ctx.rotate(e.facing);
      ctx.fillRect(24, -1.6 - clamp01(tell) * 1.6, 5.5, 3.2 + clamp01(tell) * 3.2);
      ctx.restore();
      break;
    }
    case 'SLEEPER': {
      const rise = asleep ? 0 : 10;
      ctx.save();
      ctx.translate(0, -14 - rise * 0.5);
      ctx.rotate(e.facing + Math.PI * 0.5);
      if (asleep) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(6, 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 2, 6.4, 2.4 + clamp01(tell) * 2.6, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'MIRROR': {
      ctx.save();
      ctx.translate(0, -h * 0.62);
      ctx.rotate(e.facing);
      ctx.fillRect(0, -1.2, 16 + clamp01(tell) * 18, 2.4);
      circle(ctx, 0, 0, 4.4);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'SCOUT': {
      ctx.save();
      ctx.translate(0, -h * 0.55 + breathe);
      ctx.rotate(e.facing);
      circle(ctx, 5, 0, 2.8 + clamp01(tell) * 1.8);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'PARASITE': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + Math.sin(t * 0.4 + i) * 0.1;
        const r = 10;
        const open = 1 + clamp01(tell) * 2.2 + Math.sin(t * 1.3 + i * 2) * 0.4;
        circle(ctx, Math.cos(a) * r, -h * 0.45 + Math.sin(a) * r * 1.2, open);
        ctx.fill();
      }
      break;
    }
    default: {
      const sway = Math.sin(t * 0.7) * 1.4;
      const top = -h + breathe;
      ctx.save();
      ctx.translate(sway * 0.7, top + 4);
      ctx.rotate(e.facing + Math.PI * 0.5);
      const open = 1.6 + clamp01(tell) * 4.4;
      if (e.def.kind === 'MIMIC') {
        ctx.beginPath();
        ctx.moveTo(0, 7.4);
        ctx.lineTo(-3.6, -5.2);
        ctx.lineTo(0, -2.8);
        ctx.lineTo(3.6, -5.2);
        ctx.closePath();
        ctx.fill();
      } else if (e.def.kind === 'LIAR') {
        ctx.fillRect(-5.6, 3.2 - open * 0.5, 4.6, open);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(1, 2, 4.6, 2.4);
        ctx.globalAlpha = 1;
      } else if (e.def.kind === 'ANALYST') {
        ctx.fillRect(-9, 1 - open * 0.3, 18, open * 0.6);
        ctx.lineWidth = 1;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3, 3);
          ctx.lineTo(i * 3, 6);
          ctx.stroke();
        }
      } else {
        ctx.fillRect(-5.2, 3.4 - open * 0.5, 10.4, open);
      }
      ctx.restore();
      break;
    }
  }
  ctx.restore();

  if (tell > 0.04) {
    arcMeter(ctx, e.x, e.y - e.def.height * 0.78, 16, clamp01(tell), col, 0.6 + tell * 0.4, 2.2);
  }
  if (e.flinch > 0.02) {
    halo(ctx, e.x, e.y - e.def.height * 0.4, 52, col, e.flinch * 0.22);
  }
}

// --- feedback --------------------------------------------------------------

/**
 * The lamps themselves: panels of white light overhead, mullioned like a strip
 * fitting. These are the only things in the room brighter than the cursor, and
 * they are what stops a lit room looking like a tinted one.
 */
export function drawLightFixtures(ctx: Ctx, room: Room): void {
  for (const l of room.lights) {
    if (!l.fixture) continue;
    const w = l.fixture.w;
    const h = l.fixture.h;
    const cx = l.fixture.x ?? l.x;
    const cy = l.fixture.y ?? l.y;
    const x = cx - w * 0.5;
    const y = cy - h * 0.5;
    const lit = l.on ? clamp01(l.intensity * l.flicker) : 0;

    ctx.save();
    if (lit > 0.01) {
      // The throw of the panel onto the floor directly beneath it.
      const g = ctx.createLinearGradient(0, y - h, 0, y + h * 3.5);
      g.addColorStop(0, withAlpha(l.tint, 0));
      g.addColorStop(0.3, withAlpha(l.tint, 0.17 * lit));
      g.addColorStop(1, withAlpha(l.tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.12, y - h, w * 1.24, h * 4.5);
      halo(ctx, cx, cy, Math.max(w, h) * 1.1, l.tint, 0.3 * lit);
    }

    roundRect(ctx, x, y, w, h, 2);
    ctx.fillStyle = lit > 0.01 ? withAlpha('#ffffff', 0.55 + lit * 0.45) : '#11161c';
    ctx.fill();
    ctx.strokeStyle = withAlpha(lit > 0.01 ? '#ffffff' : PALETTE.propEdge, 0.6);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Mullions.
    ctx.strokeStyle = withAlpha('#5f7183', lit > 0.01 ? 0.55 : 0.8);
    ctx.lineWidth = 1.1;
    const cells = Math.max(2, Math.round(w / 22));
    ctx.beginPath();
    for (let i = 1; i < cells; i++) {
      const cx = x + (i / cells) * w;
      ctx.moveTo(cx, y + 1);
      ctx.lineTo(cx, y + h - 1);
    }
    ctx.moveTo(x + 1, y + h * 0.5);
    ctx.lineTo(x + w - 1, y + h * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawNoise(ctx: Ctx, ripples: readonly NoiseRipple[]): void {
  ctx.save();
  for (const r of ripples) {
    const t = r.age / 1.1;
    if (t >= 1) continue;
    const radius = 6 + t * Math.min(240, r.level * 22);
    const alpha = (1 - t) * (0.14 + Math.min(0.34, r.level / 34));
    ctx.strokeStyle = withAlpha(r.byPlayer ? PALETTE.fog : PALETTE.warm, alpha);
    ctx.lineWidth = 1 + (1 - t) * 1.4;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 20;
    circle(ctx, r.x, r.y, radius);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawAttentionLine(ctx: Ctx, e: Enemy, tx: number, ty: number): void {
  const strength = clamp01((e.awareness - AWARENESS.suspicious) / 0.5);
  if (strength <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = withAlpha(eyeColor(e.tell, false), strength * 0.3);
  ctx.setLineDash([2, 9]);
  ctx.lineDashOffset = -e.animPhase * 26;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y - e.def.height * 0.6);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
}
