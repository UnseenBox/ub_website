import { INK } from '../core/constants';
import type { HeroId } from '../core/Hero';
import { TAU, clamp } from '../core/math';
import type { Player } from '../entities/Player';
import { mix, roundRectPath, type Ctx } from './draw';

/**
 * THE TENANT — dragged out of bed at 3 a.m. by a break-in. (The flatmate shares the drawing
 * with her own palette and hair: see LOOKS.)
 * Dressing gown, sleep mask shoved up into bed hair, bunny slippers. No weapon, no plan.
 *
 * Drawn in passes like an inked illustration: slippers → (arms) → gown → trim, belt, lapels →
 * hair → head → face → sleep mask → arms. Every part reacts to state: the gown leans into a
 * run, the belt tails and cowlick trail behind, the eyes are half-shut until there is
 * something in your hands, and the mask drops back over them if you go down.
 */

interface Look {
  gown: string;
  gownShade: string;
  gownLight: string;
  fluff: string;
  fluffShade: string;
  pyjama: string;
  skin: string;
  skinShade: string;
  hair: string;
  hairLight: string;
  mask: string;
  maskShade: string;
  slipper: string;
  slipperShade: string;
  /** Long hair pinned up in a bun with a pencil, instead of the tenant's bed-hair spikes. */
  bun: boolean;
  lashes?: boolean;
  glasses?: boolean;
  /** Smaller than a grown-up. */
  scale?: number;
  /** Dinosaur onesie: a spiked hood crest and a tail. */
  dino?: boolean;
}

const LOOKS: Record<HeroId, Look> = {
  tenant: {
    gown: '#7c5cd8', gownShade: '#5a3fb0', gownLight: '#a48cf2', fluff: '#fff3d6', fluffShade: '#e2cfa4',
    pyjama: '#bfe9ff', skin: '#f6c49a', skinShade: '#e0a070', hair: '#9a5226', hairLight: '#d18845',
    mask: '#6fe0c2', maskShade: '#3aa98d', slipper: '#ff9ec4', slipperShade: '#e56f9f', bun: false,
  },
  /**
   * THE FLATMATE — was up anyway. Teal gown, a bun held together by a pencil, and a cat
   * that has never once helped with anything.
   */
  flatmate: {
    gown: '#2fb3a6', gownShade: '#1e867c', gownLight: '#7fe0d4', fluff: '#fff3d6', fluffShade: '#e2cfa4',
    pyjama: '#ffc2d6', skin: '#c98b62', skinShade: '#a56a44', hair: '#3b2a4f', hairLight: '#7a5aa6',
    mask: '#ff7aa8', maskShade: '#d94f82', slipper: '#ffd23f', slipperShade: '#e0a91f', bun: true, lashes: true,
  },
  /** GRAN — has lived here since before the building had a lift. Quilted gown, glasses, grey bun. */
  gran: {
    gown: '#e58fb0', gownShade: '#b9607f', gownLight: '#ffc2d6', fluff: '#fffdf6', fluffShade: '#d8d2c2',
    pyjama: '#c9b6ff', skin: '#f2c9a8', skinShade: '#d39c74', hair: '#c8c6d6', hairLight: '#f1f0f7',
    mask: '#7c5cd8', maskShade: '#5a3fb0', slipper: '#c9483f', slipperShade: '#8f2f29', bun: true, glasses: true,
  },
  /** THE KID — should have been asleep hours ago. Dinosaur onesie: the spikes are the hood. */
  kid: {
    gown: '#6cc24a', gownShade: '#47962c', gownLight: '#b4ea8a', fluff: '#fff27a', fluffShade: '#e0c94a',
    pyjama: '#fff27a', skin: '#e8ad80', skinShade: '#c98558', hair: '#47962c', hairLight: '#b4ea8a',
    mask: '#ff9f1c', maskShade: '#d97706', slipper: '#ff9f1c', slipperShade: '#d97706', bun: false, scale: 0.84, dino: true,
  },
};

// The palette in use for the hero being drawn; swapped by useLook() at the top of drawPlayer.
let GOWN = LOOKS.tenant.gown;
let GOWN_SHADE = LOOKS.tenant.gownShade;
let GOWN_LIGHT = LOOKS.tenant.gownLight;
let FLUFF = LOOKS.tenant.fluff;
let FLUFF_SHADE = LOOKS.tenant.fluffShade;
let PYJAMA = LOOKS.tenant.pyjama;
let SKIN = LOOKS.tenant.skin;
let SKIN_SHADE = LOOKS.tenant.skinShade;
let HAIR = LOOKS.tenant.hair;
let HAIR_LIGHT = LOOKS.tenant.hairLight;
let MASK = LOOKS.tenant.mask;
let MASK_SHADE = LOOKS.tenant.maskShade;
let SLIPPER = LOOKS.tenant.slipper;
let SLIPPER_SHADE = LOOKS.tenant.slipperShade;
let BUN = false;
let LASHES = false;
let GLASSES = false;
let SCALE = 1;
let DINO = false;

