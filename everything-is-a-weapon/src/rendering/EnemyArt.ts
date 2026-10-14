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
 *   BOSSES are not boxes. Each of the twenty has a fully custom silhouette drawn
 *   by drawBossBody (no prism, no tape, no flaps). They share only the hit-flash
 *   tone, the defeat tumble, the overhead telegraphs and the HP tape.
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
  // Supersized: every boss reads across the room at a glance.
  chairman: { hw: 26, hd: 17, h: 44, side: '#232e3b', top: '#3a4a5c' },
  flusher: { hw: 26, hd: 18, h: 42, side: '#9fb3c4', top: '#dfeaf2' },
  kraken: { hw: 34, hd: 18, h: 34, side: '#522741', top: '#7a3b5c' },
  fridgezilla: { hw: 26, hd: 17, h: 52, side: '#8fa8b8', top: '#cfe0e8' },
  piano: { hw: 34, hd: 18, h: 34, side: '#121017', top: '#26232e' },
  mower: { hw: 28, hd: 17, h: 32, side: '#7d241c', top: '#c23b2e' },
  mom: { hw: 26, hd: 16, h: 50, side: '#5c2540', top: '#8a3b5c' },
  vacuumasaurus: { hw: 28, hd: 18, h: 44, side: '#2c3a24', top: '#4a5c3a' },
  hydra: { hw: 26, hd: 17, h: 42, side: '#4d5a75', top: '#7a8ba8' },
  fan: { hw: 24, hd: 14, h: 30, side: '#647687', top: '#9fb3c4' },
  popcorn: { hw: 22, hd: 15, h: 36, side: '#a87a24', top: '#e8b13c' },
  cables: { hw: 26, hd: 17, h: 38, side: '#1f1f2a', top: '#3a3a4a' },
  cooker: { hw: 27, hd: 17, h: 46, side: '#7d7668', top: '#b8b0a0' },
  train: { hw: 30, hd: 17, h: 36, side: '#1a2236', top: '#2e3a55' },
  junk: { hw: 29, hd: 18, h: 52, side: '#453a58', top: '#6b5a86' },
  house: { hw: 30, hd: 18, h: 52, side: '#74382e', top: '#a85848' },
  clock: { hw: 24, hd: 15, h: 44, side: '#2a736f', top: '#3fa7a3' },
  toybox: { hw: 26, hd: 17, h: 38, side: '#8f3f1c', top: '#d4652e' },
  dishwasher: { hw: 26, hd: 17, h: 42, side: '#4d6a7d', top: '#7a9bb0' },
  cardboard: { hw: 26, hd: 17, h: 40, side: '#9c7446', top: '#c9a070' },
};

/** Bosses with fully custom silhouettes (no box prism). */
const CUSTOM_BOSS_IDS: ReadonlyArray<EnemyTypeId> = [
  'chairman', 'flusher', 'kraken', 'fridgezilla', 'piano', 'mower', 'mom',
  'vacuumasaurus', 'hydra', 'fan', 'popcorn', 'cables', 'cooker', 'train',
  'junk', 'house', 'clock', 'toybox', 'dishwasher', 'cardboard',
];

/**
 * Boss bodies are drawn at fixed pixel sizes while their physics radius is
 * doubled, so every silhouette is blown up around the feet to match. The
 * shared telegraphs and HP strip stay unscaled and readable.
 */
const BOSS_DRAW_SCALE = 2;

const BULBS = ['#ff5a4e', '#ffd23f', '#6fe0c2', '#4ad6e8', '#ff9ec4'];

type Tone = (color: string) => string;

const SHOES: Partial<Record<EnemyTypeId, string>> = {
  basic: '#f2ece0', helmet: '#f2ece0', electric: '#ffd23f', shield: '#2a2540', fragile: '#dfeaf2',
  nested: '#e8d9b8', mini: '#f2ece0', kaboom: '#ffd23f', fast: '#e5383b', heavy: '#5c3b1e',
  gnat: '#17132a', hurler: '#2f4fb5', bulwark: STEEL_DARK, trolley: '#f2ece0',
};

/** Stubby sneakers: inked sole, coloured upper, a bright toe cap. */
function legs(ctx: Ctx, x: number, y: number, phase: number, spread: number, size: number, shoe = '#f2ece0'): void {
  const swing = Math.sin(phase) * 4;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - spread, y + swing);
  ctx.lineTo(x - spread * 0.8, y - 6);
  ctx.moveTo(x + spread, y - swing);
  ctx.lineTo(x + spread * 0.8, y - 6);
  ctx.stroke();
  for (const [sx, sy] of [[x - spread, y + swing], [x + spread, y - swing]] as const) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 0.8, size + 1.5, size * 0.7 + 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shoe;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 0.4, size, size * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(26, 14, 52, 0.22)';
    ctx.fillRect(sx - size * 0.9, sy + size * 0.18, size * 1.8, size * 0.28);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(sx - size * 0.3, sy - size * 0.35, size * 0.38, size * 0.16, 0, 0, TAU);
    ctx.fill();
  }
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

/** Vacuumasaurus: treaded apex predator with a trunk hose and opinions. */
function vacuumasaurusBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, windup } = p;
  const baseY = y + hd + 1;
  const fa = e.facing;
  // caterpillar treads
  for (const side of [-1, 1]) {
    ctx.fillStyle = tone('#1f2a1c');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(x + side * (hw * 0.55), baseY - 6, hw * 0.5, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#7a8a68');
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.arc(x + side * (hw * 0.55) + k * 9 + Math.sin(e.walkPhase * 2) * 2, baseY - 6, 2.6, 0, TAU);
      ctx.fill();
    }
  }
  // barrel body + dome head with a jaw that opens while it inhales
  ctx.fillStyle = tone('#4a5c3a');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, baseY - 30, hw, 20, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#5c7048');
  ctx.beginPath();
  ctx.ellipse(x + 6, baseY - 44, 13, 10, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const jaw = e.sucking && !e.defeated ? 9 : 2;
  ctx.fillStyle = '#17132a';
  ctx.beginPath();
  ctx.ellipse(x + 10, baseY - 40, 8, 3 + jaw, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + 4 + k * 4, baseY - 44);
    ctx.lineTo(x + 6 + k * 4, baseY - 40);
    ctx.lineTo(x + 8 + k * 4, baseY - 44);
    ctx.closePath();
    ctx.fill();
  }
  if (!e.defeated) eyes(ctx, x + 2, baseY - 48, 5, Math.cos(fa), Math.sin(fa), 3, false);
  // tail spikes
  ctx.fillStyle = tone('#2c3a24');
  for (let k = 0; k < 3; k++) {
    const sx = x - hw + 2 - k * 7;
    ctx.beginPath();
    ctx.moveTo(sx, baseY - 34 + k * 4);
    ctx.lineTo(sx - 8, baseY - 30 + k * 4);
    ctx.lineTo(sx, baseY - 26 + k * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // trunk hose towards the facing, nozzle gaping while it sucks
  const nx = x + Math.cos(fa) * (hw + 16);
  const ny = baseY - 26 + Math.sin(fa) * 10;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + hw * 0.5, baseY - 30);
  ctx.quadraticCurveTo(x + Math.cos(fa) * (hw + 10), baseY - 44, nx, ny);
  ctx.stroke();
  ctx.strokeStyle = tone('#3a4a30');
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.lineCap = 'butt';
  const gape = e.sucking && !e.defeated ? 8 : 3.4;
  ctx.fillStyle = '#17132a';
  ctx.beginPath();
  ctx.ellipse(nx, ny, gape + 3, gape, fa, 0, TAU);
  ctx.fill();
  // tiny arms, purely decorative, deeply confident
  mitt(ctx, x - 6, baseY - 26, x - 12, baseY - 18, tone('#2c3a24'));
  mitt(ctx, x + 6, baseY - 26, x + 12, baseY - 18 - windup * 6, tone('#2c3a24'));
}

