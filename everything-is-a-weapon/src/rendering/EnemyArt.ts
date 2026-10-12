import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Enemy } from '../entities/Enemy';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { hash, mix, onTop, prism, type Ctx } from './draw';

/**
 * THE MOVERS — a removal crew of living cardboard boxes, sent by the landlord at 3 a.m.
 * to pack up your flat with you still in it.
 *
 *   Box        the standard mover: kraft card, parcel tape, eyes glaring out of the hand-hole
 *   Express    a padded envelope on legs; the flap is a permanent frown
 *   Crate      slatted timber, something staring out from between the planks
 *   Pan Head   a Box that has already looted your saucepan and is wearing it
 *   Bailiff    wears a tie, hides behind the eviction notice
 *   Tangle     a box of Christmas lights that should not have been plugged in
 *   Gnat       a waspish speck: too fast to box, swats like a grudge
 *   Chucker    a long-armed Box in a sweatband; throws your furniture back at you
 *   Bulwark    a walking safe door: riveted plate up front, nothing behind but spite
 *
 *   BOSSES are not boxes. Each of the seven has a fully custom silhouette drawn
 *   by drawBossBody (no prism, no tape, no flaps): a chair mech, a toilet, a sofa
 *   with cushion tentacles, a horned fridge, an eight-legged piano, a mower and
 *   MOM herself. They share only the hit-flash tone, the defeat tumble, the
 *   overhead telegraphs and the HP tape.
 *
 * Each is drawn in passes (legs → body → tape and flaps → face → props) and every pass reacts
 * to state: flaps perk up before a lunge, the eyes follow you, the lid bursts when it is beaten.
 */

interface Build {
  hw: number;
  hd: number;
  h: number;
  side: string;
  top: string;
}

const KRAFT = '#c9a070';
const KRAFT_DARK = '#9c7446';
const KRAFT_LIGHT = '#dfbd8c';
const TAPE = '#ecdcab';
const STEEL = '#aab4c4';
const STEEL_DARK = '#6d7689';

const BUILDS: Readonly<Record<EnemyTypeId, Build>> = {
  basic: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  fast: { hw: 13, hd: 3.5, h: 26, side: '#d8ccac', top: '#f6eed8' },
  heavy: { hw: 23, hd: 14, h: 32, side: '#7a4f28', top: '#b07a45' },
  helmet: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  shield: { hw: 15, hd: 10, h: 24, side: '#86623c', top: '#b58d60' },
  electric: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  fragile: { hw: 13, hd: 9, h: 22, side: '#b3c4d2', top: '#dfeaf2' },
  nested: { hw: 19, hd: 12, h: 28, side: KRAFT_DARK, top: KRAFT },
  // drawn as a Box at 60% size
  mini: { hw: 15, hd: 10, h: 23, side: '#b08a5a', top: '#d9b687' },
  kaboom: { hw: 15, hd: 10, h: 23, side: '#c9483f', top: '#ef7a6c' },
  trolley: { hw: 15, hd: 10, h: 25, side: '#86623c', top: '#b58d60' },
  gnat: { hw: 11, hd: 7, h: 17, side: '#9a8f2e', top: '#e0d24a' },
  hurler: { hw: 15, hd: 10, h: 24, side: '#7d3f2c', top: '#b5654a' },
  bulwark: { hw: 18, hd: 11, h: 27, side: '#3a4552', top: '#5a6b7d' },
  // Bosses: rough extents only — the silhouette is fully custom below.
  chairman: { hw: 20, hd: 13, h: 34, side: '#232e3b', top: '#3a4a5c' },
  flusher: { hw: 20, hd: 14, h: 32, side: '#9fb3c4', top: '#dfeaf2' },
  kraken: { hw: 26, hd: 14, h: 26, side: '#522741', top: '#7a3b5c' },
  fridgezilla: { hw: 20, hd: 13, h: 40, side: '#8fa8b8', top: '#cfe0e8' },
  piano: { hw: 26, hd: 14, h: 26, side: '#121017', top: '#26232e' },
  mower: { hw: 22, hd: 13, h: 24, side: '#7d241c', top: '#c23b2e' },
  mom: { hw: 20, hd: 12, h: 38, side: '#5c2540', top: '#8a3b5c' },
};

/** Bosses with fully custom silhouettes (no box prism). */
const CUSTOM_BOSS_IDS: ReadonlyArray<EnemyTypeId> = [
  'chairman', 'flusher', 'kraken', 'fridgezilla', 'piano', 'mower', 'mom',
];

const BULBS = ['#ff5a4e', '#ffd23f', '#6fe0c2', '#4ad6e8', '#ff9ec4'];

type Tone = (color: string) => string;

function legs(ctx: Ctx, x: number, y: number, phase: number, spread: number, size: number): void {
  const swing = Math.sin(phase) * 4;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x - spread, y + swing, size, size * 0.7, 0, 0, TAU);
  ctx.ellipse(x + spread, y - swing, size, size * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - spread, y + swing);
  ctx.lineTo(x - spread * 0.8, y - 6);
  ctx.moveTo(x + spread, y - swing);
  ctx.lineTo(x + spread * 0.8, y - 6);
  ctx.stroke();
}

function mitt(ctx: Ctx, fromX: number, fromY: number, x: number, y: number, color: string): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** A pair of eyes glaring out of a dark opening. */
function eyes(ctx: Ctx, cx: number, cy: number, gap: number, lookX: number, lookY: number, size: number, dead: boolean): void {
  for (const side of [-1, 1]) {
    const ex = cx + gap * side;
    if (dead) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ex - 2.3, cy - 2.3);
      ctx.lineTo(ex + 2.3, cy + 2.3);
      ctx.moveTo(ex + 2.3, cy - 2.3);
      ctx.lineTo(ex - 2.3, cy + 2.3);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, cy, size, size * 1.08, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + lookX * 1.2, cy + lookY * 0.9, size * 0.5, 0, TAU);
    ctx.fill();
  }
}

interface BossDraw {
  hw: number;
  hd: number;
  tone: Tone;
  fx: number;
  fy: number;
  windup: number;
  hop: number;
  topY: number;
  lift: number;
}