function useLook(hero: HeroId): void {
  const look = LOOKS[hero];
  GOWN = look.gown;
  GOWN_SHADE = look.gownShade;
  GOWN_LIGHT = look.gownLight;
  FLUFF = look.fluff;
  FLUFF_SHADE = look.fluffShade;
  PYJAMA = look.pyjama;
  SKIN = look.skin;
  SKIN_SHADE = look.skinShade;
  HAIR = look.hair;
  HAIR_LIGHT = look.hairLight;
  MASK = look.mask;
  MASK_SHADE = look.maskShade;
  SLIPPER = look.slipper;
  SLIPPER_SHADE = look.slipperShade;
  BUN = look.bun;
  LASHES = look.lashes === true;
  GLASSES = look.glasses === true;
  SCALE = look.scale ?? 1;
  DINO = look.dino === true;
}

const HEAD_R = 11.5;
const SPIKES = [2, 6.5, 3, 8.5, 4, 6, 2] as const;

type Tone = (color: string) => string;

function slipper(ctx: Ctx, x: number, y: number, dirX: number, dirY: number, flop: number, tone: Tone): void {
  const px = -dirY;
  const py = dirX;
  // ears first so the body overlaps their roots
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const rx = x + dirX * 3 + px * 2.3 * side;
    const ry = y + dirY * 2.2 + py * 1.6 * side;
    const tx = rx + dirX * 5.5 + px * (1.6 * side + flop);
    const ty = ry + dirY * 4 + py * (1.1 * side + flop) - 1.5;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.strokeStyle = tone(SLIPPER);
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // sole peeking out underneath
  ctx.fillStyle = tone(SLIPPER_SHADE);
  ctx.beginPath();
  ctx.ellipse(x, y + 3.4, 5.6, 2.2, 0, 0, Math.PI);
  ctx.fill();
  const slipGrad = ctx.createLinearGradient(x - 6, y - 5, x + 6, y + 5);
  slipGrad.addColorStop(0, tone(SLIPPER));
  slipGrad.addColorStop(0.55, tone(SLIPPER));
  slipGrad.addColorStop(1, tone(SLIPPER_SHADE));
  ctx.fillStyle = slipGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(x, y, 6.6, 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // stitching round the toe
  ctx.strokeStyle = tone(FLUFF);
  ctx.lineWidth = 1.1;
  ctx.setLineDash([1.6, 1.8]);
  ctx.beginPath();
  ctx.ellipse(x, y - 0.4, 4.6, 3, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = tone(SLIPPER_SHADE);
  ctx.beginPath();
  ctx.ellipse(x - dirX * 2.2, y - dirY * 1.4 + 1, 3.4, 2.2, 0, 0, TAU);
  ctx.fill();
  // bunny face with pink inner ears
  ctx.fillStyle = tone('#ffb3c8');
  ctx.beginPath();
  ctx.ellipse(x + dirX * 3 + px * 1.5 + flop * 0.4, y + dirY * 2.2 + py * 1.1 - 2.2, 0.8, 1.2, 0, 0, TAU);
  ctx.ellipse(x + dirX * 3 - px * 1.5 + flop * 0.4, y + dirY * 2.2 - py * 1.1 - 2.2, 0.8, 1.2, 0, 0, TAU);
  ctx.fill();
  // bunny face
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + dirX * 3.2 + px * 1.5, y + dirY * 2.2 + py * 1.1 - 0.6, 0.85, 0, TAU);
  ctx.arc(x + dirX * 3.2 - px * 1.5, y + dirY * 2.2 - py * 1.1 - 0.6, 0.85, 0, TAU);
  ctx.fill();
}

function gownPath(ctx: Ctx, x: number, y: number, top: number, lean: number, flare: number): void {
  const hem = 15.5 + flare;
  ctx.beginPath();
  ctx.moveTo(x - hem, y - 5);
  ctx.quadraticCurveTo(x - 9.5, y + 4, x - 4.5, y - 0.5);
  ctx.quadraticCurveTo(x, y + 4.5, x + 4.5, y - 0.5);
  ctx.quadraticCurveTo(x + 9.5, y + 4, x + hem, y - 5);
  ctx.quadraticCurveTo(x + 14.5 + lean * 0.5, y - 17, x + 10.5 + lean, top);
  ctx.quadraticCurveTo(x + lean, top - 5.5, x - 10.5 + lean, top);
  ctx.quadraticCurveTo(x - 14.5 + lean * 0.5, y - 17, x - hem, y - 5);
  ctx.closePath();
}

function arm(ctx: Ctx, sx: number, sy: number, hx: number, hy: number, tone: Tone): void {
  const mx = (sx + hx) / 2;
  const my = (sy + hy) / 2 + 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8.2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, hx, hy);
  ctx.stroke();
  ctx.strokeStyle = tone(GOWN_LIGHT);
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.lineCap = 'butt';
  // fluffy cuff sits just behind the hand
  const cx = hx + (mx - hx) * 0.42;
  const cy = hy + (my - hy) * 0.42;
  ctx.fillStyle = tone(FLUFF);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone(FLUFF_SHADE);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.6, Math.PI * 0.2, Math.PI * 0.7);
  ctx.stroke();
  // hand: shaded low, a thumb wedge, one finger line
  const handGrad = ctx.createLinearGradient(hx - 4, hy - 4, hx + 4, hy + 4);
  handGrad.addColorStop(0, tone(SKIN));
  handGrad.addColorStop(1, tone(SKIN_SHADE));
  ctx.fillStyle = handGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 4.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const ta = Math.atan2(my - hy, mx - hx);
  ctx.fillStyle = tone(SKIN);
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(ta + 2.4) * 3.4, hy + Math.sin(ta + 2.4) * 3.4);
  ctx.lineTo(hx + Math.cos(ta + 2.4) * 6.4, hy + Math.sin(ta + 2.4) * 6.4);
  ctx.lineTo(hx + Math.cos(ta + 1.5) * 5.6, hy + Math.sin(ta + 1.5) * 5.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = tone(SKIN_SHADE);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hx - 2.2, hy + 1.4);
  ctx.quadraticCurveTo(hx, hy + 2.4, hx + 2.2, hy + 1.4);
  ctx.stroke();
}