/** Laundry Hydra: one basket, three sock serpents, zero matching pairs. */
function hydraBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy } = p;
  const baseY = y + hd + 1;
  const lash = e.lashProgress;
  // sock serpents first (behind the basket)
  const socks: ReadonlyArray<readonly [string, string]> = [['#d4652e', '#fbf6e9'], ['#3fa7a3', '#17132a'], ['#b56576', '#ffd23f']];
  for (let i = 0; i < 3; i++) {
    const [sock, trim] = socks[i]!;
    const spread = (i - 1) * 0.75;
    const rest = -Math.PI / 2 + spread;
    const wave = Math.sin(time * 2.6 + i * 2.1 + e.seed) * 0.25;
    const dir = rest + wave + angleDiffSafe(rest, e.facing) * lash * 0.5;
    const len = 34 + Math.sin(time * 2.6 + i * 2.1) * 5 + lash * 16;
    const tx = x + Math.cos(dir) * len;
    const ty = baseY - 20 + Math.sin(dir) * len;
    const mx = x + Math.cos(dir) * len * 0.55;
    const my = baseY - 20 + Math.sin(dir) * len * 0.55;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 18);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = tone(sock);
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 18);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = tone(trim);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + (mx - x) * 0.4, baseY - 18 + (my - baseY + 18) * 0.4 - 3);
    ctx.lineTo(x + (mx - x) * 0.4, baseY - 18 + (my - baseY + 18) * 0.4 + 3);
    ctx.moveTo(x + (mx - x) * 0.75, baseY - 18 + (my - baseY + 18) * 0.75 - 3);
    ctx.lineTo(x + (mx - x) * 0.75, baseY - 18 + (my - baseY + 18) * 0.75 + 3);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // toe-cap head with eyes
    ctx.fillStyle = tone(sock);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(tx, ty, 7.5, 6, dir, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (!e.defeated) eyes(ctx, tx, ty - 1, 3.4, fx, fy, 2.2, false);
  }
  // the basket: weave, rim, and one escapee sock over the edge
  ctx.fillStyle = tone('#7a8ba8');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 30);
  ctx.lineTo(x + hw, baseY - 30);
  ctx.lineTo(x + hw - 8, baseY);
  ctx.lineTo(x - hw + 8, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.5)';
  ctx.lineWidth = 1.6;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    ctx.moveTo(x - hw + 3 + r * 2, baseY - 24 + r * 8);
    ctx.lineTo(x + hw - 3 - r * 2, baseY - 24 + r * 8);
    ctx.stroke();
  }
  ctx.fillStyle = tone('#4d5a75');
  ctx.fillRect(x - hw - 2, baseY - 34, hw * 2 + 4, 6);
  ctx.strokeRect(x - hw - 2, baseY - 34, hw * 2 + 4, 6);
  ctx.strokeStyle = tone('#d4652e');
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + hw - 12, baseY - 30);
  ctx.quadraticCurveTo(x + hw - 4, baseY - 18, x + hw - 10, baseY - 8);
  ctx.stroke();
}

/** Fan-tastic Nightmare: hovers, swoops, and seeds cyclones. */
function fanBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const hover = 14 + Math.sin(time * 3 + e.seed) * 4;
  const baseY = y + hd + 1 - hover;
  // ribbon streamers trailing underneath
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 8, baseY + 6);
    ctx.quadraticCurveTo(
      x + side * (12 + Math.sin(time * 5 + side) * 5), baseY + 16,
      x + side * (8 + Math.cos(time * 5) * 5), baseY + 26,
    );
    ctx.stroke();
  }
  // light dome (glowing) + motor + spinning blades with blur
  ctx.fillStyle = 'rgba(255, 242, 122, 0.9)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, baseY + 2, 9, 7, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#647687');
  ctx.beginPath();
  ctx.ellipse(x, baseY - 8, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const spin = time * 12;
  for (const pass of [0.35, 1]) {
    ctx.fillStyle = pass === 1 ? tone('#9fb3c4') : 'rgba(159, 179, 196, 0.35)';
    for (let k = 0; k < 4; k++) {
      const a = spin * (pass === 1 ? 1 : 1.06) + (k * TAU) / 4;
      ctx.save();
      ctx.translate(x, baseY - 8);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(hw * 0.62, 0, hw * 0.55, 7, 0.12, 0, TAU);
      ctx.fill();
      if (pass === 1) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.fillStyle = tone('#3a4552');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x, baseY - 8, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // pull chains + eyes on the motor, glaring down the spin
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + 4, baseY - 2);
  ctx.lineTo(x + 4 + Math.sin(time * 9) * 2, baseY + 8);
  ctx.stroke();
  ctx.fillStyle = tone('#ffd23f');
  ctx.beginPath();
  ctx.arc(x + 4 + Math.sin(time * 9) * 2, baseY + 10, 2, 0, TAU);
  ctx.fill();
  if (!e.defeated) eyes(ctx, x + fx * 3, baseY - 10, 4.6, fx, fy, 2.8, false);
  if (windup > 0.2 && !e.defeated) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY - 22);
    ctx.lineTo(x - 2, baseY - 18);
    ctx.moveTo(x + 10, baseY - 22);
    ctx.lineTo(x + 2, baseY - 18);
    ctx.stroke();
  }
}