/** Five casters on a star base; the Chairman never walks anywhere. He rolls. */
function chairmanBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup, hop } = p;
  const baseY = y + hd + 1;
  // star base + casters
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const a = (k * TAU) / 5 + Math.sin(e.walkPhase) * 0.05 + 0.4;
    const wx = x + Math.cos(a) * (hw + 2);
    ctx.beginPath();
    ctx.moveTo(x, baseY - 6);
    ctx.lineTo(wx, baseY);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(wx, baseY + 1, 4.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone('#aab4c4');
    ctx.beginPath();
    ctx.arc(wx, baseY + 1, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  // gas-lift post + seat + tall backrest
  ctx.fillStyle = tone('#232e3b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.fillRect(x - 4, baseY - 22, 8, 18);
  ctx.strokeRect(x - 4, baseY - 22, 8, 18);
  ctx.fillStyle = tone('#3a4a5c');
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 20);
  ctx.lineTo(x + hw, baseY - 20);
  ctx.lineTo(x + hw - 5, baseY - 30);
  ctx.lineTo(x - hw + 5, baseY - 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const backTop = baseY - 30 - 26 - hop * 0.5;
  ctx.fillStyle = tone('#3a4a5c');
  ctx.fillRect(x - hw + 4, backTop, hw * 2 - 8, 28);
  ctx.strokeRect(x - hw + 4, backTop, hw * 2 - 8, 28);
  // the rider: tie, headset, and a performance review in his eyes
  const hx = x + fx * 3;
  const hy = backTop + 2;
  ctx.fillStyle = tone('#c9a070');
  ctx.beginPath();
  ctx.arc(hx, hy + 12, 9, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy + 12, 9, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  if (!e.defeated) eyes(ctx, hx, hy + 12, 4.6, fx, fy, 3, false);
  ctx.fillStyle = tone('#e5383b');
  ctx.beginPath();
  ctx.moveTo(hx - 2.4, hy + 20);
  ctx.lineTo(hx + 2.4, hy + 20);
  ctx.lineTo(hx + 3.2, hy + 27);
  ctx.lineTo(hx, hy + 30);
  ctx.lineTo(hx - 3.2, hy + 27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // stapler arm + pointing arm (raised with the windup)
  mitt(ctx, x - hw, baseY - 26, x - hw - 10, baseY - 20, tone('#232e3b'));
  ctx.fillStyle = tone('#8a94a6');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.fillRect(x - hw - 20, baseY - 30, 15, 8);
  ctx.strokeRect(x - hw - 20, baseY - 30, 15, 8);
  ctx.fillStyle = tone('#e5383b');
  ctx.fillRect(x - hw - 20, baseY - 33, 15, 4);
  ctx.strokeRect(x - hw - 20, baseY - 33, 15, 4);
  mitt(ctx, x + hw, baseY - 26, x + hw + 8 + fx * 6, baseY - 34 - windup * 12, tone('#232e3b'));
  void time;
}

/** The Flusher: a porcelain throne with a grudge and a whirlpool for a mouth. */
function flusherBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  // pedestal + bowl
  ctx.fillStyle = tone('#9fb3c4');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x - 8, baseY);
  ctx.lineTo(x - 13, baseY - 18);
  ctx.lineTo(x + 13, baseY - 18);
  ctx.lineTo(x + 8, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#dfeaf2');
  ctx.beginPath();
  ctx.ellipse(x, baseY - 22, hw + 2, 11, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // the water: swirling harder while it sucks
  ctx.fillStyle = '#4ad6e8';
  ctx.beginPath();
  ctx.ellipse(x, baseY - 22, hw - 5, 7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1d6f84';
  ctx.lineWidth = 2;
  const swirl = e.sucking && !e.defeated ? time * 9 : time * 2;
  for (const [rr, off] of [[8, 0], [4.5, 2.2]] as const) {
    ctx.beginPath();
    ctx.ellipse(x, baseY - 22, rr, rr * 0.55, 0, swirl + off, swirl + off + 4.2);
    ctx.stroke();
  }
  // tank behind, lid, and a jiggling handle
  const tankTop = baseY - 22 - 26;
  ctx.fillStyle = tone('#dfeaf2');
  ctx.fillRect(x - hw + 1, tankTop, hw * 2 - 2, 26);
  ctx.strokeRect(x - hw + 1, tankTop, hw * 2 - 2, 26);
  ctx.fillStyle = tone('#9fb3c4');
  ctx.fillRect(x - hw - 1, tankTop - 4, hw * 2 + 2, 5);
  ctx.strokeRect(x - hw - 1, tankTop - 4, hw * 2 + 2, 5);
  const jiggle = e.sucking && !e.defeated ? Math.sin(time * 30) * 2 : 0;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + hw - 1, tankTop + 12 + jiggle);
  ctx.lineTo(x + hw + 8, tankTop + 12 + jiggle);
  ctx.stroke();
  // eyes over the rim, pupils on you
  if (!e.defeated) {
    eyes(ctx, x + fx * 4, tankTop + 12, 7, fx, fy, 3.6, false);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - 12, tankTop + 2);
    ctx.lineTo(x - 3, tankTop + 5);
    ctx.moveTo(x + 12, tankTop + 2);
    ctx.lineTo(x + 3, tankTop + 5);
    ctx.stroke();
  }
  mitt(ctx, x - hw - 2, baseY - 24, x - hw - 10, baseY - 14 + Math.sin(e.walkPhase) * 2, tone('#9fb3c4'));
  mitt(ctx, x + hw + 2, baseY - 24, x + hw + 10, baseY - 14 - Math.sin(e.walkPhase) * 2 - windup * 8, tone('#9fb3c4'));
}

/** The Sofa Kraken: lounge seating with five cushion-tipped opinions. */
function krakenBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const lash = e.lashProgress;
  const fa = e.facing;
  // tentacles first (behind the body), rearing up with the lash telegraph
  for (let i = -2; i <= 2; i++) {
    const spread = (i / 2) * 1.05;
    // rest pose fans upward; a lash swings the whole fan towards the facing
    const rest = -Math.PI / 2 + spread;
    const wave = Math.sin(time * 3 + i * 1.7 + e.seed) * 0.22 * (1 - lash * 0.6);
    const dir = rest + wave + angleDiffSafe(rest, fa) * lash * 0.55;
    const len = 26 + Math.sin(time * 3 + i * 1.7 + e.seed) * 5 + lash * 20;
    const mx = x + Math.cos(dir) * len * 0.55;
    const my = baseY - 14 + Math.sin(dir) * len * 0.55;
    const tx = x + Math.cos(dir) * len;
    const ty = baseY - 14 + Math.sin(dir) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(rest) * hw * 0.5, baseY - 12);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = tone('#7a3b5c');
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(rest) * hw * 0.5, baseY - 12);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // cushion-tip pad with a button
    ctx.fillStyle = tone('#a85a78');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(tx, ty, 7, 5.4, dir, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#522741');
    ctx.beginPath();
    ctx.arc(tx, ty, 1.8, 0, TAU);
    ctx.fill();
  }
  // sofa base: seat, backrest, armrests, buttons
  ctx.fillStyle = tone('#522741');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.fillRect(x - hw, baseY - 34, hw * 2, 22);
  ctx.strokeRect(x - hw, baseY - 34, hw * 2, 22);
  ctx.fillStyle = tone('#7a3b5c');
  ctx.beginPath();
  ctx.ellipse(x, baseY - 16, hw, 9, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = tone('#7a3b5c');
    ctx.beginPath();
    ctx.ellipse(x + side * (hw - 2), baseY - 24, 8, 12, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = tone('#3d2033');
  for (const bx of [-hw * 0.45, 0, hw * 0.45]) {
    ctx.beginPath();
    ctx.arc(x + bx, baseY - 24, 2.4, 0, TAU);
    ctx.fill();
  }
  // stalk eyes + a mouth like a torn seam
  if (!e.defeated) {
    for (const side of [-1, 1]) {
      const ex = x + side * 9;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ex, baseY - 36);
      ctx.lineTo(ex + side * 2, baseY - 46);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + side * 2, baseY - 50, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + side * 2 + fx * 1.6, baseY - 50 + fy, 2.2, 0, TAU);
      ctx.fill();
    }
    tearMouth(ctx, x + fx * 4, baseY - 22, 8, Math.max(windup, lash));
  }
}

/** Fridgezilla: a tall fridge with ice horns, a door ajar, and frostbite. */
function fridgezillaBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const top = baseY - 62;
  // feet + tall body with a rounded top
  ctx.fillStyle = tone('#5c6b78');
  ctx.fillRect(x - 12, baseY - 4, 7, 4);
  ctx.fillRect(x + 5, baseY - 4, 7, 4);
  ctx.fillStyle = tone('#cfe0e8');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, baseY);
  ctx.lineTo(x - hw + 3, top + 8);
  ctx.quadraticCurveTo(x - hw + 3, top, x - hw + 11, top);
  ctx.lineTo(x + hw - 11, top);
  ctx.quadraticCurveTo(x + hw - 3, top, x + hw - 3, top + 8);
  ctx.lineTo(x + hw - 3, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // ice horns
  ctx.fillStyle = tone('#e8f4fb');
  for (const [ox, s] of [[-10, 9], [0, 12], [10, 9]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ox - s * 0.45, top + 2);
    ctx.lineTo(x + ox, top - s);
    ctx.lineTo(x + ox + s * 0.45, top + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // freezer gap with eyes in the cold dark
  ctx.fillStyle = '#17132a';
  ctx.fillRect(x - hw + 6, top + 12, hw * 2 - 12, 10);
  if (!e.defeated) eyes(ctx, x + fx * 3, top + 17, 6, fx, fy, 2.8, false);
  // fridge/freezer split + handle + magnets
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, top + 27);
  ctx.lineTo(x + hw - 3, top + 27);
  ctx.stroke();
  ctx.fillStyle = tone('#8fa8b8');
  ctx.fillRect(x + hw - 9, top + 32, 4, 18);
  ctx.fillStyle = tone('#e5383b');
  ctx.fillRect(x - hw + 7, top + 34, 6, 7);
  ctx.fillStyle = tone('#ffd23f');
  ctx.fillRect(x - hw + 9, top + 44, 5, 6);
  // the door hangs ajar: cold light spills out, flickering
  const flick = 0.5 + Math.sin(time * 4 + e.seed) * 0.2;
  ctx.fillStyle = `rgba(207, 232, 255, ${flick.toFixed(2)})`;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, top + 30);
  ctx.lineTo(x - hw - 12, baseY - 6);
  ctx.lineTo(x - hw + 3, baseY - 6);
  ctx.closePath();
  ctx.fill();
  // frost breath
  if (!e.defeated) {
    const puff = (Math.sin(time * 5) + 1) / 2;
    ctx.fillStyle = 'rgba(232, 244, 251, 0.85)';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(x + fx * (hw + 10 + i * 7 + puff * 4), baseY - 34 + Math.sin(time * 3 + i * 2) * 3, 3.4 - i, 0, TAU);
      ctx.fill();
    }
  }
  mitt(ctx, x - hw - 2, baseY - 30, x - hw - 12, baseY - 22 - windup * 8, tone('#8fa8b8'));
  mitt(ctx, x + hw + 2, baseY - 30, x + hw + 12, baseY - 22 + Math.sin(e.walkPhase) * 2, tone('#8fa8b8'));
}