function sleepMask(ctx: Ctx, x: number, y: number, tilt: number, tone: Tone): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const satin = ctx.createLinearGradient(-9, -4, 9, 4);
  satin.addColorStop(0, tone(MASK));
  satin.addColorStop(0.55, tone(MASK));
  satin.addColorStop(1, tone(MASK_SHADE));
  ctx.fillStyle = satin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  roundRectPath(ctx, -9, -4.2, 18, 8.4, 4.2);
  ctx.fill();
  ctx.stroke();
  // sheen along the top edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6.5, -2.6);
  ctx.lineTo(6.5, -2.6);
  ctx.stroke();
  ctx.fillStyle = tone(MASK_SHADE);
  ctx.beginPath();
  roundRectPath(ctx, -7, 0.6, 14, 2.4, 1.2);
  ctx.fill();
  // the mask's own embroidered sleeping eyes
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-4.2, -1.4, 2.1, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.moveTo(6.2, -0.8);
  ctx.arc(4.2, -1.4, 2.1, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
}

function drawDown(ctx: Ctx, x: number, y: number, time: number): void {
  // Back to bed, involuntarily: a heap of gown, the mask slipped over the eyes, one slipper gone.
  slipper(ctx, x - 30, y + 6, -0.8, 0.6, 0.6, (c) => c);
  ctx.fillStyle = GOWN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 5, 21, 10.5, 0.12, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = GOWN_SHADE;
  ctx.beginPath();
  ctx.ellipse(x + 3, y - 1.5, 14, 4.5, 0.12, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 15);
  ctx.lineTo(x + 1, y + 4.5);
  ctx.stroke();
  ctx.strokeStyle = FLUFF;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  const hx = x + 19;
  const hy = y - 9;
  ctx.fillStyle = HAIR;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx + 2, hy - 2, HEAD_R + 1.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(hx, hy, HEAD_R - 1, 0, TAU);
  ctx.fill();
  ctx.stroke();
  sleepMask(ctx, hx - 0.5, hy - 0.5, 0.35, (c) => c);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(hx - 1, hy + 6.5, 2.2, 1.6, 0, 0, TAU);
  ctx.fill();

  ctx.font = 'italic 800 13px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.5 + i / 3) % 1;
    ctx.globalAlpha = Math.sin(t * Math.PI);
    ctx.fillStyle = FLUFF;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    const zx = hx + 10 + t * 16 + Math.sin(t * 7) * 3;
    const zy = hy - 14 - t * 26;
    ctx.strokeText('z', zx, zy);
    ctx.fillText('z', zx, zy);
  }
  ctx.globalAlpha = 1;
}