/** Popcorn Apocalypse: a microwave wizard. The hat is load-bearing. */
function popcornBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy } = p;
  const baseY = y + hd + 1;
  // stubby feet + cape
  ctx.fillStyle = tone('#5c3a1c');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  for (const side of [-1, 1]) {
    const step = Math.sin(e.walkPhase + (side > 0 ? Math.PI : 0)) * 3;
    ctx.beginPath();
    ctx.ellipse(x + side * 10, baseY - 2 + step * 0.3, 6, 4, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = tone('#8f2a3a');
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 34);
  ctx.lineTo(x - hw - 8, baseY - 2);
  ctx.lineTo(x - hw + 6, baseY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // microwave body: door window with popcorn, buttons, countdown bars
  ctx.fillStyle = tone('#e8b13c');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.fillRect(x - hw, baseY - 52, hw * 2, 34);
  ctx.strokeRect(x - hw, baseY - 52, hw * 2, 34);
  ctx.fillStyle = '#17132a';
  ctx.fillRect(x - hw + 4, baseY - 48, hw * 1.1, 26);
  const pop = Math.abs(Math.sin(time * 7 + e.seed));
  ctx.fillStyle = '#fbf6e9';
  for (let k = 0; k < 5; k++) {
    const px = x - hw + 8 + ((k * 7919) % 23);
    const py = baseY - 46 + ((k * 4799 + Math.floor(time * 7) * 3) % 20);
    ctx.fillRect(px, py, 3, 3);
  }
  void pop;
  ctx.fillStyle = tone('#2a2330');
  ctx.fillRect(x + hw - 12, baseY - 48, 8, 26);
  ctx.fillStyle = '#ff5a4e';
  ctx.font = '700 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('3:33', x + hw - 8, baseY - 36);
  ctx.fillStyle = tone('#ffd23f');
  ctx.fillRect(x + hw - 11, baseY - 32, 6, 3);
  if (!e.defeated) eyes(ctx, x + fx * 4, baseY - 56, 6, fx, fy, 3, false);
  // wizard hat with stars + wand raised with the throw telegraph
  ctx.fillStyle = tone('#2f4fb5');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x - 13, baseY - 58);
  ctx.lineTo(x + 2 + Math.sin(time * 2) * 3, baseY - 96);
  ctx.lineTo(x + 15, baseY - 58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#ffd23f');
  for (const [sx, sy] of [[-5, -68], [4, -78], [0, -88]] as const) {
    ctx.beginPath();
    ctx.arc(x + sx, baseY + sy, 1.8, 0, TAU);
    ctx.fill();
  }
  const raise = e.hurlProgress;
  mitt(ctx, x + hw - 2, baseY - 40, x + hw + 8, baseY - 52 - raise * 14, tone('#a87a24'));
  ctx.strokeStyle = tone('#6b4d1c');
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + hw + 8, baseY - 52 - raise * 14);
  ctx.lineTo(x + hw + 16, baseY - 62 - raise * 14);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = tone('#ffd23f');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x + hw + 16, baseY - 64 - raise * 14, 4, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** Cable Kraken: live wire nest with plug tentacles and a breaker-switch mouth. */
function cablesBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy } = p;
  const baseY = y + hd + 1;
  const lash = e.lashProgress;
  // plug tentacles behind the nest
  for (let i = -1; i <= 1; i++) {
    const rest = -Math.PI / 2 + i * 0.8;
    const wave = Math.sin(time * 4 + i * 2.4 + e.seed) * 0.2;
    const dir = rest + wave + angleDiffSafe(rest, e.facing) * lash * 0.5;
    const len = 34 + lash * 18;
    const tx = x + Math.cos(dir) * len;
    const ty = baseY - 16 + Math.sin(dir) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 14);
    ctx.quadraticCurveTo(x + Math.cos(dir) * len * 0.5, baseY - 16 + Math.sin(dir) * len * 0.5, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = tone(i === 0 ? '#e5383b' : i > 0 ? '#2f4fb5' : '#ffd23f');
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 14);
    ctx.quadraticCurveTo(x + Math.cos(dir) * len * 0.5, baseY - 16 + Math.sin(dir) * len * 0.5, tx, ty);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // plug head + prongs + spark tip
    ctx.fillStyle = tone('#fbf6e9');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(dir);
    ctx.fillRect(-3, -5, 9, 10);
    ctx.strokeRect(-3, -5, 9, 10);
    ctx.fillRect(6, -3.4, 4, 2.4);
    ctx.fillRect(6, 1, 4, 2.4);
    ctx.restore();
    const flick = hash(Math.floor(time * 20) + i * 7 + e.seed);
    if (flick > 0.45 && !e.defeated) {
      ctx.fillStyle = flick > 0.75 ? '#fff27a' : '#4ad6e8';
      ctx.beginPath();
      ctx.arc(tx + Math.cos(dir) * 12, ty + Math.sin(dir) * 12, 2.4 + flick * 2, 0, TAU);
      ctx.fill();
    }
  }
  // the nest: looping live wire
  ctx.lineCap = 'round';
  for (const [w, c] of [[16, INK], [11, '#3a3a4a']] as const) {
    ctx.strokeStyle = tone(c);
    ctx.lineWidth = w as number;
    ctx.beginPath();
    ctx.ellipse(x, baseY - 18, hw, 15, 0.15, 0, TAU);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.strokeStyle = tone('#565664');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x - 6, baseY - 22, hw * 0.7, 10, -0.2, 0.4, 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 8, baseY - 14, hw * 0.6, 9, 0.3, 3.4, 5.6);
  ctx.stroke();
  // socket faceplate: slot eyes + breaker-switch mouth
  ctx.fillStyle = tone('#fbf6e9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.fillRect(x - 11, baseY - 30, 22, 18);
  ctx.strokeRect(x - 11, baseY - 30, 22, 18);
  if (!e.defeated) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6 + fx * 1.5, baseY - 25 + fy, 3, 6);
    ctx.fillRect(x + 3 + fx * 1.5, baseY - 25 + fy, 3, 6);
    const open = e.shockTimer > 0 || lash > 0.3 ? 6 : 2;
    ctx.fillRect(x - 4, baseY - 16, 8, open);
  }
}

/** Pressure Cooker: a boiler with a gauge, a rocking weight, and no chill. */
function cookerBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const boiling = e.phaseIndex > 0 && !e.defeated;
  // feet + pot belly
  ctx.fillStyle = tone('#3a352c');
  ctx.fillRect(x - 14, baseY - 4, 8, 4);
  ctx.fillRect(x + 6, baseY - 4, 8, 4);
  ctx.fillStyle = tone('#b8b0a0');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - 4);
  ctx.lineTo(x - hw + 5, baseY - 44);
  ctx.lineTo(x + hw - 5, baseY - 44);
  ctx.lineTo(x + hw, baseY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // MAX fill line + side handles
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - hw + 7, baseY - 30);
  ctx.lineTo(x - hw + 16, baseY - 30);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + side * hw, baseY - 26);
    ctx.lineTo(x + side * (hw + 10), baseY - 30);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // lid + rocking weight + gauge with a nervous needle
  ctx.fillStyle = tone('#8f8878');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(x, baseY - 46, hw - 2, 7, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const rock = boiling ? Math.sin(time * 14) * 0.35 : Math.sin(time * 3) * 0.08;
  ctx.save();
  ctx.translate(x, baseY - 54);
  ctx.rotate(rock);
  ctx.fillStyle = tone('#5c564a');
  ctx.fillRect(-4, -8, 8, 9);
  ctx.strokeRect(-4, -8, 8, 9);
  ctx.restore();
  const needle = Math.sin(time * (boiling ? 9 : 2) + e.seed) * 0.7 - 0.4;
  ctx.fillStyle = tone('#fbf6e9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + hw - 12, baseY - 32, 7, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + hw - 12, baseY - 32);
  ctx.lineTo(x + hw - 12 + Math.sin(needle) * 5, baseY - 32 - Math.cos(needle) * 5);
  ctx.stroke();
  // worried eyes + valve brows + whistle mouth
  if (!e.defeated) {
    eyes(ctx, x + fx * 4, baseY - 24, 7, fx, fy, 3.2, false);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 13, baseY - 36);
    ctx.lineTo(x - 4, baseY - 33);
    ctx.moveTo(x + 13, baseY - 36);
    ctx.lineTo(x + 4, baseY - 33);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + fx * 3, baseY - 13, 3.4, 2.4 + windup * 3 + (e.ai === 'slam' ? 3 : 0), 0, 0, TAU);
    ctx.fill();
  }
  // steam valves on both sides, always leaking a little, gushing on slam
  const gush = e.ai === 'slam' && !e.defeated ? 3 : 1;
  ctx.fillStyle = 'rgba(228, 247, 251, 0.85)';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const t = (time * 1.6 + i * 0.5 + (side > 0 ? 0.25 : 0) + e.seed * 0.01) % 1;
      ctx.beginPath();
      ctx.arc(x + side * (hw + 6 + t * 12 * gush), baseY - 34 - t * 16, (2 + t * 3) * (gush > 1 ? 1.4 : 1), 0, TAU);
      ctx.fill();
    }
  }
}