/** The Piano Spider: one grand, eight legs, zero mercy. */
function pianoBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup, hop } = p;
  const baseY = y + hd + 1;
  // eight jointed legs around the rim, alternating with the crawl
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.4;
    const step = Math.sin(e.walkPhase * 2 + k * (Math.PI / 4)) * 5;
    const hx = x + Math.cos(a) * hw * 0.8;
    const hy = baseY - 12 + Math.sin(a) * 6;
    const kx = x + Math.cos(a) * (hw + 8);
    const ky = baseY - 6 + step * 0.4;
    const fxx = x + Math.cos(a) * (hw + 15);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fxx, baseY);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(fxx, baseY, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  // the grand: a black bean with gold trim
  ctx.fillStyle = tone('#26232e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 18);
  ctx.bezierCurveTo(x - hw, baseY - 40, x - 6, baseY - 44, x + hw + 4, baseY - 30);
  ctx.bezierCurveTo(x + hw + 10, baseY - 20, x + hw * 0.4, baseY - 12, x - hw, baseY - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#c9a24f');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - hw + 4, baseY - 20);
  ctx.bezierCurveTo(x - hw + 4, baseY - 37, x - 4, baseY - 40, x + hw, baseY - 29);
  ctx.stroke();
  // propped lid + stick
  const lidLift = 10 + hop * 0.4;
  ctx.fillStyle = tone('#121017');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - hw + 2, baseY - 38);
  ctx.lineTo(x + hw - 2, baseY - 38 - lidLift);
  ctx.lineTo(x + hw - 6, baseY - 32 - lidLift);
  ctx.lineTo(x - hw + 2, baseY - 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#c9a24f');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, baseY - 36);
  ctx.lineTo(x + 10, baseY - 22);
  ctx.stroke();
  // keyboard along the front + eyes on the fallboard
  ctx.fillStyle = tone('#fbf6e9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const kbY = baseY - 20;
  ctx.fillRect(x - hw + 2, kbY, hw * 2 - 4, 7);
  ctx.strokeRect(x - hw + 2, kbY, hw * 2 - 4, 7);
  ctx.fillStyle = INK;
  for (let i = 0; i < 7; i++) ctx.fillRect(x - hw + 6 + i * 6.4, kbY, 3, 4.4);
  if (!e.defeated) {
    eyes(ctx, x + fx * 5, kbY - 9, 7, fx, fy, 3.4, false);
    // one furious eighth-note
    const bounce = Math.abs(Math.sin(time * 6)) * 3;
    ctx.fillStyle = tone('#e5383b');
    ctx.beginPath();
    ctx.ellipse(x + hw - 8, kbY - 16 - bounce, 3.4, 2.6, 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = tone('#e5383b');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + hw - 5, kbY - 17 - bounce);
    ctx.lineTo(x + hw - 5, kbY - 28 - bounce);
    ctx.stroke();
  }
  // pedal lyre
  ctx.strokeStyle = tone('#c9a24f');
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 4, baseY - 12);
  ctx.lineTo(x - 4, baseY - 2);
  ctx.moveTo(x + 4, baseY - 12);
  ctx.lineTo(x + 4, baseY - 2);
  ctx.stroke();
  void windup;
}

/** The Mower Maniac: red deck, four wheels, one handle, no brakes. */
function mowerBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const charging = e.ai === 'lunge';
  // handle bars up behind
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const bx = x - fx * (hw + 2);
  ctx.beginPath();
  ctx.moveTo(bx - fx * 4, baseY - 22);
  ctx.lineTo(bx - fx * 22, baseY - 44);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx - fx * 27, baseY - 44);
  ctx.lineTo(bx - fx * 17, baseY - 44);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // grass bag
  ctx.fillStyle = tone('#2f5c3a');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(bx - fx * 12, baseY - 26, 10, 8, -fx * 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#6fa37a');
  ctx.lineWidth = 1.6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(bx - fx * 12 + i * 5 - 2, baseY - 34);
    ctx.lineTo(bx - fx * 12 + i * 5, baseY - 39);
    ctx.lineTo(bx - fx * 12 + i * 5 + 2, baseY - 34);
    ctx.stroke();
  }
  // wheels: big backs spin fast, small fronts follow
  const spin = e.walkPhase * (charging ? 4 : 2);
  for (const [off, r] of [[-9, 8], [9, 8], [-17, 5], [17, 5]] as const) {
    const wx = x + off;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(wx, baseY - r + 1, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone('#aab4c4');
    ctx.beginPath();
    ctx.arc(wx, baseY - r + 1, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = tone('#aab4c4');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(spin) * (r - 1), baseY - r + 1 + Math.sin(spin) * (r - 1));
    ctx.lineTo(wx - Math.cos(spin) * (r - 1), baseY - r + 1 - Math.sin(spin) * (r - 1));
    ctx.stroke();
  }
  // red deck
  ctx.fillStyle = tone('#c23b2e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 10);
  ctx.lineTo(x + hw, baseY - 10);
  ctx.lineTo(x + hw - 6, baseY - 26);
  ctx.lineTo(x - hw + 6, baseY - 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // engine block + cap
  ctx.fillStyle = tone('#2a2330');
  ctx.fillRect(x - 9, baseY - 36, 18, 11);
  ctx.strokeRect(x - 9, baseY - 36, 18, 11);
  ctx.fillStyle = tone('#ffd23f');
  ctx.beginPath();
  ctx.arc(x, baseY - 38, 3.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // blade blur underneath at speed
  if (charging && !e.defeated) {
    ctx.fillStyle = 'rgba(251, 246, 233, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, baseY - 4, hw, 4, spin * 0.2, 0, TAU);
    ctx.fill();
  }
  // headlight eyes + grille mouth on the front
  const fxx = x + fx * (hw - 2);
  if (!e.defeated) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#fff6c9';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fxx, baseY - 30 + side * 6, 4.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(fxx + fx * 1.4, baseY - 30 + side * 6 + fy, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#17132a';
    const gape = windup * 5;
    ctx.fillRect(fxx - 2, baseY - 18, 4, 6 + gape);
  }
  // exhaust puffs
  if (!e.defeated) {
    ctx.fillStyle = 'rgba(90, 90, 100, 0.7)';
    for (let i = 0; i < 2; i++) {
      const t = (time * 1.4 + i * 0.5 + e.seed) % 1;
      ctx.beginPath();
      ctx.arc(x - fx * 6 - t * 14, baseY - 40 - t * 18, 2 + t * 3, 0, TAU);
      ctx.fill();
    }
  }
}

/**
 * MOM. Housecoat, curlers, glasses, one raised slipper. The slipper rises with
 * every telegraph; the brows sink with every phase. Do not test her.
 */
function momBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const anger = e.phaseIndex;
  // legs + slippers (one tapping)
  legs(ctx, x, baseY, e.walkPhase, 7, 4.5);
  for (const side of [-1, 1]) {
    const tap = side === 1 ? Math.abs(Math.sin(e.walkPhase * 2)) * 3 : 0;
    ctx.fillStyle = tone('#e89bb4');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x + side * 7, baseY - 2 - tap, 7, 4, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // housecoat: A-line with flowers, belt, collar
  ctx.fillStyle = tone('#8a3b5c');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - 9, baseY - 34);
  ctx.lineTo(x + 9, baseY - 34);
  ctx.lineTo(x + hw - 2, baseY - 4);
  ctx.lineTo(x - hw + 2, baseY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#e8a0b8');
  for (const [ox, oy] of [[-8, -26], [7, -22], [-2, -14], [10, -10], [-11, -9]] as const) {
    ctx.beginPath();
    ctx.arc(x + ox, baseY + oy, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = tone('#5c2540');
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 11, baseY - 20);
  ctx.lineTo(x + 11, baseY - 20);
  ctx.stroke();
  // head + curlers + glasses + fury
  const hy = baseY - 44;
  ctx.fillStyle = tone('#f2c19b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(x, hy, 11, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (1.08 + (k / 4) * 0.84);
    const cx = x + Math.cos(a) * 11;
    const cy = hy + Math.sin(a) * 11;
    ctx.fillStyle = tone('#8a94a6');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#e89bb4');
    ctx.beginPath();
    ctx.arc(cx, cy, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 5, hy + 1, 5.4, 0, TAU);
  ctx.moveTo(x - 5 + 5.4, hy + 1);
  ctx.lineTo(x + 5 - 5.4, hy + 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 5, hy + 1, 5.4, 0, TAU);
  ctx.stroke();
  if (!e.defeated) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - 5 + fx * 1.8, hy + 1 + fy, 1.9, 0, TAU);
    ctx.arc(x + 5 + fx * 1.8, hy + 1 + fy, 1.9, 0, TAU);
    ctx.fill();
    // brows like thunderheads, lower every phase
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    const drop = 2 + anger * 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, hy - 8 + drop * 0.4);
    ctx.lineTo(x - 1, hy - 5 + drop);
    ctx.moveTo(x + 10, hy - 8 + drop * 0.4);
    ctx.lineTo(x + 1, hy - 5 + drop);
    ctx.stroke();
    // frown that opens into a scold
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x + fx * 2, hy + 12, 4.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    if (windup > 0.2 || e.hurlProgress > 0.2) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x + fx * 2, hy + 11, 3.6, 4.6, 0, 0, TAU);
      ctx.fill();
    }
    if (anger > 0) {
      const throb = 1 + Math.sin(time * 8) * 0.25;
      ctx.strokeStyle = tone('#e5383b');
      ctx.lineWidth = 2;
      const vx = x + 8;
      const vy = hy - 9;
      ctx.beginPath();
      ctx.moveTo(vx - 4 * throb, vy);
      ctx.lineTo(vx + 4 * throb, vy);
      ctx.moveTo(vx, vy - 4 * throb);
      ctx.lineTo(vx, vy + 4 * throb);
      ctx.stroke();
    }
  }
  // THE SLIPPER, raised with every telegraph
  const raise = 0.5 + windup * 0.9 + e.hurlProgress * 0.9 + (e.ai === 'slam' ? 0.7 : 0);
  const sx = x + 14;
  const sy = hy - 16 - raise * 10;
  mitt(ctx, x + 8, baseY - 30, sx - 4, sy + 14, tone('#f2c19b'));
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.5 - raise * 0.5);
  ctx.fillStyle = tone('#e89bb4');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 7, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#8a3b5c');
  ctx.lineWidth = 1.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6 - 2, -5);
    ctx.lineTo(i * 6 - 2, 5);
    ctx.stroke();
  }
  ctx.fillStyle = tone('#ffd23f');
  ctx.beginPath();
  ctx.arc(-8, -3, 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  mitt(ctx, x - 9, baseY - 30, x - 15, baseY - 16 + Math.sin(e.walkPhase) * 2, tone('#f2c19b'));
}