/** The flatmate's hair: down over the shoulders at the sides, the rest twisted up into a bun. */
function longHair(ctx: Ctx, hx: number, hy: number, ax: number, ay: number, trail: number, bounce: number, tone: Tone): void {
  const cx = hx - ax * 1.6;
  const cy = hy - 1 - ay * 1.2;
  const r = HEAD_R;
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r - 3, cy);
  ctx.quadraticCurveTo(cx - r - 3.5, cy - r - 4.5, cx, cy - r - 3.5);
  ctx.quadraticCurveTo(cx + r + 3.5, cy - r - 4.5, cx + r + 3, cy);
  ctx.quadraticCurveTo(cx + r + 5 + trail, cy + 9, cx + r - 2 + trail * 1.6, cy + 15);
  ctx.quadraticCurveTo(cx + r - 5, cy + 12, cx + 5, cy + 8);
  ctx.lineTo(cx - 5, cy + 8);
  ctx.quadraticCurveTo(cx - r + 5, cy + 12, cx - r + 2 + trail * 1.6, cy + 15);
  ctx.quadraticCurveTo(cx - r - 5 + trail, cy + 9, cx - r - 3, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // the bun, wobbling a beat behind the head, and the pencil holding it together
  const bx = hx - ax * 2.5 + trail * 1.5;
  const by = hy - r - 6.5 + bounce;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(bx - 10, by + 3.5);
  ctx.lineTo(bx + 10.5, by - 4.5);
  ctx.stroke();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = '#ff7aa8';
  ctx.beginPath();
  ctx.moveTo(bx - 10, by + 3.5);
  ctx.lineTo(bx - 8, by + 2.7);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx, by, 6.8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // tie band and sheen on the bun
  ctx.strokeStyle = tone(MASK);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(bx, by + 1.5, 5.6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.strokeStyle = tone(HAIR_LIGHT);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(bx - 0.5, by + 0.5, 3.6, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  ctx.strokeStyle = tone(HAIR);
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(bx + 1, by - 1, 4.8, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHero(ctx: Ctx, p: Player, x: number, y: number, time: number): void {
  if (!p.alive) {
    drawDown(ctx, x, y, time);
    return;
  }

  const b = p.body;
  const ax = p.aimX;
  const ay = p.aimY;
  const px = -ay;
  const py = ax;
  const speed = Math.hypot(b.vx, b.vy);
  const moving = Math.min(1, speed / 200);
  const flash = p.hurtFlash;
  const raging = p.rage > 0;
  const seeingRed = raging ? 0.24 + 0.1 * Math.sin(time * 14) : 0;
  const tone: Tone = (c) => (flash > 0.05 ? mix(c, '#ff5a4e', flash * 0.65) : raging ? mix(c, '#ff2a1f', seeingRed) : c);
  const hurt = flash > 0.35;
  const alert = p.held !== null || p.charging || raging;

  if (p.invulnerable > 0 && p.dashTime <= 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;

  const bob = Math.sin(p.walkPhase * 2) * 1.4 * moving;
  const lean = clamp(b.vx * 0.016, -4, 4);
  const top = y - 25 + bob;
  const flare = moving * 1.5 + p.throwAnim * 2;

  // dash: a gown-shaped afterimage where you just were
  if (p.dashTime > 0) {
    ctx.fillStyle = 'rgba(164, 140, 242, 0.4)';
    gownPath(ctx, x - b.vx * 0.035, y - b.vy * 0.035, top, lean, flare);
    ctx.fill();
  }

  // ── slippers ──
  const stepX = speed > 20 ? b.vx / speed : ax;
  const stepY = speed > 20 ? b.vy / speed : ay;
  const stride = Math.sin(p.walkPhase) * 4.5 * moving;
  const flop = Math.sin(p.walkPhase * 2 + 1) * 0.9 * moving;
  slipper(ctx, x - 8 + stepX * stride, y + 4.5 + stepY * stride * 0.7, stepX, stepY, flop, tone);
  slipper(ctx, x + 8 - stepX * stride, y + 4.5 - stepY * stride * 0.7, stepX, stepY, -flop, tone);

  // ── arms: where the hands are ──
  let reach = 4;
  let spread = 14.5;
  if (p.held) {
    reach = 18 - p.charge * 10;
    spread = Math.min(13, 6 + p.held.body.boundR * 0.35);
  }
  reach += p.throwAnim * 22;
  if (p.throwAnim > 0) spread = Math.min(spread, 9);
  const swing = p.held ? 0 : Math.sin(p.walkPhase) * 3.5 * moving;
  const handY = y - 13 + bob * 0.5;
  let h1x = x + lean * 0.5 + ax * (reach + swing) + px * spread;
  let h1y = handY + ay * (reach + swing) * 0.85 + py * spread * 0.8;
  let h2x = x + lean * 0.5 + ax * (reach - swing) - px * spread;
  let h2y = handY + ay * (reach - swing) * 0.85 - py * spread * 0.8;
  // the hand further left on screen belongs to the left shoulder, so the arms never cross
  if (h1x > h2x) {
    [h1x, h2x] = [h2x, h1x];
    [h1y, h2y] = [h2y, h1y];
  }
  const shoulderY = top + 5;
  const drawArms = (): void => {
    arm(ctx, x + lean - 9.5, shoulderY, h1x, h1y, tone);
    arm(ctx, x + lean + 9.5, shoulderY, h2x, h2y, tone);
  };
  const armsBehind = ay < -0.3;
  if (armsBehind) drawArms();

  // ── gown: lit volume with soft folds, clipped to the silhouette ──
  ctx.lineJoin = 'round';
  ctx.save();
  gownPath(ctx, x, y, top, lean, flare);
  ctx.clip();
  const gownGrad = ctx.createLinearGradient(x - 14, top - 6, x + 14, y + 4);
  gownGrad.addColorStop(0, tone(GOWN_LIGHT));
  gownGrad.addColorStop(0.42, tone(GOWN));
  gownGrad.addColorStop(1, tone(mix(GOWN, GOWN_SHADE, 0.6)));
  ctx.fillStyle = gownGrad;
  ctx.fillRect(x - 20 - flare, top - 8, 40 + flare * 2, y - top + 14);
  // fold shadows falling from the belt
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const fx of [-8.5, -2.5, 4, 9.5]) {
    ctx.moveTo(x + fx + lean * 0.4, top + 2);
    ctx.quadraticCurveTo(x + fx + lean * 0.5, y - 8, x + fx * 1.15 + lean * 0.4, y - 3);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // warm light pooling on the chest, cool shade settling at the hem
  ctx.fillStyle = tone(GOWN_LIGHT);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(x - 4 + lean * 0.5, top + 7 + bob * 0.5, 8, 5, -0.2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tone(GOWN_SHADE);
  ctx.globalAlpha = 0.32;
  ctx.fillRect(x - 20 - flare, y - 4, 40 + flare * 2, 4);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.lineCap = 'butt';
  // fluffy hem trim
  ctx.strokeStyle = tone(FLUFF);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 13.5 - flare, y - 5.5);
  ctx.quadraticCurveTo(x - 9, y + 1, x - 4.5, y - 2.6);
  ctx.quadraticCurveTo(x, y + 1.6, x + 4.5, y - 2.6);
  ctx.quadraticCurveTo(x + 9, y + 1, x + 13.5 + flare, y - 5.5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // moon-and-dot pattern
  ctx.fillStyle = tone(GOWN_LIGHT);
  ctx.beginPath();
  ctx.arc(x - 8 + lean * 0.3, y - 8.5, 1.5, 0, TAU);
  ctx.arc(x + 1.5 + lean * 0.6, y - 19.5 + bob, 1.3, 0, TAU);
  ctx.arc(x - 3.5 + lean * 0.2, y - 5, 1.2, 0, TAU);
  ctx.arc(x - 9.5 + lean * 0.7, y - 18 + bob, 1.2, 0, TAU);
  ctx.fill();
  // ink the silhouette last so the shading never eats into the outline
  gownPath(ctx, x, y, top, lean, flare);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  // light on the leading shoulder
  ctx.strokeStyle = tone(GOWN_LIGHT);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 9 + lean, top + 5);
  ctx.quadraticCurveTo(x - 11.5 + lean, y - 12, x - 8 + lean, y - 20);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (!BUN && !GLASSES && SCALE === 1) {
    // yesterday's coffee, worn with pride
    ctx.strokeStyle = 'rgba(120, 70, 30, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + 6 + lean * 0.5, y - 18 + bob, 3.2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120, 70, 30, 0.5)';
    ctx.beginPath();
    ctx.arc(x + 10.5 + lean * 0.5, y - 12 + bob, 1, 0, TAU);
    ctx.fill();
  }

  const facingAway = ay < -0.55;
  const seamX = x + lean * 0.6 + ax * 7;
  const beltY = y - 13 + bob * 0.5;

  if (!facingAway) {
    // pyjama top peeking out between fluffy lapels
    ctx.fillStyle = tone(FLUFF);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seamX - 7.5 + lean * 0.4, top + 0.5);
    ctx.lineTo(seamX + 7.5 + lean * 0.4, top + 0.5);
    ctx.lineTo(seamX, top + 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(PYJAMA);
    ctx.beginPath();
    ctx.moveTo(seamX - 3.6 + lean * 0.4, top + 1);
    ctx.lineTo(seamX + 3.6 + lean * 0.4, top + 1);
    ctx.lineTo(seamX, top + 6.5);
    ctx.closePath();
    ctx.fill();
    if (GLASSES) {
      // gran's shawl pin: brass ring, red gem
      ctx.fillStyle = tone('#ffd23f');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(seamX, top + 9.5, 2.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = tone('#e5383b');
      ctx.beginPath();
      ctx.arc(seamX, top + 9.5, 1.1, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(seamX, top + 11);
    ctx.lineTo(seamX + ax * 2.5, y - 2);
    ctx.stroke();
  }

  // belt, with a knot and two tails that lag behind your movement
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.4;
  ctx.beginPath();
  ctx.moveTo(x - 13.4 + lean * 0.45, beltY - 0.5);
  ctx.quadraticCurveTo(x + lean * 0.45, beltY + 2.2, x + 13.4 + lean * 0.45, beltY - 0.5);
  ctx.stroke();
  ctx.strokeStyle = tone(FLUFF);
  ctx.lineWidth = 3.4;
  ctx.stroke();
  if (!facingAway) {
    const sway = clamp(-b.vx * 0.022, -5.5, 5.5) + Math.sin(time * 5) * 0.7;
    const drop = clamp(-b.vy * 0.012, -3, 3);
    for (const [dx, len] of [[-2.2, 9.5], [2.6, 11.5]] as const) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(seamX, beltY + 1.5);
      ctx.quadraticCurveTo(seamX + dx * 0.6, beltY + len * 0.5, seamX + dx + sway * (len / 10), beltY + len + drop);
      ctx.stroke();
      ctx.strokeStyle = tone(FLUFF);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = tone(FLUFF_SHADE);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(seamX, beltY + 1.2, 3.3, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // brass buckle ring round the knot
    ctx.strokeStyle = tone('#ffd23f');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(seamX, beltY + 1.2, 4.6, 0, TAU);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  if (!armsBehind && ay < 0.35) drawArms();

  if (DINO) {
    // tail sweeping sideways out of the hem with a plate on top, swaying with the walk
    const wag = Math.sin(p.walkPhase + 1) * 3 * (0.3 + moving);
    const sx = x + px * 11;
    const sy = y - 1;
    const tipX = sx + px * 15 + wag;
    const tipY = sy + 5;
    ctx.fillStyle = tone(GOWN);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 5);
    ctx.quadraticCurveTo(sx + px * 8 + wag, sy - 1, tipX, tipY);
    ctx.quadraticCurveTo(sx + px * 6, sy + 7, sx - 2, sy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(GOWN_LIGHT);
    ctx.beginPath();
    ctx.moveTo(sx + px * 5 + wag * 0.6, sy - 4);
    ctx.lineTo(sx + px * 8 + wag * 0.6, sy - 11);
    ctx.lineTo(sx + px * 11 + wag * 0.6, sy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── head ──
  const hx = x + lean * 1.35 + ax * 2.2;
  const hy = y - 36.5 + bob * 1.3 + ay * 1.2;
  const trail = clamp(-b.vx * 0.012, -3, 3);

  if (DINO) {
    // hood crest behind everything on the head: tall bright spikes, clear of the bed hair
    ctx.fillStyle = tone(GOWN_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    for (let k = -2; k <= 2; k++) {
      const a = -Math.PI / 2 + k * 0.36 - ax * 0.3;
      const base = HEAD_R + 2;
      const len = HEAD_R + 20 + (k % 2 === 0 ? 2 : 0) + moving * 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a - 0.11) * base, hy + Math.sin(a - 0.11) * base);
      ctx.lineTo(hx + Math.cos(a) * len, hy + Math.sin(a) * len);
      ctx.lineTo(hx + Math.cos(a + 0.11) * base, hy + Math.sin(a + 0.11) * base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  if (BUN) {
    longHair(ctx, hx, hy, ax, ay, trail, Math.sin(time * 7 + p.walkPhase) * 1.2 * (0.4 + moving), tone);
  } else {
    // bed hair: a ragged crown of spikes behind the head
    ctx.fillStyle = tone(HAIR);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const hcx = hx - ax * 1.6;
    const hcy = hy - 1 - ay * 1.2;
    ctx.moveTo(hcx - HEAD_R - 1.5, hcy + 4);
    for (let i = 0; i < SPIKES.length; i++) {
      const a = Math.PI + (i * Math.PI) / (SPIKES.length - 1);
      const wobble = Math.sin(time * 3 + i * 1.7) * 0.5 * (1 + moving);
      const r = HEAD_R + 1 + SPIKES[i]! + wobble;
      const valley = a + Math.PI / (SPIKES.length - 1) / 2;
      ctx.lineTo(hcx + Math.cos(a) * r + trail * (r / 16), hcy + Math.sin(a) * r);
      if (i < SPIKES.length - 1) ctx.lineTo(hcx + Math.cos(valley) * (HEAD_R + 1), hcy + Math.sin(valley) * (HEAD_R + 1));
    }
    ctx.lineTo(hcx + HEAD_R + 1.5, hcy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // the one cowlick that never lies down
    const spring = Math.sin(time * 7 + p.walkPhase) * 1.6 * (0.4 + moving) + trail * 1.4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(hx - 1.5, hy - HEAD_R - 4);
    ctx.quadraticCurveTo(hx + 3 + spring, hy - HEAD_R - 14, hx + 8 + spring * 1.6, hy - HEAD_R - 8.5);
    ctx.stroke();
    ctx.strokeStyle = tone(HAIR_LIGHT);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.lineCap = 'butt';
    // root shadow where the hair meets the forehead, plus loose strands
    ctx.strokeStyle = tone(HAIR);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hcx, hcy, HEAD_R - 0.5, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tone(HAIR_LIGHT);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 1.25 + i * 0.28 + Math.sin(time * 3 + i * 2 + p.walkPhase * 0.5) * 0.05;
      ctx.moveTo(hcx + Math.cos(a) * (HEAD_R - 3), hcy + Math.sin(a) * (HEAD_R - 3));
      ctx.lineTo(hcx + Math.cos(a) * (HEAD_R + 5 + SPIKES[i * 2]!), hcy + Math.sin(a) * (HEAD_R + 5 + SPIKES[i * 2]!));
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  ctx.fillStyle = tone(facingAway ? HAIR : SKIN);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(hx, hy, HEAD_R, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // light catching the hair
  ctx.strokeStyle = tone(HAIR_LIGHT);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx - 1, hy - 1, HEAD_R - 3.4, Math.PI * 1.02, Math.PI * 1.5);
  ctx.stroke();
  ctx.lineCap = 'butt';

  if (facingAway) {
    // back of the head: the mask strap and a few strands
    ctx.strokeStyle = tone(MASK_SHADE);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy + 14, 19.5, Math.PI * 1.3, Math.PI * 1.7);
    ctx.stroke();
    ctx.strokeStyle = tone(HAIR_LIGHT);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy + 1);
    ctx.lineTo(hx - 5, hy + 7);
    ctx.moveTo(hx + 2, hy + 2);
    ctx.lineTo(hx + 2.5, hy + 8);
    ctx.moveTo(hx + 7, hy);
    ctx.lineTo(hx + 8, hy + 5);
    ctx.stroke();
    ctx.lineCap = 'butt';
  } else {
    // chin shadow
    ctx.strokeStyle = tone(SKIN_SHADE);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_R - 2.6, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    // nose: a small wedge with its own shade side
    const nx = hx + ax * 1.5;
    const ny = hy + 3.4 + ay;
    ctx.fillStyle = tone(SKIN);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(nx - 2.2, ny - 1.6);
    ctx.lineTo(nx + 2.4, ny - 0.6);
    ctx.lineTo(nx - 0.4, ny + 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = tone(SKIN_SHADE);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(nx + 2.4, ny - 0.6);
    ctx.lineTo(nx - 0.4, ny + 2.2);
    ctx.stroke();
    ctx.lineJoin = 'round';

    // jagged fringe
    const fx = ax * 2;
    ctx.fillStyle = tone(HAIR);
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_R - 1.4, Math.PI * 1.06, Math.PI * 1.94);
    ctx.lineTo(hx + 7 + fx, hy - 7);
    ctx.lineTo(hx + 4 + fx, hy - 3.2);
    ctx.lineTo(hx + 0.5 + fx, hy - 7.6);
    ctx.lineTo(hx - 3 + fx, hy - 3.6);
    ctx.lineTo(hx - 7 + fx, hy - 7.4);
    ctx.closePath();
    ctx.fill();

    // ── face ──
    const ex = hx + ax * 3;
    const ey = hy + 2 + ay * 2.2;
    const gap = 4.7;
    const blink = time % 3.4 < 0.11;
    for (const side of [-1, 1]) {
      const cx = ex + gap * side;
      ctx.lineCap = 'round';
      if (hurt) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 2.4 * side, ey - 2.4);
        ctx.lineTo(cx + 1.6 * side, ey);
        ctx.lineTo(cx - 2.4 * side, ey + 2.4);
        ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - 2.6, ey);
        ctx.lineTo(cx + 2.6, ey);
        ctx.stroke();
      } else {
        // white, shaded low; a heavy upper lid; iris, pupil, catchlight
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(cx, ey, 3.3, 4, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(160, 190, 220, 0.55)';
        ctx.beginPath();
        ctx.ellipse(cx, ey + 2.2, 2.6, 1.6, 0, 0, Math.PI);
        ctx.fill();
        const iris = raging ? '#c0272b' : '#5a3b26';
        ctx.fillStyle = iris;
        ctx.beginPath();
        ctx.arc(cx + ax * 1.3 + (raging ? Math.sin(time * 47 + side) * 0.9 : 0), ey + ay * 1.2 + (alert ? -0.4 : 0.6), raging ? 1.5 : 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(cx + ax * 1.3 + (raging ? Math.sin(time * 47 + side) * 0.9 : 0), ey + ay * 1.2 + (alert ? -0.4 : 0.6), raging ? 0.95 : 1.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + ax * 1.3 - 0.6, ey + ay * 1.2 - 1, 0.55, 0, TAU);
        ctx.fill();
        if (!alert) {
          // still half asleep: a heavy shaded lid with its own lash line
          const lidGrad = ctx.createLinearGradient(0, ey - 4.6, 0, ey + 0.6);
          lidGrad.addColorStop(0, tone(SKIN_SHADE));
          lidGrad.addColorStop(1, tone(SKIN));
          ctx.fillStyle = lidGrad;
          ctx.beginPath();
          ctx.ellipse(cx, ey - 1.7, 3.5, 3, 0, Math.PI, TAU);
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(cx - 3.5, ey - 1.2);
          ctx.quadraticCurveTo(cx, ey + 0.2, cx + 3.5, ey - 1.2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          ctx.ellipse(cx, ey - 0.4, 3.4, 3.9, 0, Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
      // brows: soft when calm, slashed down when there is something to throw
      ctx.strokeStyle = INK;
      ctx.lineWidth = alert ? 2.1 : 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (alert) {
        ctx.moveTo(cx - 3.6 * side, ey - 4.2);
        ctx.lineTo(cx + 2.6 * side, ey - 6.6);
      } else {
        ctx.moveTo(cx - 3 * side, ey - 5);
        ctx.quadraticCurveTo(cx, ey - 6.2, cx + 3 * side, ey - 5);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (LASHES && !hurt && !blink) {
        // eyelashes
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx + 2.4 * side, ey - 2.6);
        ctx.lineTo(cx + 4.6 * side, ey - 4.4);
        ctx.moveTo(cx + 3 * side, ey - 1);
        ctx.lineTo(cx + 5.4 * side, ey - 1.9);
        ctx.stroke();
      }
    }

    if (GLASSES) {
      // round wire frames, a little too big
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex - gap, ey, 4.4, 0, TAU);
      ctx.moveTo(ex + gap + 4.4, ey);
      ctx.arc(ex + gap, ey, 4.4, 0, TAU);
      ctx.moveTo(ex - gap + 4.4, ey - 0.6);
      ctx.lineTo(ex + gap - 4.4, ey - 0.6);
      ctx.stroke();
    }

    if (LASHES) {
      // gold hoop on the facing ear
      const eside = ax >= 0 ? 1 : -1;
      ctx.strokeStyle = tone('#ffd23f');
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(hx + eside * (HEAD_R - 1), hy + 3.5, 2.2, 0, TAU);
      ctx.stroke();
    }

    const mx = hx + ax * 3;
    const my = hy + 7.4 + ay;
    const yawn = !alert && moving < 0.1 ? Math.max(0, Math.sin(((time % 7) / 1.2) * Math.PI)) * (time % 7 < 1.2 ? 1 : 0) : 0;
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (p.throwAnim > 0.2) {
      ctx.beginPath();
      ctx.ellipse(mx, my, 2.5, 3.1, 0, 0, TAU);
      ctx.fill();
    } else if (p.charging || raging) {
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      roundRectPath(ctx, mx - 3.3, my - 1.6, 6.6, 3.4, 1.2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my - 1.6);
      ctx.lineTo(mx, my + 1.8);
      ctx.stroke();
    } else if (yawn > 0.05) {
      ctx.beginPath();
      ctx.ellipse(mx, my, 1.3 + yawn * 0.9, 0.6 + yawn * 2.4, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx - 1.7, my + (hurt ? 0.8 : 0));
      ctx.quadraticCurveTo(mx, my + (hurt ? -1.4 : alert ? 0 : 0.9), mx + 1.7, my + (hurt ? 0.8 : 0));
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // sleep mask pushed up into the hair
    ctx.strokeStyle = tone(MASK_SHADE);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hx - HEAD_R + 0.8, hy - 6.5);
    ctx.lineTo(hx + HEAD_R - 0.8, hy - 6.5);
    ctx.stroke();
    sleepMask(ctx, hx + ax * 3.2, hy - 9.6, 0.1 + ax * 0.08 + trail * 0.03, tone);
  }

  if (!armsBehind && ay >= 0.35) drawArms();
  ctx.globalAlpha = 1;
}

export function drawPlayer(ctx: Ctx, p: Player, x: number, y: number, time: number, hero: HeroId = 'tenant'): void {
  useLook(hero);
  // Squash-and-stretch about the slippers, the same pop enemies and objects get.
  const sx = SCALE * (1 + p.squash * 0.18);
  const sy = SCALE * (1 - p.squash * 0.16);
  if (sx === 1 && sy === 1) {
    drawHero(ctx, p, x, y, time);
    return;
  }
  ctx.save();
  ctx.translate(x, y + 5);
  ctx.scale(sx, sy);
  ctx.translate(-x, -(y + 5));
  drawHero(ctx, p, x, y, time);
  ctx.restore();
}