/** Midnight Express: side-view engine with cars, rotating to face travel. */
function trainBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx } = p;
  const baseY = y + hd + 1;
  const dir = fx >= 0 ? 1 : -1;
  const charging = e.ai === 'lunge' || e.ai === 'windup';
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(dir, 1);
  ctx.translate(-x, 0);
  // cars behind (drawn first)
  for (let c = 1; c <= 2; c++) {
    const cx = x - c * 44;
    ctx.fillStyle = tone(c === 1 ? '#5c4a6e' : '#3f5a4c');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(cx - 18, baseY - 34, 36, 22);
    ctx.strokeRect(cx - 18, baseY - 34, 36, 22);
    // cargo: a fridge, then a lamp
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    if (c === 1) {
      ctx.fillStyle = tone('#aab4c4');
      ctx.fillRect(cx - 8, baseY - 48, 16, 14);
      ctx.strokeRect(cx - 8, baseY - 48, 16, 14);
    } else {
      ctx.fillStyle = tone('#ffd23f');
      ctx.beginPath();
      ctx.moveTo(cx, baseY - 34);
      ctx.lineTo(cx, baseY - 48);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, baseY - 51, 7, 5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    for (const wx of [-10, 10]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx + wx, baseY - 8, 6, 0, TAU);
      ctx.fill();
    }
  }
  const spin = e.walkPhase * (charging ? 5 : 2.5);
  // engine: boiler, cab, chimney, cowcatcher, headlight
  ctx.fillStyle = tone('#2e3a55');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + 6, baseY - 26, 26, 13, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#1a2236');
  ctx.fillRect(x - 22, baseY - 48, 24, 24);
  ctx.strokeRect(x - 22, baseY - 48, 24, 24);
  ctx.fillStyle = '#9fd8e8';
  ctx.fillRect(x - 18, baseY - 44, 16, 10);
  ctx.strokeRect(x - 18, baseY - 44, 16, 10);
  if (!e.defeated) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 13, baseY - 39, 3, 0, TAU);
    ctx.arc(x - 5, baseY - 39, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - 13, baseY - 39, 1.4, 0, TAU);
    ctx.arc(x - 5, baseY - 39, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tone('#1a2236');
  ctx.fillRect(x + 22, baseY - 52, 8, 16);
  ctx.strokeRect(x + 22, baseY - 52, 8, 16);
  // smoke: faster while charging
  ctx.fillStyle = 'rgba(120, 120, 130, 0.75)';
  for (let i = 0; i < 3; i++) {
    const t = (time * (charging ? 2.4 : 1.1) + i * 0.33 + e.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(x + 26 + t * 22, baseY - 56 - t * 26, 3 + t * 6, 0, TAU);
    ctx.fill();
  }
  // cowcatcher + headlight + drivers
  ctx.fillStyle = tone('#c23b2e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + hw - 2, baseY - 6);
  ctx.lineTo(x + hw + 14, baseY - 6);
  ctx.lineTo(x + hw - 2, baseY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6c9';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x + hw - 4, baseY - 28, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (const wx of [-14, 8, 26]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + wx, baseY - 8, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = tone('#aab4c4');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + wx + Math.cos(spin) * 6, baseY - 8 + Math.sin(spin) * 6);
    ctx.lineTo(x + wx - Math.cos(spin) * 6, baseY - 8 - Math.sin(spin) * 6);
    ctx.stroke();
  }
  ctx.restore();
  void time;
}

/** King of Junk: wardrobe tower, lamp arms, TV head, bottle-cap crown. */
function junkBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const top = baseY - 72;
  // wardrobe tower + drawers, one hanging open with a sock in it
  ctx.fillStyle = tone('#6b5a86');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x - hw + 4, top + 18, hw * 2 - 8, 52);
  ctx.strokeRect(x - hw + 4, top + 18, hw * 2 - 8, 52);
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 18);
  ctx.lineTo(x, top + 70);
  ctx.stroke();
  ctx.fillStyle = tone('#453a58');
  for (const dy of [24, 38, 52]) {
    ctx.beginPath();
    ctx.arc(x - 5, top + dy, 2, 0, TAU);
    ctx.arc(x + 5, top + dy, 2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tone('#453a58');
  ctx.fillRect(x + 6, top + 58, 16, 10);
  ctx.strokeStyle = INK;
  ctx.strokeRect(x + 6, top + 58, 16, 10);
  ctx.strokeStyle = tone('#d4652e');
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + 10, top + 58);
  ctx.quadraticCurveTo(x + 16, top + 50, x + 12, top + 44);
  ctx.stroke();
  // lamp arms, one lit
  for (const side of [-1, 1]) {
    mitt(ctx, x + side * (hw - 4), baseY - 44, x + side * (hw + 8), baseY - 52, tone('#453a58'));
    ctx.fillStyle = side < 0 && !e.defeated ? 'rgba(255, 242, 122, 0.9)' : tone('#ecdcab');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + side * (hw + 8) - 7, baseY - 62);
    ctx.lineTo(x + side * (hw + 8) + 7, baseY - 62);
    ctx.lineTo(x + side * (hw + 8) + 4, baseY - 48);
    ctx.lineTo(x + side * (hw + 8) - 4, baseY - 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // TV head with static + crown of bottle caps
  ctx.fillStyle = tone('#2a2330');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x - 17, top - 4, 34, 24);
  ctx.strokeRect(x - 17, top - 4, 34, 24);
  for (let k = 0; k < 14; k++) {
    const flick = hash(Math.floor(time * 12) + k * 31 + e.seed);
    if (flick > 0.5) {
      ctx.fillStyle = 'rgba(251, 246, 233, 0.8)';
      ctx.fillRect(x - 14 + (k * 53) % 28, top + (k * 37) % 18, 2, 2);
    }
  }
  if (!e.defeated) eyes(ctx, x + fx * 3, top + 8, 7, fx, fy, 3.2, false);
  for (let k = -1; k <= 1; k++) {
    ctx.fillStyle = tone(k === 0 ? '#ffd23f' : '#c23b2e');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + k * 11, top - 8, 4.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // cable scarf + drawer mouth that opens with the windup
  ctx.strokeStyle = tone('#1f1f2a');
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - hw + 2, top + 34);
  ctx.quadraticCurveTo(x, top + 42 + Math.sin(time * 2) * 2, x + hw - 2, top + 34);
  ctx.stroke();
  if (!e.defeated) {
    ctx.fillStyle = '#17132a';
    ctx.fillRect(x - 10, top + 44, 20, 4 + windup * 8);
  }
  void time;
}

/** The House That Hates You: roof, chimney, window eyes, door mouth. */
function houseBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const wallTop = baseY - 46;
  const roofTop = baseY - 72;
  // walls + roof + chimney with smoke
  ctx.fillStyle = tone('#a85848');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x - hw, wallTop, hw * 2, 46);
  ctx.strokeRect(x - hw, wallTop, hw * 2, 46);
  ctx.fillStyle = tone('#5c2e28');
  ctx.beginPath();
  ctx.moveTo(x - hw - 6, wallTop);
  ctx.lineTo(x, roofTop);
  ctx.lineTo(x + hw + 6, wallTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#74382e');
  ctx.fillRect(x + hw * 0.4, roofTop + 4, 10, 16);
  ctx.strokeRect(x + hw * 0.4, roofTop + 4, 10, 16);
  ctx.fillStyle = 'rgba(120, 120, 130, 0.7)';
  for (let i = 0; i < 2; i++) {
    const t = (time * 0.9 + i * 0.5 + e.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(x + hw * 0.4 + 5 + t * 10, roofTop - t * 22, 2.5 + t * 4, 0, TAU);
    ctx.fill();
  }
  // attic eye + window eyes with curtains
  ctx.fillStyle = tone('#ffd23f');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, roofTop + 12, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (!e.defeated) {
    for (const side of [-1, 1]) {
      const wx = x + side * (hw * 0.55);
      ctx.fillStyle = tone('#fbf6e9');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.fillRect(wx - 9, wallTop + 8, 18, 14);
      ctx.strokeRect(wx - 9, wallTop + 8, 18, 14);
      ctx.fillStyle = tone('#8a3b5c');
      ctx.fillRect(wx - 9, wallTop + 8, 4, 14);
      ctx.fillRect(wx + 5, wallTop + 8, 4, 14);
      eyes(ctx, wx + fx * 2, wallTop + 15, 4.4, fx, fy, 2.6, false);
    }
    // brows on the walls
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - hw + 4, wallTop + 4);
    ctx.lineTo(x - 12, wallTop + 8);
    ctx.moveTo(x + hw - 4, wallTop + 4);
    ctx.lineTo(x + 12, wallTop + 8);
    ctx.stroke();
  }
  // the door mouth: planks for teeth, opens with the windup
  const gape = 3 + windup * 12 + (e.ai === 'slam' ? 8 : 0);
  ctx.fillStyle = tone('#3a231e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.fillRect(x - 11, baseY - 26, 22, 8 + gape);
  ctx.strokeRect(x - 11, baseY - 26, 22, 8 + gape);
  ctx.fillStyle = tone('#ecdcab');
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(x - 9 + k * 5.4, baseY - 26, 3, 4);
    if (gape > 6) ctx.fillRect(x - 9 + k * 5.4, baseY - 22 + gape, 3, 3);
  }
  // doormat: GO AWAY
  ctx.fillStyle = tone('#5c6b58');
  ctx.fillRect(x - 14, baseY - 4, 28, 5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 14, baseY - 4, 28, 5);
}