/** Dispatches the seven custom boss silhouettes. */
function drawBossBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  switch (e.type.id) {
    case 'chairman': chairmanBody(ctx, e, x, y, time, p); break;
    case 'flusher': flusherBody(ctx, e, x, y, time, p); break;
    case 'kraken': krakenBody(ctx, e, x, y, time, p); break;
    case 'fridgezilla': fridgezillaBody(ctx, e, x, y, time, p); break;
    case 'piano': pianoBody(ctx, e, x, y, time, p); break;
    case 'mower': mowerBody(ctx, e, x, y, time, p); break;
    case 'mom': momBody(ctx, e, x, y, time, p); break;
  }
}

/** Small helper: signed smallest angle from a to b. */
function angleDiffSafe(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Overhead telegraphs shared by boxes and bosses. */
function drawOverhead(ctx: Ctx, e: Enemy, x: number, time: number, topY: number): void {
  const top = topY - 16 - (e.helmetHp > 0 ? 8 : 0);
  const windup = e.windupProgress;
  if (e.ai === 'windup' || e.ai === 'hurl' || e.ai === 'lash') {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    const s = 1 + windup * 0.5 + e.hurlProgress * 0.5 + e.lashProgress * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, top - 14 * s);
    ctx.lineTo(x + 3 * s, top - 14 * s);
    ctx.lineTo(x + 1.5 * s, top - 4 * s);
    ctx.lineTo(x - 1.5 * s, top - 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top, 2.2 * s, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (e.stun > 0.15 || e.confuse > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * TAU) / 3;
      ctx.fillStyle = i === 0 ? '#ffffff' : '#ffd23f';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 11, top + Math.sin(a) * 4, 2.6, 0, TAU);
      ctx.fill();
    }
  } else if (e.ai === 'idle' || e.ai === 'investigate') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.font = '800 16px sans-serif';
    ctx.textAlign = 'center';
    const mark = e.lured ? '♪' : '?';
    ctx.strokeText(mark, x, top);
    ctx.fillText(mark, x, top);
  }
}