/** Time-Thief Alarm Clock: twin bells, spinning hands, cracked glass at half. */
function clockBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy } = p;
  const baseY = y + hd + 1;
  const r = hw;
  // legs + twin bells + hammer going spare
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 10, baseY - r * 0.7);
    ctx.lineTo(x + side * 14, baseY);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const side of [-1, 1]) {
    ctx.fillStyle = tone('#c9a24f');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x + side * (r * 0.62), baseY - r * 1.62, 7, Math.PI, TAU);
    ctx.fill();
    ctx.stroke();
  }
  const hammer = Math.sin(time * 30) * 0.5;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x, baseY - r * 1.62 - 4);
  ctx.lineTo(x + hammer * 14, baseY - r * 1.62 - 12);
  ctx.stroke();
  // face + ticks + spinning hands
  ctx.fillStyle = tone('#fbf6e9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(x, baseY - r * 0.75, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let k = 0; k < 12; k++) {
    const a = (k * TAU) / 12;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 2), baseY - r * 0.75 + Math.sin(a) * (r - 2));
    ctx.lineTo(x + Math.cos(a) * (r - 7), baseY - r * 0.75 + Math.sin(a) * (r - 7));
    ctx.stroke();
  }
  const cy = baseY - r * 0.75;
  const ha = time * 0.8 + e.seed;
  const ma = -time * 3.2;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(ha) * r * 0.45, cy + Math.sin(ha) * r * 0.45);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(ma) * r * 0.7, cy + Math.sin(ma) * r * 0.7);
  ctx.stroke();
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 1.6;
  const sa = time * 7;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(sa) * r * 0.8, cy + Math.sin(sa) * r * 0.8);
  ctx.stroke();
  // eyes ride the minute hand's hub; cracked glass past half health
  if (!e.defeated) eyes(ctx, x + fx * 2, cy + 9, 5, fx, fy, 2.8, false);
  if (e.phaseIndex > 0) {
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, cy - r * 0.8);
    ctx.lineTo(x + r * 0.2, cy - r * 0.3);
    ctx.lineTo(x + r * 0.5, cy);
    ctx.lineTo(x + r * 0.1, cy + r * 0.4);
    ctx.stroke();
  }
}

/** Toybox Titan: open chest, peeking toys, crank, and a lid that means it. */
function toyboxBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  const bounce = Math.abs(Math.sin(e.walkPhase)) * 2;
  // chest + open lid
  ctx.fillStyle = tone('#d4652e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x - hw, baseY - 26, hw * 2, 26);
  ctx.strokeRect(x - hw, baseY - 26, hw * 2, 26);
  ctx.strokeStyle = tone('#ffd23f');
  ctx.lineWidth = 2;
  ctx.strokeRect(x - hw + 4, baseY - 22, hw * 2 - 8, 18);
  ctx.save();
  ctx.translate(x - hw + 3, baseY - 26);
  ctx.rotate(-0.5 - bounce * 0.02);
  ctx.fillStyle = tone('#a84a20');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.fillRect(0, -14, hw * 2 - 6, 13);
  ctx.strokeRect(0, -14, hw * 2 - 6, 13);
  ctx.restore();
  // peeking toys: ball, duck, blocks
  ctx.fillStyle = tone('#e5383b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - hw * 0.55, baseY - 32 - bounce, 7, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#ffd23f');
  ctx.beginPath();
  ctx.arc(x + hw * 0.1, baseY - 34 - bounce * 1.4, 6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#2f4fb5');
  ctx.fillRect(x + hw * 0.42, baseY - 40 - bounce * 0.7, 11, 11);
  ctx.strokeRect(x + hw * 0.42, baseY - 40 - bounce * 0.7, 11, 11);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('B', x + hw * 0.42 + 5.5, baseY - 32 - bounce * 0.7);
  // crank turning steadily towards the next toy
  const crank = time * 2.2 + e.seed;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x + hw, baseY - 14);
  ctx.lineTo(x + hw + 8, baseY - 14);
  ctx.lineTo(x + hw + 8 + Math.cos(crank) * 6, baseY - 14 + Math.sin(crank) * 6);
  ctx.stroke();
  ctx.fillStyle = tone('#aab4c4');
  ctx.beginPath();
  ctx.arc(x + hw + 8 + Math.cos(crank) * 6, baseY - 14 + Math.sin(crank) * 6, 2.6, 0, TAU);
  ctx.fill();
  // lock-eyes + keyhole mouth that opens for the lid slam
  if (!e.defeated) {
    eyes(ctx, x + fx * 4, baseY - 15, 6.4, fx, fy, 3, false);
    ctx.fillStyle = '#17132a';
    const gape = 2.4 + windup * 4 + (e.ai === 'slam' ? 5 : 0);
    ctx.beginPath();
    ctx.arc(x + fx * 4, baseY - 5, 3, 0, TAU);
    ctx.fillRect(x + fx * 4 - 1.4, baseY - 5, 2.8, gape);
    ctx.fill();
  }
}

/** Dishwasher Demon: front-loader with a storm behind glass. */
function dishwasherBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy, windup } = p;
  const baseY = y + hd + 1;
  // feet + body + control panel
  ctx.fillStyle = tone('#3a4a56');
  ctx.fillRect(x - 13, baseY - 4, 7, 4);
  ctx.fillRect(x + 6, baseY - 4, 7, 4);
  ctx.fillStyle = tone('#7a9bb0');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x - hw, baseY - 56, hw * 2, 56);
  ctx.strokeRect(x - hw, baseY - 56, hw * 2, 56);
  ctx.fillStyle = tone('#4d6a7d');
  ctx.fillRect(x - hw, baseY - 56, hw * 2, 12);
  ctx.strokeRect(x - hw, baseY - 56, hw * 2, 12);
  // dial + panel eyes
  const dial = time * 1.5 + e.seed;
  ctx.fillStyle = tone('#fbf6e9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - hw + 10, baseY - 50, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - hw + 10, baseY - 50);
  ctx.lineTo(x - hw + 10 + Math.cos(dial) * 4, baseY - 50 + Math.sin(dial) * 4);
  ctx.stroke();
  if (!e.defeated) eyes(ctx, x + hw * 0.3 + fx * 2, baseY - 50, 5, fx, fy, 2.6, false);
  // porthole: dark glass, spinning spray arcs, tumbling plates
  ctx.fillStyle = '#101821';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, baseY - 26, 15, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(159, 216, 232, 0.9)';
  ctx.lineWidth = 2.2;
  for (let k = 0; k < 2; k++) {
    const a0 = time * 4 + k * Math.PI + e.seed;
    ctx.beginPath();
    ctx.arc(x, baseY - 26, 6 + k * 4, a0, a0 + 2.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(251, 246, 233, 0.85)';
  for (let k = 0; k < 2; k++) {
    const a = -time * 3 + k * Math.PI * 0.9;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 8, baseY - 26 + Math.sin(a) * 8, 4, 2.6, a, 0, TAU);
    ctx.fill();
  }
  // water pouring from the vent + worried brows
  ctx.fillStyle = 'rgba(159, 216, 232, 0.8)';
  for (let k = 0; k < 3; k++) {
    const t = (time * 2 + k * 0.33 + e.seed * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(x - 8 + k * 8, baseY - 2 - t * 4, 1.6 + t, 0, TAU);
    ctx.fill();
  }
  if (!e.defeated) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 14, baseY - 62);
    ctx.lineTo(x - 5, baseY - 59);
    ctx.moveTo(x + 14, baseY - 62);
    ctx.lineTo(x + 5, baseY - 59);
    ctx.stroke();
    tearMouth(ctx, x + fx * 3, baseY - 8, 5, windup);
  }
}