/** The parcel-tape HP strip, shared by boxes and bosses. */
function drawHpBar(ctx: Ctx, e: Enemy, x: number, y: number, hw: number, hd: number): void {
  if (e.hp >= e.type.hp) return;
  const w = hw * 1.8;
  const ratio = Math.max(0, e.hp / e.type.hp);
  ctx.fillStyle = INK;
  ctx.fillRect(x - w / 2 - 1.5, y + hd + 9, w + 3, 6);
  ctx.fillStyle = ratio > 0.4 ? TAPE : '#ff5a4e';
  ctx.fillRect(x - w / 2, y + hd + 10.5, w * ratio, 3);
}

/** Jagged tear for a mouth; it gapes open when the mover is winding up to lunge. */
function tearMouth(ctx: Ctx, cx: number, cy: number, width: number, open: number): void {
  ctx.lineJoin = 'miter';
  if (open > 0.15) {
    const gape = 2 + open * 4.5;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - width, cy);
    for (let i = 1; i <= 6; i++) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + (i % 2 === 0 ? 0 : -1.6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + gape + (i % 2 === 0 ? 1.6 : 0));
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - width, cy);
  for (let i = 1; i <= 6; i++) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + (i % 2 === 0 ? 0 : 2));
  ctx.stroke();
}

function xray(ctx: Ctx, x: number, top: number, bottom: number, width: number): void {
  // cartoon x-ray: for a split second you can see what is packed inside
  const bone = '#fffbe0';
  const r = Math.min(width * 0.38, 7);
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x, top + r + 2, r, r * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a1530';
  ctx.beginPath();
  ctx.arc(x - r * 0.38, top + r + 1, r * 0.24, 0, TAU);
  ctx.arc(x + r * 0.38, top + r + 1, r * 0.24, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = bone;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, top + r * 2 + 2);
  ctx.lineTo(x, bottom - 3);
  for (let i = 0; i < 2; i++) {
    const ry = top + r * 2 + 6 + i * 4;
    if (ry > bottom - 3) break;
    ctx.moveTo(x - r, ry + 1.5);
    ctx.quadraticCurveTo(x, ry - 2, x + r, ry + 1.5);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** What marks out the later arrivals: stickers, fuses, wheels, boxes inside boxes. */
function newcomerProps(
  ctx: Ctx, e: Enemy, x: number, y: number, faceTop: number, faceBottom: number, topY: number,
  hw: number, hd: number, time: number, tone: Tone, away: boolean,
): void {
  const id = e.type.id;
  const faceH = faceBottom - faceTop;
  if (id === 'fragile') {
    // a red band right round it, and the wine glass symbol
    ctx.fillStyle = tone('#e5383b');
    ctx.fillRect(x - hw + 1, faceBottom - 8.5, hw * 2 - 2, 6);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - hw + 3.5 + i * 5.6, faceBottom - 6.3, 3.6, 1.5);
    if (!away) {
      ctx.strokeStyle = tone('#e5383b');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const gx = x - hw + 5;
      const gy = faceTop + 4;
      ctx.moveTo(gx - 2.4, gy);
      ctx.lineTo(gx + 2.4, gy);
      ctx.lineTo(gx, gy + 3.5);
      ctx.closePath();
      ctx.moveTo(gx, gy + 3.5);
      ctx.lineTo(gx, gy + 6.5);
      ctx.moveTo(gx - 2, gy + 6.5);
      ctx.lineTo(gx + 2, gy + 6.5);
      ctx.stroke();
    }
  } else if (id === 'nested') {
    // the outlines of the boxes inside it
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const inset of [3, 6.5]) ctx.strokeRect(x - hw + inset, faceTop + inset, hw * 2 - inset * 2, faceH - inset * 2 + 1);
    ctx.setLineDash([]);
    ctx.fillStyle = tone('#fbf6e9');
    ctx.fillRect(x - hw + 2, faceBottom - 8, 11, 6);
    ctx.fillStyle = INK;
    ctx.font = '700 5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('x3', x - hw + 3.5, faceBottom - 3.2);
  } else if (id === 'kaboom') {
    // hazard diamond on the front
    if (!away) {
      const dx = x + hw - 7;
      const dy = faceBottom - 8;
      ctx.fillStyle = tone('#ffd23f');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 5.5);
      ctx.lineTo(dx + 5.5, dy);
      ctx.lineTo(dx, dy + 5.5);
      ctx.lineTo(dx - 5.5, dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(dx - 0.8, dy - 3, 1.6, 3.6);
      ctx.fillRect(dx - 0.8, dy + 1.6, 1.6, 1.5);
    }
    // a rocket stick poking out of the lid, fuse already lit
    const sx = x + 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(sx, topY + 2);
    ctx.lineTo(sx + 3, topY - 12);
    ctx.stroke();
    ctx.strokeStyle = tone('#4ad6e8');
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (!e.defeated) {
      const flick = hash(Math.floor(time * 18) + e.seed);
      ctx.fillStyle = flick > 0.5 ? '#fff27a' : '#ff9f1c';
      ctx.beginPath();
      ctx.arc(sx + 3 + (flick - 0.5) * 3, topY - 14 - flick * 2, 2 + flick * 1.6, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'gnat') {
    // wasp stripes round the middle and blurred wings on top
    ctx.fillStyle = tone('#17132a');
    ctx.fillRect(x - hw + 1, faceBottom - 11, hw * 2 - 2, 3);
    ctx.fillRect(x - hw + 1, faceBottom - 6, hw * 2 - 2, 2.4);
    const buzz = Math.sin(time * 55 + e.seed) * 2;
    ctx.fillStyle = 'rgba(251, 246, 233, 0.75)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * (hw * 0.5), topY - 4 + buzz * side * 0.4, 7, 3.2, side * 0.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'hurler') {
    // a sweatband, and chalk on the throwing mitt when it is winding up
    ctx.fillStyle = tone('#2f4fb5');
    ctx.fillRect(x - hw + 1, faceTop + 3, hw * 2 - 2, 5);
    ctx.fillStyle = 'rgba(251, 246, 233, 0.85)';
    ctx.fillRect(x - hw + 4, faceTop + 4.6, 4, 1.8);
    if (e.ai === 'hurl' && !e.defeated) {
      ctx.fillStyle = tone('#fbf6e9');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(e.facing) * (hw + 4), faceTop - 6, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'bulwark') {
    // shoulder pauldrons bolted through the lid
    ctx.fillStyle = tone(STEEL_DARK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * (hw - 2), topY + 2, 6, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = tone('#ffd23f');
      ctx.beginPath();
      ctx.arc(x + side * (hw - 2), topY - 1, 1.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = tone(STEEL_DARK);
    }
  } else if (id === 'trolley') {

  // wheels, and a strap holding the box on
    ctx.fillStyle = tone('#2a2540');
    ctx.fillRect(x - hw, faceTop + faceH * 0.5, hw * 2, 3);
    const roll = e.walkPhase * 1.5;
    for (const side of [-1, 1]) {
      const wx = x + side * (hw + 2);
      const wy = y + hd + 1;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(wx, wy, 6.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = tone('#aab4c4');
      ctx.beginPath();
      ctx.arc(wx, wy, 2.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = tone('#aab4c4');
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(roll) * 5, wy + Math.sin(roll) * 5);
      ctx.lineTo(wx - Math.cos(roll) * 5, wy - Math.sin(roll) * 5);
      ctx.stroke();
    }
  }
}

export function drawEnemy(ctx: Ctx, e: Enemy, x: number, y: number, time: number): void {
  const type = e.type;
  const id = type.id;
  const build = BUILDS[id];
  const { hw, hd, h } = build;
  const fx = Math.cos(e.facing);
  const fy = Math.sin(e.facing);
  const px = -fy;
  const py = fx;

  const shocked = e.shockTimer > 0;
  const shockFrame = shocked && Math.floor(time * 24) % 2 === 0;
  const flash = e.hitFlash;
  const tone: Tone = (c) => {
    if (shockFrame) return '#1a1530';
    if (e.burn > 0) return mix(c, '#3a2a2a', 0.4);
    return flash > 0.05 ? mix(c, '#ffffff', flash * 0.85) : c;
  };
  const windup = e.windupProgress;
  const hop = e.defeated ? 0 : Math.abs(Math.sin(e.walkPhase)) * 2.2;
  const lift = 3 + hop;

  ctx.save();
  if (e.defeated) {
    // beaten flat: the box tumbles and collapses like it has been broken down for recycling
    const flat = Math.min(1, (1.35 - e.removeIn) / 0.5);
    ctx.globalAlpha = Math.min(1, e.removeIn / 0.35);
    ctx.translate(x, y - h * 0.3);
    ctx.rotate(e.spin * 0.6);
    ctx.scale(1 + flat * 0.25, 1 - flat * 0.55);
    ctx.translate(-x, -(y - h * 0.3));
  } else {
    const squash = e.squash;
    const tumble = e.tumble > 0 ? Math.sin(e.tumble * 9) * 0.5 : 0;
    const jitterX = shocked ? (hash(time * 60) - 0.5) * 5 : 0;
    ctx.translate(x + jitterX - fx * windup * 6, y - fy * windup * 6);
    if (tumble !== 0) ctx.rotate(tumble);
    ctx.scale(1 + squash * 0.2 + windup * 0.07, 1 - squash * 0.18 - windup * 0.07);
    ctx.translate(-x, -y);
  }

  if (id === 'mini') {
    ctx.translate(x, y);
    ctx.scale(0.62, 0.62);
    ctx.translate(-x, -y);
  }

  const faceTop = y + hd - h - hop;
  const faceBottom = y + hd - lift;
  const topY = y - h - hop;
  const away = fy < -0.6 && !e.defeated;

  // Bosses skip the whole box pipeline: custom silhouette, shared telegraphs + HP.
  if ((CUSTOM_BOSS_IDS as ReadonlyArray<string>).includes(id)) {
    drawBossBody(ctx, e, x, y, time, { hw, hd, tone, fx, fy, windup, hop, topY, lift });
    ctx.restore();
    if (!e.defeated) drawOverhead(ctx, e, x, time, topY);
    drawHpBar(ctx, e, x, y, hw, hd);
    return;
  }

  if (id === 'trolley' && !e.defeated) {
    // the sack truck: two handles behind, two fat wheels at the bottom
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const hx = x + side * (hw - 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hx, y + hd - 2);
      ctx.lineTo(hx, y - h - hop - 15);
      ctx.lineTo(hx - fx * 7, y - h - hop - 18);
      ctx.stroke();
      ctx.strokeStyle = tone('#e5383b');
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  if (!e.defeated) {
    legs(ctx, x, y + hd + 1, e.walkPhase, hw * 0.5, id === 'heavy' ? 6.5 : id === 'fast' || id === 'gnat' ? 4 : 5);
  }

  // The shield-bearers carry their protection in front, drawn behind the body
  // when they face away. The Bailiff hides behind paper; the Bulwark behind steel.
  const board = (): void => {
    const bx = x + fx * (hw + 7);
    const by = y + hd - 4 + fy * 12 - hop;
    const ax0 = bx + px * 17;
    const ay0 = by + py * 9;
    const ax1 = bx - px * 17;
    const ay1 = by - py * 9;
    const tall = 27;
    ctx.lineJoin = 'round';
    if (id === 'bulwark') {
      ctx.fillStyle = e.blockFlash > 0.1 ? '#ffffff' : tone(STEEL_DARK);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ax0, ay0);
      ctx.lineTo(ax1, ay1);
      ctx.lineTo(ax1, ay1 - tall - 4);
      ctx.lineTo(ax0, ay0 - tall - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // rivets and a hazard chevron: this side means nothing good
      ctx.fillStyle = tone(STEEL);
      for (const [rx, ry] of [[0.12, -8], [0.88, -8], [0.12, -tall + 2], [0.88, -tall + 2], [0.5, -tall / 2 - 2]] as const) {
        ctx.beginPath();
        ctx.arc(ax0 + (ax1 - ax0) * rx, ay0 + (ay1 - ay0) * rx + ry, 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = tone('#ffd23f');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ax0 + (ax1 - ax0) * 0.2, ay0 - 12);
      ctx.lineTo(ax0 + (ax1 - ax0) * 0.5, ay0 - 20);
      ctx.lineTo(ax0 + (ax1 - ax0) * 0.8, ay0 - 12);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = e.blockFlash > 0.1 ? '#ffffff' : tone('#fbf6e9');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax0, ay0);
    ctx.lineTo(ax1, ay1);
    ctx.lineTo(ax1, ay1 - tall);
    ctx.lineTo(ax0, ay0 - tall);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // red header and a few lines of small print
    ctx.strokeStyle = tone('#e5383b');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ax0 + (ax1 - ax0) * 0.1, ay0 + (ay1 - ay0) * 0.1 - tall + 6);
    ctx.lineTo(ax0 + (ax1 - ax0) * 0.9, ay0 + (ay1 - ay0) * 0.9 - tall + 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ly = -tall + 13 + i * 4.5;
      ctx.moveTo(ax0 + (ax1 - ax0) * 0.15, ay0 + (ay1 - ay0) * 0.15 + ly);
      ctx.lineTo(ax0 + (ax1 - ax0) * (i === 2 ? 0.6 : 0.85), ay0 + (ay1 - ay0) * (i === 2 ? 0.6 : 0.85) + ly);
    }
    ctx.stroke();
  };
  if ((id === 'shield' || id === 'bulwark') && !e.defeated && fy < -0.1) board();

  // ── body ──
  const outline = (c: Ctx): void => c.rect(-hw, -hd, hw * 2, hd * 2);
  prism(ctx, x, y, 0, lift, h + hop, outline, tone(build.side), tone(build.top));

  // ── top: tape, lid, flaps (boxes only; machines and royalty dress otherwise) ──
  if (id !== 'fast' && id !== 'heavy' && id !== 'gnat') {
    onTop(ctx, x, y, 0, h + hop, (c) => {
      c.fillStyle = tone(id === 'electric' ? '#ffd23f' : TAPE);
      c.fillRect(-4, -hd, 8, hd * 2);
    });
    // side flaps stand up like ears, and perk when the mover is about to lunge
    const perk = Math.sin(e.walkPhase * 2) * 2 + windup * 7 + flash * 4 + (e.defeated ? 8 : 0);
    ctx.fillStyle = tone(KRAFT_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const ex = x + hw * side;
      ctx.beginPath();
      ctx.moveTo(ex, topY - hd + 1);
      ctx.lineTo(ex, topY + hd - 1);
      ctx.lineTo(ex + side * 8, topY + hd - 6 - perk);
      ctx.lineTo(ex + side * 8, topY - hd - 3 - perk);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'heavy') {
    onTop(ctx, x, y, 0, h + hop, (c) => {
      c.strokeStyle = tone('#7a4f28');
      c.lineWidth = 2;
      c.beginPath();
      for (const lx of [-11, 0, 11]) {
        c.moveTo(lx, -hd);
        c.lineTo(lx, hd);
      }
      c.stroke();
    });
  }

  // ── front face ──
  const cx = x + fx * (id === 'fast' ? 2.5 : 4);
  const faceH = faceBottom - faceTop;
  if (shockFrame) {
    xray(ctx, x, faceTop + 2, faceBottom, hw);
  } else if (id === 'fast') {
    // airmail border
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = tone('#e5383b');
    ctx.strokeRect(x - hw + 2.5, faceTop + 2.5, hw * 2 - 5, faceH - 4);
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = tone('#2f4fb5');
    ctx.strokeRect(x - hw + 2.5, faceTop + 2.5, hw * 2 - 5, faceH - 4);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // the flap is a scowl
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - hw + 3, faceTop + 4);
    ctx.lineTo(cx, faceTop + faceH * 0.42);
    ctx.lineTo(x + hw - 3, faceTop + 4);
    ctx.stroke();
    if (!away) {
      const ey = faceTop + faceH * 0.56;
      ctx.fillStyle = INK;
      for (const side of [-1, 1]) {
        const ex = cx + 4.6 * side;
        if (e.defeated) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(ex - 2, ey - 2);
          ctx.lineTo(ex + 2, ey + 2);
          ctx.moveTo(ex + 2, ey - 2);
          ctx.lineTo(ex - 2, ey + 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(ex + fx, ey + fy * 0.8, 2, 2.8, 0, 0, TAU);
          ctx.fill();
        }
      }
      tearMouth(ctx, cx, faceTop + faceH * 0.76, 3.5, windup);
    }
    // postage stamp
    ctx.fillStyle = tone('#e5383b');
    ctx.fillRect(x + hw - 9, faceTop + 5, 5, 6);
    if (!e.defeated) {
      // it never stops moving
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const ly = faceTop + 6 + i * 7;
        const len = 7 + hash(Math.floor(time * 12) + i) * 8;
        ctx.moveTo(x - fx * (hw + 4) - px * 2, ly);
        ctx.lineTo(x - fx * (hw + 4 + len) - px * 2, ly);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  } else if (id === 'heavy') {
    // slats, with something staring out of the gap
    const gapY = faceTop + faceH * 0.36;
    ctx.fillStyle = shockFrame ? '#1a1530' : '#17132a';
    ctx.fillRect(x - hw + 2, gapY - 4, hw * 2 - 4, 9);
    if (!away) eyes(ctx, cx, gapY + 0.5, 6.5, fx, fy, 3.2, e.defeated);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const fraction of [0.62, 0.82]) {
      ctx.moveTo(x - hw + 1, faceTop + faceH * fraction);
      ctx.lineTo(x + hw - 1, faceTop + faceH * fraction);
    }
    ctx.stroke();
    // steel corner brackets
    ctx.fillStyle = tone(STEEL);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * (hw - 1), faceTop + 1);
      ctx.lineTo(x + side * (hw - 9), faceTop + 1);
      ctx.lineTo(x + side * (hw - 1), faceTop + 9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + side * (hw - 1), faceBottom - 1);
      ctx.lineTo(x + side * (hw - 9), faceBottom - 1);
      ctx.lineTo(x + side * (hw - 1), faceBottom - 9);
      ctx.closePath();
      ctx.fill();
    }
    // "this way up"
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.7)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (const ox of [-13, -6]) {
      ctx.moveTo(x + ox - 3, faceBottom - 6);
      ctx.lineTo(x + ox, faceBottom - 10);
      ctx.lineTo(x + ox + 3, faceBottom - 6);
    }
    ctx.stroke();
  } else {
    // parcel tape running down the front
    ctx.fillStyle = tone(id === 'electric' ? '#ffd23f' : TAPE);
    ctx.fillRect(x - 4, faceTop + 1, 8, faceH - 1);
    if (away) {
      // from behind: a shipping label and a barcode
      ctx.fillStyle = tone('#fbf6e9');
      ctx.fillRect(x - 9, faceTop + 6, 18, 10);
      ctx.fillStyle = INK;
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 7 + i * 2.6, faceTop + 8, i % 2 === 0 ? 1.6 : 0.9, 6);
    } else {
      // eyes in the hand-hole
      const slotY = faceTop + faceH * 0.36;
      ctx.fillStyle = '#17132a';
      ctx.beginPath();
      ctx.ellipse(cx, slotY, 10, 4.8, 0, 0, TAU);
      ctx.fill();
      eyes(ctx, cx, slotY + 0.4, 4.4, fx, fy, 2.9, e.defeated);
      if (!e.defeated) {
        // heavy lid cut straight across: permanently unimpressed
        ctx.fillStyle = tone(build.side);
        ctx.beginPath();
        ctx.moveTo(cx - 10.5, slotY - 5.5);
        ctx.lineTo(cx + 10.5, slotY - 5.5);
        ctx.lineTo(cx + 10.5, slotY - 2.6);
        ctx.lineTo(cx, slotY - 0.6 - windup * 1.5);
        ctx.lineTo(cx - 10.5, slotY - 2.6);
        ctx.closePath();
        ctx.fill();
      }
      tearMouth(ctx, cx, faceTop + faceH * 0.68, 5, windup);
    }
    if (id === 'shield' && !away) {
      // a tie makes it official
      const ty = faceTop + faceH * 0.56;
      ctx.fillStyle = tone('#2f4fb5');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, ty + 5);
      ctx.lineTo(x + 2.5, ty + 5);
      ctx.lineTo(x + 3.5, ty + 12);
      ctx.lineTo(x, ty + 15);
      ctx.lineTo(x - 3.5, ty + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (id !== 'electric') {
      // FRAGILE sticker
      ctx.fillStyle = tone('#e5383b');
      ctx.fillRect(x + hw - 11, faceBottom - 9, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + hw - 9.5, faceBottom - 6.5, 5, 1.4);
    }
  }

  if (!shockFrame) newcomerProps(ctx, e, x, y, faceTop, faceBottom, topY, hw, hd, time, tone, away);

  // ── props ──
  if (id === 'electric' && !shockFrame) {
    // a string of fairy lights wound round the box, blinking out of order
    ctx.strokeStyle = '#235a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const wx = x - hw - 3 + t * (hw * 2 + 6);
      const wy = faceTop + faceH * 0.9 + Math.sin(t * 9 + 1) * 3 - t * 5;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const bx = x - hw - 3 + t * (hw * 2 + 6);
      const by = faceTop + faceH * 0.9 + Math.sin(t * 9 + 1) * 3 - t * 5 + 3;
      const lit = Math.floor(time * 5 + i * 1.7) % 2 === 0;
      const color = BULBS[i % BULBS.length]!;
      if (lit) {
        ctx.fillStyle = 'rgba(255, 255, 220, 0.3)';
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = lit ? color : mix(color, '#2a2330', 0.55);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.4, 3.1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // the loose plug that causes all the trouble
    const plugX = x + hw + 7;
    const plugY = faceBottom - 4 + Math.sin(time * 6) * 2;
    ctx.strokeStyle = '#235a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + hw + 3, faceTop + faceH * 0.5);
    ctx.quadraticCurveTo(plugX + 6, faceTop + faceH * 0.7, plugX, plugY);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(plugX - 2.5, plugY - 1, 5, 5);
  }

  if (e.helmetHp > 0) {
    // your saucepan, upside down, handle sticking out sideways
    const panY = topY - 3;
    const handle = px >= 0 ? 1 : -1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + handle * 10, panY - 2);
    ctx.lineTo(x + handle * 28, panY - 5);
    ctx.stroke();
    ctx.strokeStyle = '#3b3550';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = tone(STEEL_DARK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, panY + 3, hw + 2, hd * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(STEEL);
    ctx.beginPath();
    ctx.ellipse(x, panY - 3, hw + 1, hd * 0.78, 0, 0, TAU);
    ctx.rect(x - hw - 1, panY - 3, hw * 2 + 2, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, panY - 3, hw + 1, hd * 0.78, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - hw - 1, panY - 3);
    ctx.lineTo(x - hw - 1, panY + 3);
    ctx.moveTo(x + hw + 1, panY - 3);
    ctx.lineTo(x + hw + 1, panY + 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 5, panY - 4, 5, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  }

  // ── something over its head, or hanging off its face ──
  if (e.plunged > 0 && !e.defeated && (e.wearing === 'trashcan' || e.wearing === 'bucket')) {
    // upside down over the top of the box, a good deal lower than a hat
    const bin = e.wearing === 'trashcan';
    const rimY = faceTop + faceH * 0.5;
    const capY = topY - (bin ? 13 : 9);
    const wobble = Math.sin(time * 13) * 1.6;
    const bw = hw + (bin ? 5 : 3);
    ctx.fillStyle = tone(bin ? '#7c869b' : STEEL_DARK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - bw - 2 + wobble, rimY);
    ctx.lineTo(x - bw + 3 + wobble, capY);
    ctx.lineTo(x + bw - 3 + wobble, capY);
    ctx.lineTo(x + bw + 2 + wobble, rimY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(bin ? '#c3cbda' : STEEL);
    ctx.beginPath();
    ctx.ellipse(x + wobble, capY, bw - 3, 5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (bin) {
      ctx.strokeStyle = tone('#5f687c');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const off of [-0.5, 0, 0.5]) {
        ctx.moveTo(x + wobble + off * bw, capY + 7);
        ctx.lineTo(x + wobble + off * (bw + 3), rimY - 3);
      }
      ctx.stroke();
    }
  } else if (e.plunged > 0 && !e.defeated && e.wearing === 'teddy') {
    // arms round its face and not letting go
    const ty = faceTop + faceH * 0.42 + Math.sin(time * 12) * 1.2;
    const fur = tone('#b07a45');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 6, ty);
    ctx.lineTo(cx - hw - 1, ty - 3);
    ctx.moveTo(cx + 6, ty);
    ctx.lineTo(cx + hw + 1, ty - 3);
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = fur;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, ty + 4, 8.5, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 6, ty - 8.5, 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, ty - 4, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (e.plunged > 0 && !e.defeated) {
    const py0 = faceTop + faceH * 0.4;
    ctx.fillStyle = tone('#c2352f');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, py0, 9, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const wobble = Math.sin(time * 14) * 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(cx, py0);
    ctx.lineTo(cx + wobble, py0 + 19);
    ctx.stroke();
    ctx.strokeStyle = '#c98a4b';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ── arms ──
  if (!e.defeated && id !== 'fast') {
    const armY = faceTop + faceH * 0.55;
    const swing = Math.sin(e.walkPhase) * 3;
    const raise = windup * 12;
    const reach = e.ai === 'lunge' ? 9 : 0;
    const color = tone(id === 'heavy' ? '#7a4f28' : KRAFT_DARK);
    if (!type.shield) mitt(ctx, x - hw, armY, x - hw - 6 + fx * reach, armY + 4 + swing - raise + fy * reach * 0.6, color);
    mitt(ctx, x + hw, armY, x + hw + 6 + fx * reach, armY + 4 - swing - raise + fy * reach * 0.6, color);
  }

  if ((id === 'shield' || id === 'bulwark') && !e.defeated && fy >= -0.1) board();
  ctx.restore();

  if (e.defeated) return;
  drawOverhead(ctx, e, x, time, topY);
  drawHpBar(ctx, e, x, y, hw, hd);
}