/** King of Cardboard in three coronations: tank, chopper, robot. */
function cardboardBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  const { hw, hd, tone, fx, fy } = p;
  const baseY = y + hd + 1;
  const form = e.form % 3;
  if (form === 0) {
    // TANK: low hull, turret, barrel, treads
    for (const side of [-1, 1]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x + side * hw * 0.55, baseY - 7, hw * 0.5, 9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = tone('#7a5f36');
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(x + side * hw * 0.55 + k * 9 + Math.sin(e.walkPhase * 2) * 2, baseY - 7, 2.8, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = tone('#c9a070');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(x, baseY - 22, hw, 13, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#9c7446');
    ctx.beginPath();
    ctx.arc(x - fx * 2, baseY - 30, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#6e522e');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.save();
    ctx.translate(x - fx * 2, baseY - 30);
    ctx.rotate(Math.atan2(fy, fx));
    ctx.fillRect(0, -3.4, hw + 12, 6.8);
    ctx.strokeRect(0, -3.4, hw + 12, 6.8);
    ctx.restore();
    if (!e.defeated) eyes(ctx, x - fx * 2, baseY - 32, 5, fx, fy, 2.6, false);
    ctx.fillStyle = tone('#e5383b');
    ctx.font = '700 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', x + hw * 0.4, baseY - 18);
  } else if (form === 1) {
    // CHOPPER: hovering cabin, tail boom, spinning rotor, skids
    const hover = 10 + Math.sin(time * 3.4 + e.seed) * 3;
    const cy = baseY - 22 - hover;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 8, baseY - 14);
      ctx.lineTo(x + side * 12, baseY - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = tone('#6e522e');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - hw, cy + 2);
    ctx.lineTo(x - hw - 16, cy - 8);
    ctx.stroke();
    ctx.fillStyle = tone('#c9a070');
    ctx.fillRect(x - hw - 20, cy - 12, 8, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw - 20, cy - 12, 8, 8);
    ctx.fillStyle = tone('#c9a070');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(x, cy, hw * 0.72, 13, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const spin = time * 16;
    for (const pass of [0.3, 1]) {
      ctx.strokeStyle = pass === 1 ? INK : 'rgba(34, 27, 54, 0.3)';
      ctx.lineWidth = pass === 1 ? 4 : 8;
      ctx.beginPath();
      ctx.moveTo(x - hw - 6, cy - 16);
      ctx.lineTo(x + hw + 6, cy - 16);
      ctx.stroke();
      void spin;
    }
    ctx.save();
    ctx.translate(x, cy - 16);
    ctx.rotate(spin * 0.2);
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-hw - 6, 0);
    ctx.lineTo(hw + 6, 0);
    ctx.stroke();
    ctx.restore();
    if (!e.defeated) {
      ctx.fillStyle = '#9fd8e8';
      ctx.fillRect(x - 2, cy - 4, 16, 9);
      ctx.strokeRect(x - 2, cy - 4, 16, 9);
      eyes(ctx, x + 6, cy, 5, fx, fy, 2.4, false);
    }
  } else {
    // ROBOT: torso, visor head, cannon arm, stompy legs
    legs(ctx, x, baseY, e.walkPhase, 9, 5.5);
    ctx.fillStyle = tone('#c9a070');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.fillRect(x - 13, baseY - 40, 26, 24);
    ctx.strokeRect(x - 13, baseY - 40, 26, 24);
    ctx.fillStyle = tone('#9c7446');
    ctx.fillRect(x - 13, baseY - 26, 26, 5);
    ctx.fillStyle = tone('#2a2530');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(x - 11, baseY - 56, 22, 15);
    ctx.strokeRect(x - 11, baseY - 56, 22, 15);
    if (!e.defeated) {
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath();
      ctx.arc(x - 4 + fx * 2, baseY - 48, 2.6, 0, TAU);
      ctx.arc(x + 4 + fx * 2, baseY - 48, 2.6, 0, TAU);
      ctx.fill();
      const raise = e.hurlProgress;
      mitt(ctx, x - 13, baseY - 32, x - 19, baseY - 24, tone('#9c7446'));
      mitt(ctx, x + 13, baseY - 32, x + 19 + fx * 4, baseY - 34 - raise * 12, tone('#9c7446'));
      ctx.fillStyle = tone('#4a4440');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.fillRect(x + 14 + fx * 4, baseY - 42 - raise * 12, 16, 9);
      ctx.strokeRect(x + 14 + fx * 4, baseY - 42 - raise * 12, 16, 9);
    }
  }
}

/** Dispatches the twenty custom boss silhouettes. */
function drawBossBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw): void {
  switch (e.type.id) {
    case 'chairman': chairmanBody(ctx, e, x, y, time, p); break;
    case 'flusher': flusherBody(ctx, e, x, y, time, p); break;
    case 'kraken': krakenBody(ctx, e, x, y, time, p); break;
    case 'fridgezilla': fridgezillaBody(ctx, e, x, y, time, p); break;
    case 'piano': pianoBody(ctx, e, x, y, time, p); break;
    case 'mower': mowerBody(ctx, e, x, y, time, p); break;
    case 'mom': momBody(ctx, e, x, y, time, p); break;
    case 'vacuumasaurus': vacuumasaurusBody(ctx, e, x, y, time, p); break;
    case 'hydra': hydraBody(ctx, e, x, y, time, p); break;
    case 'fan': fanBody(ctx, e, x, y, time, p); break;
    case 'popcorn': popcornBody(ctx, e, x, y, time, p); break;
    case 'cables': cablesBody(ctx, e, x, y, time, p); break;
    case 'cooker': cookerBody(ctx, e, x, y, time, p); break;
    case 'train': trainBody(ctx, e, x, y, time, p); break;
    case 'junk': junkBody(ctx, e, x, y, time, p); break;
    case 'house': houseBody(ctx, e, x, y, time, p); break;
    case 'clock': clockBody(ctx, e, x, y, time, p); break;
    case 'toybox': toyboxBody(ctx, e, x, y, time, p); break;
    case 'dishwasher': dishwasherBody(ctx, e, x, y, time, p); break;
    case 'cardboard': cardboardBody(ctx, e, x, y, time, p); break;
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

/** Wear on a cardboard face: a lit left edge, a shaded right edge, a bottom fold, a few scuffs. */
function boxSurface(ctx: Ctx, e: Enemy, x: number, faceTop: number, faceBottom: number, hw: number): void {
  const faceH = faceBottom - faceTop;
  ctx.fillStyle = 'rgba(255, 244, 210, 0.22)';
  ctx.fillRect(x - hw + 1.5, faceTop + 1.5, 2.2, faceH - 3);
  ctx.fillStyle = 'rgba(26, 14, 52, 0.2)';
  ctx.fillRect(x + hw - 3.7, faceTop + 1.5, 2.2, faceH - 3);
  ctx.fillStyle = 'rgba(26, 14, 52, 0.22)';
  ctx.fillRect(x - hw + 1, faceBottom - 6, hw * 2 - 2, 1.4);
  ctx.strokeStyle = 'rgba(255, 244, 210, 0.3)';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const sx = x - hw + 4 + hash(e.seed + i * 7) * (hw * 2 - 12);
    const sy = faceTop + 4 + hash(e.seed + i * 13) * (faceH - 14);
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 3.5, sy + 2.2);
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
  if (id === 'basic' || id === 'mini') {
    // packing peanuts spilling out of the lid, bouncing as it walks
    const bob = Math.abs(Math.sin(e.walkPhase)) * 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const [ox, oy, r] of [[-5, 0, 3.4], [1, -3, 3.8], [6, 1, 3.2]] as const) {
      const sway = Math.sin(time * 5 + ox) * 0.6;
      ctx.fillStyle = tone('#fbf6e9');
      ctx.beginPath();
      ctx.ellipse(x + ox + sway, topY + oy - 2 - bob * (ox > 0 ? 0.6 : 1), r, r * 0.62, ox * 0.12, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + ox + sway - r * 0.5, topY + oy - 2 - bob * (ox > 0 ? 0.6 : 1));
      ctx.quadraticCurveTo(x + ox + sway, topY + oy - 4 - bob, x + ox + sway + r * 0.5, topY + oy - 2 - bob * (ox > 0 ? 0.6 : 1));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  } else if (id === 'shield') {
    // the official cap: band, peak and a brass badge
    const capY = topY - 2;
    ctx.fillStyle = tone('#23305f');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - hw + 2, capY + 2);
    ctx.quadraticCurveTo(x - hw + 3, capY - 11, x, capY - 12);
    ctx.quadraticCurveTo(x + hw - 3, capY - 11, x + hw - 2, capY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#101a3d');
    ctx.fillRect(x - hw + 2.5, capY - 2, hw * 2 - 5, 4.4);
    ctx.fillStyle = tone('#23305f');
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(e.facing) * 4, capY + 4.2, hw - 1, 3.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#ffd23f');
    ctx.beginPath();
    ctx.arc(x, capY - 5.6, 3, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  if (id === 'fragile') {
    // a ribbon and a bow, and the cracks that show where it has already been dropped
    ctx.fillStyle = tone('#e5383b');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.fillRect(x - 2.6, topY - hd + 1, 5.2, hd * 2);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, topY - 1);
      ctx.quadraticCurveTo(x + side * 11, topY - 12 + Math.sin(time * 4) * 0.8, x + side * 9, topY + 1);
      ctx.quadraticCurveTo(x + side * 4, topY + 2, x, topY - 1);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, topY - 1, 2.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const worn = 1 - e.hp / e.type.hp;
    if (worn > 0.05 && !away) {
      ctx.strokeStyle = 'rgba(26, 14, 52, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + hw - 3, faceTop + 3);
      ctx.lineTo(x + hw - 7, faceTop + 9);
      ctx.lineTo(x + hw - 5, faceTop + 13);
      ctx.lineTo(x + hw - 10, faceTop + 18);
      if (worn > 0.4) {
        ctx.moveTo(x + hw - 7, faceTop + 9);
        ctx.lineTo(x + hw - 13, faceTop + 8);
      }
      ctx.stroke();
    }
  }
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
    // the next box down, peeking out of the lid to see what the noise was
    const peek = 4 + Math.sin(time * 3 + e.seed) * 1.2;
    ctx.fillStyle = tone(KRAFT_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(x - 7, topY - 8 - peek, 14, 10 + peek);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(TAPE);
    ctx.fillRect(x - 1.8, topY - 6 - peek, 3.6, 8 + peek);
    if (!away) eyes(ctx, x + Math.cos(e.facing) * 1.5, topY - 1 - peek * 0.4, 3, Math.cos(e.facing), Math.sin(e.facing), 1.9, e.defeated);
  } else if (id === 'kaboom') {
    // soot from the last time it went off, and a thread of smoke
    ctx.fillStyle = 'rgba(26, 14, 52, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x - hw + 5, faceTop + 6, 8, 4.5, -0.4, 0, TAU);
    ctx.ellipse(x - hw + 12, faceTop + 3, 4, 2.4, 0.2, 0, TAU);
    ctx.fill();
    if (!e.defeated) {
      for (let i = 0; i < 3; i++) {
        const age = (time * 0.9 + i / 3) % 1;
        ctx.fillStyle = `rgba(120, 112, 130, ${0.55 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(x - 6 + Math.sin(age * 6 + i) * 3, topY - 4 - age * 22, 2 + age * 3.6, 0, TAU);
        ctx.fill();
      }
    }
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

/** Draws the body only (no telegraphs, no HP strip); returns where those two belong. */
function drawEnemyBody(ctx: Ctx, e: Enemy, x: number, y: number, time: number): { overheadY: number; barHw: number } {
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
  // The silhouette is drawn doubled around the feet to match the boss collider.
  if ((CUSTOM_BOSS_IDS as ReadonlyArray<string>).includes(id)) {
    ctx.translate(x, y);
    ctx.scale(BOSS_DRAW_SCALE, BOSS_DRAW_SCALE);
    ctx.translate(-x, -y);
    drawBossBody(ctx, e, x, y, time, { hw, hd, tone, fx, fy, windup, hop, topY, lift });
    ctx.restore();
    return { overheadY: y + (topY - y) * BOSS_DRAW_SCALE, barHw: hw * BOSS_DRAW_SCALE };
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
    legs(ctx, x, y + hd + 1, e.walkPhase, hw * 0.5, id === 'heavy' ? 6.5 : id === 'fast' || id === 'gnat' ? 4 : 5, tone(SHOES[id] ?? '#f2ece0'));
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
    const droop = id === 'shield' || id === 'fragile' ? -5 : 0;
    const perk = Math.sin(e.walkPhase * 2) * 2 + windup * 7 + flash * 4 + (e.defeated ? 8 : 0) + droop;
    ctx.fillStyle = tone(KRAFT_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    for (const side of id === 'electric' ? [] : [-1, 1]) {
      const ex = x + hw * side;
      // each box bends its flaps a little differently
      const lift = perk + (side < 0 ? 1 : -1) * (hash(e.seed + 3) - 0.5) * 5;
      ctx.beginPath();
      ctx.moveTo(ex, topY - hd + 1);
      ctx.lineTo(ex, topY + hd - 1);
      ctx.lineTo(ex + side * 8, topY + hd - 6 - lift);
      ctx.lineTo(ex + side * 8, topY - hd - 3 - lift);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // the underside in shade, and the corrugated cut edge catching the light
      ctx.fillStyle = 'rgba(60, 36, 12, 0.3)';
      ctx.beginPath();
      ctx.moveTo(ex, topY - hd + 1);
      ctx.lineTo(ex, topY + hd - 1);
      ctx.lineTo(ex + side * 3.2, topY + hd - 3.4 - lift * 0.6);
      ctx.lineTo(ex + side * 3.2, topY - hd - 1.5 - lift * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 244, 210, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex + side * 7, topY + hd - 6.5 - lift);
      ctx.lineTo(ex + side * 7, topY - hd - 2.5 - lift);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.fillStyle = tone(KRAFT_LIGHT);
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
    // wood grain, nail heads and a rope handle knotted through each side
    ctx.strokeStyle = 'rgba(40, 22, 8, 0.32)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [gx, gy, gl] of [[-14, 5, 9], [-4, 14, 7], [6, 8, 10], [13, 18, 6], [-12, 22, 8]] as const) {
      ctx.moveTo(x + gx, faceTop + gy);
      ctx.quadraticCurveTo(x + gx + gl / 2, faceTop + gy - 1.6, x + gx + gl, faceTop + gy);
    }
    ctx.stroke();
    ctx.fillStyle = tone('#d8d2c4');
    for (const nx of [-hw + 5, -hw * 0.34, hw * 0.34, hw - 5]) {
      for (const ny of [faceTop + 4, faceBottom - 4]) {
        ctx.beginPath();
        ctx.arc(x + nx, ny, 1.3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * hw, faceTop + faceH * 0.55);
      ctx.quadraticCurveTo(x + side * (hw + 9), faceTop + faceH * 0.62, x + side * hw, faceTop + faceH * 0.78);
      ctx.stroke();
    }
    ctx.strokeStyle = tone('#d9bf86');
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * hw, faceTop + faceH * 0.55);
      ctx.quadraticCurveTo(x + side * (hw + 9), faceTop + faceH * 0.62, x + side * hw, faceTop + faceH * 0.78);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
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
    ctx.fillRect(x - 4, faceTop + 1, 8, faceH - 6);
    ctx.beginPath();
    ctx.moveTo(x - 4, faceTop + faceH - 5);
    for (let i = 0; i < 4; i++) ctx.lineTo(x - 4 + i * 2.7 + 1.3, faceBottom - (i % 2 === 0 ? 0.5 : 3.6));
    ctx.lineTo(x + 4, faceTop + faceH - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x - 2.6, faceTop + 2, 1.3, faceH - 9);
    boxSurface(ctx, e, x, faceTop, faceBottom, hw);
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
      // brows slam down into a scowl as it winds up
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 10, slotY - 7.4);
      ctx.lineTo(cx - 3, slotY - 4.4 - windup * 1.6);
      ctx.moveTo(cx + 10, slotY - 7.4);
      ctx.lineTo(cx + 3, slotY - 4.4 - windup * 1.6);
      ctx.stroke();
      ctx.lineCap = 'butt';
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
    // no flaps: wires sprout from the lid like frayed hair, spitting sparks
    ctx.lineCap = 'round';
    const WIRES = ['#e5383b', '#235a3c', '#2f4fb5', '#ffd23f'];
    for (let i = 0; i < 4; i++) {
      const wx = x - hw + 5 + i * ((hw * 2 - 10) / 3);
      const sway = Math.sin(time * 4 + i * 1.9 + e.seed) * 3;
      const tipX = wx + (i - 1.5) * 5 + sway;
      const tipY = topY - 17 - (i % 2) * 5;
      ctx.beginPath();
      ctx.moveTo(wx, topY);
      ctx.bezierCurveTo(wx - 7, topY - 9, tipX + 8, topY - 8, tipX, tipY);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = tone(WIRES[i]!);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      if (!e.defeated && hash(Math.floor(time * 14) + i * 5 + e.seed) > 0.55) {
        ctx.strokeStyle = '#fff6a8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = hash(Math.floor(time * 14) + k + i) * TAU;
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX + Math.cos(a) * 5, tipY + Math.sin(a) * 5);
        }
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
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
  return { overheadY: topY, barHw: hw };
}

let scratch: HTMLCanvasElement | null = null;
let rimLayer: HTMLCanvasElement | null = null;

/**
 * Every mover and boss is painted on a scratch canvas first, so one lighting pass can sit
 * on top of whatever silhouette was drawn: warm light from the upper left, cool shade low
 * on the right, a darker foot. Then it is blitted back with a soft floor shadow underneath.
 */
export function drawEnemy(ctx: Ctx, e: Enemy, x: number, y: number, time: number): void {
  const id = e.type.id;
  const boss = (CUSTOM_BOSS_IDS as ReadonlyArray<string>).includes(id);
  const { hw, hd, h } = BUILDS[id];
  const k = boss ? BOSS_DRAW_SCALE : 1;
  const m = ctx.getTransform();
  const s = Math.min(4, Math.hypot(m.a, m.b)) || 1;
  const halfW = boss ? 200 : 64;
  const up = boss ? 300 : 110;
  const down = boss ? 70 : 34;
  const w = halfW * 2;
  const total = up + down;
  const pw = Math.ceil(w * s);
  const ph = Math.ceil(total * s);
  scratch ??= document.createElement('canvas');
  const sc = scratch.getContext('2d');
  if (!sc || pw > 4096 || ph > 4096) {
    const done = drawEnemyBody(ctx, e, x, y, time);
    if (!e.defeated) drawOverhead(ctx, e, x, time, done.overheadY);
    drawHpBar(ctx, e, x, y, done.barHw, hd);
    return;
  }
  if (scratch.width < pw || scratch.height < ph) {
    scratch.width = Math.max(scratch.width, pw);
    scratch.height = Math.max(scratch.height, ph);
  }
  const left = x - halfW;
  const top = y - up;

  // floor shadow first, so it sits under the body and the body's own alpha (defeat fade) shows it
  const fade = e.defeated ? Math.min(1, e.removeIn / 0.35) : 1;
  ctx.fillStyle = `rgba(34, 27, 54, ${0.26 * fade})`;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + hd * k + 1, hw * k * 1.05 + 4, hd * k * 0.8 + 3, 0, 0, TAU);
  ctx.fill();
  if (boss && !e.defeated) {
    // the boss tints the floor it stands on, and glows hot once it has been hurt enough to rage
    const rage = e.rageMult > 1 ? 0.55 + Math.sin(time * 7) * 0.2 : 0;
    ctx.save();
    ctx.translate(x, y + hd * k);
    ctx.scale(1, 0.42);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, hw * k * 1.9);
    glow.addColorStop(0, rage > 0 ? `rgba(255, 96, 52, ${0.5 * rage})` : BUILDS[id].top);
    glow.addColorStop(1, 'rgba(255, 96, 52, 0)');
    ctx.globalAlpha = rage > 0 ? 1 : 0.22;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, hw * k * 1.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = 'source-over';
  sc.clearRect(0, 0, pw, ph);
  sc.setTransform(s, 0, 0, s, -left * s, -top * s);
  const done = drawEnemyBody(sc, e, x, y, time);

  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = 'source-atop';
  const bx0 = (x - hw * k - 10 - left) * s;
  const bx1 = (x + hw * k + 10 - left) * s;
  const by0 = (y - h * k - 14 - top) * s;
  const by1 = (y + hd * k + 6 - top) * s;
  const light = sc.createLinearGradient(bx0, by0, bx1, by1);
  light.addColorStop(0, 'rgba(255, 246, 214, 0.24)');
  light.addColorStop(0.42, 'rgba(255, 246, 214, 0)');
  light.addColorStop(0.62, 'rgba(26, 14, 52, 0)');
  light.addColorStop(1, 'rgba(26, 14, 52, 0.3)');
  sc.fillStyle = light;
  sc.fillRect(0, 0, pw, ph);
  const foot = sc.createLinearGradient(0, by1 - (by1 - by0) * 0.3, 0, by1);
  foot.addColorStop(0, 'rgba(26, 14, 52, 0)');
  foot.addColorStop(1, 'rgba(26, 14, 52, 0.2)');
  sc.fillStyle = foot;
  sc.fillRect(0, 0, pw, ph);
  if (boss) {
    // lacquer: a soft diagonal sheen across the upper body
    const sheen = sc.createLinearGradient(bx0, by0, bx0 + (bx1 - bx0) * 0.6, by0 + (by1 - by0) * 0.5);
    sheen.addColorStop(0.1, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.13)');
    sheen.addColorStop(0.62, 'rgba(255, 255, 255, 0)');
    sc.fillStyle = sheen;
    sc.fillRect(0, 0, pw, ph);
  }
  sc.globalCompositeOperation = 'source-over';

  ctx.drawImage(scratch, 0, 0, pw, ph, left, top, pw / s, ph / s);

  if (boss) {
    // rim light: the edge strip the sprite loses when slid down and right, tinted warm
    rimLayer ??= document.createElement('canvas');
    const rc = rimLayer.getContext('2d');
    if (rc) {
      if (rimLayer.width < pw || rimLayer.height < ph) {
        rimLayer.width = Math.max(rimLayer.width, pw);
        rimLayer.height = Math.max(rimLayer.height, ph);
      }
      rc.globalCompositeOperation = 'source-over';
      rc.clearRect(0, 0, pw, ph);
      rc.drawImage(scratch, 0, 0, pw, ph, 0, 0, pw, ph);
      rc.globalCompositeOperation = 'source-in';
      rc.fillStyle = '#fff1c8';
      rc.fillRect(0, 0, pw, ph);
      rc.globalCompositeOperation = 'destination-out';
      const nudge = Math.max(2, 1.8 * s);
      rc.drawImage(scratch, 0, 0, pw, ph, nudge, nudge, pw, ph);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(rimLayer, 0, 0, pw, ph, left, top, pw / s, ph / s);
      ctx.globalAlpha = 1;
    }
  }

  if (e.defeated) return;
  drawOverhead(ctx, e, x, time, done.overheadY);
  drawHpBar(ctx, e, x, y, done.barHw, hd);
}
