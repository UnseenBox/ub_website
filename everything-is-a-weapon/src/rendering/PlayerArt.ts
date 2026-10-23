import { INK } from '../core/constants';
import type { HeroId } from '../core/Hero';
import { TAU, clamp } from '../core/math';
import type { Player } from '../entities/Player';
import { mix, roundRectPath, type Ctx } from './draw';
import {
  HERO_LOOKS,
  type FeetKind,
  type HairKind,
  type MaskKind,
  type OutfitKind,
} from './heroLooks';

/**
 * THE NIGHT SHIFT — four people, four silhouettes, one visual system.
 *
 * The portrait and menu art define the character; this file draws the same person at
 * gameplay scale. The tenant's open robe over full pajamas, the flatmate's pyjama
 * shirt, gran's quilted bed jacket, and the kid's dinosaur onesie are separate body
 * passes, not palette swaps. Pose, aim, held-item, hurt, rage, dash, and down state
 * all still react exactly as before.
 *
 * Drawn in passes: slippers → (arms) → outfit → hair → head → face → mask → arms.
 */

const START = HERO_LOOKS.tenant;

// The palette and silhouette in use for the hero being drawn; swapped by useLook().
let GOWN = START.outfitMain;
let GOWN_SHADE = START.outfitShade;
let GOWN_LIGHT = START.outfitLight;
let FLUFF = START.trim;
let FLUFF_SHADE = START.trimShade;
let TOP = START.top;
let TOP_SHADE = START.topShade;
let PANTS = START.pants;
let PANTS_SHADE = START.pantsShade;
let PIPING = START.piping;
let SKIN = START.skin;
let SKIN_SHADE = START.skinShade;
let HAIR = START.hair;
let HAIR_LIGHT = START.hairLight;
let SPINE = START.spike ?? START.outfitLight;
let MASK = START.mask;
let MASK_SHADE = START.maskShade;
let SLIPPER = START.slipper;
let SLIPPER_SHADE = START.slipperShade;
let ACCENT = START.accent;
let OUTFIT: OutfitKind = START.outfit;
let HAIR_STYLE: HairKind = START.hairStyle;
let FEET: FeetKind = START.feet;
let MASK_STYLE: MaskKind = START.maskStyle;
let CUFF_STYLE: 'fluffy' | 'plain' = 'fluffy';
let LASHES = false;
let GLASSES = false;
let SCALE = 1;
let DINO = false;

function useLook(hero: HeroId): void {
  const look = HERO_LOOKS[hero];
  GOWN = look.outfitMain;
  GOWN_SHADE = look.outfitShade;
  GOWN_LIGHT = look.outfitLight;
  FLUFF = look.trim;
  FLUFF_SHADE = look.trimShade;
  TOP = look.top;
  TOP_SHADE = look.topShade;
  PANTS = look.pants;
  PANTS_SHADE = look.pantsShade;
  PIPING = look.piping;
  SKIN = look.skin;
  SKIN_SHADE = look.skinShade;
  HAIR = look.hair;
  HAIR_LIGHT = look.hairLight;
  SPINE = look.spike ?? look.outfitLight;
  MASK = look.mask;
  MASK_SHADE = look.maskShade;
  SLIPPER = look.slipper;
  SLIPPER_SHADE = look.slipperShade;
  ACCENT = look.accent;
  OUTFIT = look.outfit;
  HAIR_STYLE = look.hairStyle;
  FEET = look.feet;
  MASK_STYLE = look.maskStyle;
  CUFF_STYLE = look.outfit === 'bedJacket' ? 'fluffy' : 'plain';
  LASHES = look.lashes === true;
  GLASSES = look.glasses === true;
  SCALE = look.scale;
  DINO = look.outfit === 'dinoOnesie';
}

const HEAD_R = 11.5;

type Tone = (color: string) => string;

function slipper(ctx: Ctx, x: number, y: number, dirX: number, dirY: number, flop: number, tone: Tone): void {
  const px = -dirY;
  const py = dirX;
  ctx.lineCap = 'round';

  if (FEET === 'bunny') {
    // ears first so the body overlaps their roots
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
  } else if (FEET === 'feather') {
    // a little spray of white feathers out of the heel
    for (let i = -1; i <= 1; i++) {
      const baseX = x - dirX * 2.5 + px * i * 1.8;
      const baseY = y - dirY * 1.2 + py * i * 1.4;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(baseX - dirX * 4 + px * i * 2, baseY - 5, baseX - dirX * 7 + px * (i * 2.4 + flop), baseY - 7);
      ctx.stroke();
      ctx.strokeStyle = tone(FLUFF);
      ctx.lineWidth = 2.1;
      ctx.stroke();
    }
  }

  // sole peeking out underneath
  ctx.fillStyle = tone(FEET === 'sneaker' ? FLUFF : SLIPPER_SHADE);
  ctx.beginPath();
  ctx.ellipse(x, y + 3.4, FEET === 'claw' ? 5.9 : 5.6, 2.2, 0, 0, Math.PI);
  ctx.fill();

  const slipGrad = ctx.createLinearGradient(x - 6, y - 5, x + 6, y + 5);
  slipGrad.addColorStop(0, tone(FEET === 'claw' ? GOWN : SLIPPER));
  slipGrad.addColorStop(0.55, tone(FEET === 'claw' ? GOWN : SLIPPER));
  slipGrad.addColorStop(1, tone(FEET === 'claw' ? GOWN_SHADE : SLIPPER_SHADE));
  ctx.fillStyle = slipGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(x, y, FEET === 'claw' ? 6.8 : 6.6, FEET === 'claw' ? 4.2 : 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  if (FEET === 'bunny') {
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
  } else if (FEET === 'duck') {
    // orange bill and a sleepy eye on a yellow slipper
    const ang = Math.atan2(dirY, dirX);
    ctx.fillStyle = tone('#f28c28');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x + dirX * 4.2, y + dirY * 2.2, 2.8, 1.5, ang, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + dirX * 2.2 + px * 1.8, y + dirY * 1.2 + py * 1.1 - 0.8, 0.75, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = tone(SLIPPER_SHADE);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x - dirX * 1.4, y - dirY * 1, 2.4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (FEET === 'claw') {
    // three little dino claws at the toe
    ctx.fillStyle = tone(FLUFF);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) {
      const cx = x + dirX * 4.2 + px * i * 2.2;
      const cy = y + dirY * 2.2 + py * i * 1.7;
      ctx.beginPath();
      ctx.moveTo(cx - px * 0.8, cy - py * 0.8);
      ctx.lineTo(cx + dirX * 2.4 + px * (i * 0.5), cy + dirY * 1.6 + py * (i * 0.4));
      ctx.lineTo(cx + px * 0.8, cy + py * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = tone(FLUFF_SHADE);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - dirX * 2.5, y - dirY * 1.4);
    ctx.lineTo(x + dirX * 1.5, y + dirY * 0.6);
    ctx.stroke();
  } else if (FEET === 'sneaker') {
    // chunky teal dino sneaker with a cream toe bumper and yellow laces
    const ang = Math.atan2(dirY, dirX);
    ctx.fillStyle = tone(FLUFF);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(x + dirX * 3.4, y + dirY * 2.4, 3.4, 2.0, ang, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tone(SLIPPER_SHADE);
    ctx.beginPath();
    ctx.ellipse(x + dirX * 0.1, y - 1.2, 3.2, 1.9, ang, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = tone(ACCENT);
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const ox = px * i * 1.25;
      const oy = py * i * 1.25;
      ctx.moveTo(x + dirX * 0.1 + ox - dirX * 0.7, y - 1.2 + oy - dirY * 0.7);
      ctx.lineTo(x + dirX * 0.1 + ox + dirX * 1.5, y - 1.2 + oy + dirY * 1.5);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // thin white sole rim
    ctx.strokeStyle = tone(FLUFF);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y + 3.4, 5.3, 1.9, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
  } else {
    // feather-trimmed slipper: a soft cream bow over the rose body
    ctx.fillStyle = tone(FLUFF);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x - dirX * 1.5 + px * 1.4, y - dirY * 0.8 + py * 1.1, 2.2, 1.4, 0.4, 0, TAU);
    ctx.ellipse(x - dirX * 1.5 - px * 1.4, y - dirY * 0.8 - py * 1.1, 2.2, 1.4, -0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
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
  // cuff sits just behind the hand: fluffy for the robe/bed jacket, plain for pajamas/onesie
  const cx = hx + (mx - hx) * 0.42;
  const cy = hy + (my - hy) * 0.42;
  if (CUFF_STYLE === 'fluffy') {
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
  } else {
    ctx.fillStyle = tone(GOWN_SHADE);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(GOWN_LIGHT);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6, 0, TAU);
    ctx.fill();
  }
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
  ctx.strokeStyle = OUTFIT === 'openRobePajamas' || OUTFIT === 'bedJacket' ? FLUFF : GOWN_SHADE;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  const hx = x + 19;
  const hy = y - 9;
  ctx.fillStyle = HAIR_STYLE === 'dinoHood' ? GOWN : HAIR;
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
  if (MASK_STYLE === 'forehead') {
    sleepMask(ctx, hx - 0.5, hy - 0.5, 0.35, (c) => c);
  } else {
    // no sleep mask: eyes shut the ordinary way
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(hx - 4, hy + 1.5, 2.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.moveTo(hx + 6.2, hy + 1.5);
    ctx.arc(hx + 2, hy + 1.5, 2.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
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

/** The tenant's hair: a messy auburn bun, loose strands, and the teal sleep-mask band. */
function bunHair(ctx: Ctx, hx: number, hy: number, ax: number, ay: number, trail: number, bounce: number, tone: Tone): void {
  const cx = hx - ax * 1.6;
  const cy = hy - 1 - ay * 1.2;
  const r = HEAD_R;
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r - 2.5, cy + 5);
  ctx.quadraticCurveTo(cx - r - 3.5, cy - r - 3.5, cx, cy - r - 3);
  ctx.quadraticCurveTo(cx + r + 3.5, cy - r - 3.5, cx + r + 2.5, cy + 5);
  ctx.quadraticCurveTo(cx + r - 1.5, cy + 10, cx + 5.5, cy + 8);
  ctx.lineTo(cx - 5.5, cy + 8);
  ctx.quadraticCurveTo(cx - r + 1.5, cy + 10, cx - r - 2.5, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // the bun sits high and a beat behind the head
  const bx = hx - ax * 1.4 + trail * 1.3;
  const by = hy - r - 5.5 + bounce;
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx, by, 6.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // teal tie, matching the mask
  ctx.strokeStyle = tone(MASK);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(bx, by + 1.3, 5.1, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.strokeStyle = tone(HAIR_LIGHT);
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(bx - 0.5, by - 0.5, 3.3, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();

  // loose side strands
  ctx.strokeStyle = tone(HAIR);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1] as const) {
    ctx.moveTo(cx + side * (r - 2), cy + 3);
    ctx.quadraticCurveTo(cx + side * (r + 1) + trail * 0.3, cy + 8, cx + side * (r + 1.5) + trail * 0.5, cy + 12);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  // root shadow
  ctx.strokeStyle = tone(HAIR);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The flatmate's high ponytail, tied with the yellow scrunchie from the portrait. */
function ponytailHair(ctx: Ctx, hx: number, hy: number, ax: number, ay: number, trail: number, bounce: number, tone: Tone): void {
  const cx = hx - ax * 1.6;
  const cy = hy - 1 - ay * 1.2;
  const r = HEAD_R;
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r - 2.5, cy + 5);
  ctx.quadraticCurveTo(cx - r - 3.5, cy - r - 3.5, cx, cy - r - 3);
  ctx.quadraticCurveTo(cx + r + 3.5, cy - r - 3.5, cx + r + 2.5, cy + 5);
  ctx.quadraticCurveTo(cx + r - 1.5, cy + 9, cx + 5, cy + 8);
  ctx.lineTo(cx - 5, cy + 8);
  ctx.quadraticCurveTo(cx - r + 1.5, cy + 9, cx - r - 2.5, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // thick ponytail falling behind the head, swung by movement
  const baseX = hx - ax * 2.6 + trail * 1.4;
  const baseY = hy - r - 1.5 + bounce;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9.5;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX - ax * 4 + trail * 2, baseY - 8, baseX - ax * 7.5 + trail * 4.5, baseY + 7);
  ctx.stroke();
  ctx.strokeStyle = tone(HAIR);
  ctx.lineWidth = 5.8;
  ctx.stroke();
  ctx.strokeStyle = tone(HAIR_LIGHT);
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.lineCap = 'butt';

  // yellow scrunchie
  ctx.fillStyle = tone(ACCENT);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(baseX, baseY, 3.4, 2.3, -0.25, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // loose strands in front of the ears
  ctx.strokeStyle = tone(HAIR);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1] as const) {
    ctx.moveTo(cx + side * (r - 2), cy + 2);
    ctx.quadraticCurveTo(cx + side * (r + 1) + trail * 0.3, cy + 8, cx + side * (r + 1.5) + trail * 0.5, cy + 13);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Gran's hair: a soft grey cap and the loose white curls from her portrait. */
function curlsHair(ctx: Ctx, hx: number, hy: number, ax: number, ay: number, trail: number, tone: Tone): void {
  const cx = hx - ax * 1.6;
  const cy = hy - 1 - ay * 1.2;
  const r = HEAD_R;
  ctx.fillStyle = tone(HAIR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r - 2.5, cy + 5);
  ctx.quadraticCurveTo(cx - r - 3.5, cy - r - 3.5, cx, cy - r - 3);
  ctx.quadraticCurveTo(cx + r + 3.5, cy - r - 3.5, cx + r + 2.5, cy + 5);
  ctx.quadraticCurveTo(cx + r - 1.5, cy + 9, cx + 5, cy + 8);
  ctx.lineTo(cx - 5, cy + 8);
  ctx.quadraticCurveTo(cx - r + 1.5, cy + 9, cx - r - 2.5, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // overlapping pin-curl puffs make a soft cloud around the crown
  const curls: ReadonlyArray<readonly [number, number, number]> = [
    [-10, -5.5, 4.2],
    [-6.5, -10, 4.8],
    [-1.5, -12.2, 5.2],
    [4, -11.2, 5.1],
    [8.8, -7.6, 4.6],
    [11.2, -2.6, 3.9],
    [-11.2, 0.2, 3.8],
    [-9.6, 4.4, 3.1],
    [10.2, 3.6, 3.0],
  ];
  for (const [dx, dy, size] of curls) {
    const px = cx + dx + trail * 0.35;
    const py = cy + dy;
    ctx.fillStyle = tone(HAIR_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // a loose spiral inside each puff
    ctx.strokeStyle = tone(HAIR);
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.arc(px - 0.3, py + 0.2, size * 0.52, Math.PI * 0.2, Math.PI * 1.9);
    ctx.stroke();
  }

  // a few loose grey wisps at the nape
  ctx.strokeStyle = tone(HAIR_LIGHT);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1] as const) {
    ctx.moveTo(cx + side * (r - 1), cy + 5);
    ctx.quadraticCurveTo(cx + side * (r + 2) + trail * 0.3, cy + 10, cx + side * (r + 2.5) + trail * 0.5, cy + 14);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function outfitBeltY(y: number, top: number): number {
  return y - 13 + (top - (y - 25)) * 0.5;
}

/** Legs and pants for the tenant, flatmate, and gran. The slippers sit just below the hem. */
function drawPants(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  tone: Tone,
  style: 'wide' | 'straight' = 'wide',
): void {
  const beltY = outfitBeltY(y, top);
  const wide = style === 'wide';
  const hip = wide ? 11.4 : 9.4;
  const hem = wide ? 13.6 + flare : 10.2 + flare * 0.4;
  const ankle = y + 1.4;
  const pantsGrad = ctx.createLinearGradient(x - hip, beltY, x + hip, ankle);
  pantsGrad.addColorStop(0, tone(PANTS));
  pantsGrad.addColorStop(0.6, tone(PANTS));
  pantsGrad.addColorStop(1, tone(PANTS_SHADE));
  ctx.fillStyle = pantsGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  // left leg
  ctx.beginPath();
  ctx.moveTo(x - hip + lean * 0.6, beltY);
  ctx.quadraticCurveTo(x - hip - 1.2 + lean * 0.5, y - 8, x - hem + lean * 0.3, ankle);
  ctx.lineTo(x - 2 + lean * 0.2, ankle);
  ctx.quadraticCurveTo(x - 2.6 + lean * 0.4, y - 8, x - 1.8 + lean * 0.5, beltY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // right leg
  ctx.beginPath();
  ctx.moveTo(x + hip + lean * 0.6, beltY);
  ctx.quadraticCurveTo(x + hip + 1.2 + lean * 0.5, y - 8, x + hem + lean * 0.3, ankle);
  ctx.lineTo(x + 2 + lean * 0.2, ankle);
  ctx.quadraticCurveTo(x + 2.6 + lean * 0.4, y - 8, x + 1.8 + lean * 0.5, beltY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // piping down the outside seam
  ctx.strokeStyle = tone(PIPING);
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(x - hip + 1 + lean * 0.6, beltY + 1);
  ctx.quadraticCurveTo(x - hip + 0.4 + lean * 0.5, y - 8, x - hem + 1 + lean * 0.3, ankle - 1);
  ctx.moveTo(x + hip - 1 + lean * 0.6, beltY + 1);
  ctx.quadraticCurveTo(x + hip - 0.4 + lean * 0.5, y - 8, x + hem - 1 + lean * 0.3, ankle - 1);
  ctx.stroke();

  // crotch seam
  ctx.strokeStyle = tone(PANTS_SHADE);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + lean * 0.5, beltY + 1);
  ctx.lineTo(x + lean * 0.3, y - 6);
  ctx.stroke();
}

/** Gran's nightgown: a long, wide skirt that covers the legs to the slippers. */
function drawNightgownSkirt(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  tone: Tone,
): void {
  const beltY = outfitBeltY(y, top);
  const hem = 14.8 + flare;
  const skirtGrad = ctx.createLinearGradient(x - 12, beltY, x + 12, y + 1);
  skirtGrad.addColorStop(0, tone(TOP));
  skirtGrad.addColorStop(0.62, tone(TOP));
  skirtGrad.addColorStop(1, tone(TOP_SHADE));
  ctx.fillStyle = skirtGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10.5 + lean * 0.5, beltY);
  ctx.quadraticCurveTo(x - 12 + lean * 0.3, y - 10, x - hem + lean * 0.2, y + 1);
  ctx.quadraticCurveTo(x, y + 4.5, x + hem + lean * 0.2, y + 1);
  ctx.quadraticCurveTo(x + 12 + lean * 0.3, y - 10, x + 10.5 + lean * 0.5, beltY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // little floral print
  ctx.fillStyle = tone(PIPING);
  for (const [dx, dy, r] of [
    [-7, -8, 1.1],
    [2, -4, 0.9],
    [7, -12, 1],
    [-3, -14, 0.8],
    [9, -3, 1.1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx + lean * 0.3, beltY + dy, r, 0, TAU);
    ctx.fill();
  }

  // cream hem
  ctx.strokeStyle = tone(FLUFF);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - hem + 0.5, y + 0.2);
  ctx.quadraticCurveTo(x, y + 3.2, x + hem - 0.5, y + 0.2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawSash(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  facingAway: boolean,
  tone: Tone,
): void {
  const beltY = outfitBeltY(y, top);
  const seamX = x + lean * 0.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.4;
  ctx.beginPath();
  ctx.moveTo(x - 13.2 + lean * 0.45, beltY - 0.5);
  ctx.quadraticCurveTo(x + lean * 0.45, beltY + 2.2, x + 13.2 + lean * 0.45, beltY - 0.5);
  ctx.stroke();
  ctx.strokeStyle = tone(FLUFF);
  ctx.lineWidth = 3.4;
  ctx.stroke();

  if (!facingAway) {
    const sway = clamp(-0, -5.5, 5.5) + Math.sin(0) * 0.7;
    for (const [dx, len] of [
      [-2.2, 8.5],
      [2.6, 10.5],
    ] as const) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(seamX, beltY + 1.5);
      ctx.quadraticCurveTo(seamX + dx * 0.6, beltY + len * 0.5, seamX + dx + sway * (len / 10), beltY + len);
      ctx.stroke();
      ctx.strokeStyle = tone(FLUFF);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = tone(FLUFF_SHADE);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(seamX, beltY + 1.2, 3.1, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Tenant: high-neck pale blue pajamas under the open violet robe, tied with a cream sash. */
function drawOpenRobePajamas(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  facingAway: boolean,
  tone: Tone,
): void {
  drawPants(ctx, x, y, top, lean, flare, tone, 'wide');
  const beltY = outfitBeltY(y, top);

  // high-neck pyjama top
  const topGrad = ctx.createLinearGradient(x - 9, top, x + 9, beltY);
  topGrad.addColorStop(0, tone(TOP));
  topGrad.addColorStop(0.66, tone(TOP));
  topGrad.addColorStop(1, tone(TOP_SHADE));
  ctx.fillStyle = topGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 9 + lean, top + 1);
  ctx.quadraticCurveTo(x - 10.2 + lean, top + 7, x - 8.6 + lean * 0.8, beltY + 1);
  ctx.lineTo(x + 8.6 + lean * 0.8, beltY + 1);
  ctx.quadraticCurveTo(x + 10.2 + lean, top + 7, x + 9 + lean, top + 1);
  ctx.quadraticCurveTo(x + lean, top - 2.4, x - 9 + lean, top + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // collar, placket, buttons
  ctx.strokeStyle = tone(TOP_SHADE);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 3.4 + lean, top + 0.7);
  ctx.quadraticCurveTo(x + lean, top + 2.2, x + 3.4 + lean, top + 0.7);
  ctx.stroke();
  ctx.strokeStyle = tone(PIPING);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + lean * 0.6, top + 2.4);
  ctx.lineTo(x + lean * 0.4, beltY);
  ctx.stroke();
  ctx.fillStyle = tone(PIPING);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.arc(x + lean * 0.5, top + 7 + i * 4, 0.85, 0, TAU);
    ctx.fill();
  }

  // open violet robe panels; the pyjama top stays visible down the centre
  for (const side of [-1, 1] as const) {
    const panelGrad = ctx.createLinearGradient(x + side * 4, top, x + side * 15, y - 2);
    panelGrad.addColorStop(0, tone(GOWN_LIGHT));
    panelGrad.addColorStop(0.55, tone(GOWN));
    panelGrad.addColorStop(1, tone(GOWN_SHADE));
    ctx.fillStyle = panelGrad;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(x + side * 9.2 + lean, top + 1);
    ctx.quadraticCurveTo(x + side * 12 + lean, top + 8, x + side * 14.6 + lean * 0.5, y - 3);
    ctx.quadraticCurveTo(x + side * 10 + lean * 0.3, y + 2, x + side * 5.6 + lean * 0.4, beltY + 2);
    ctx.quadraticCurveTo(x + side * 3.2 + lean * 0.7, top + 13, x + side * 9.2 + lean, top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // lit lapel edge
    ctx.strokeStyle = tone(GOWN_LIGHT);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + side * 8.6 + lean, top + 3);
    ctx.quadraticCurveTo(x + side * 5.4 + lean * 0.8, top + 9, x + side * 5.4 + lean * 0.5, beltY + 1);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  drawSash(ctx, x, y, top, lean, facingAway, tone);
}

/** Flatmate: matching teal pyjama shirt and wide trousers, no robe. */
function drawPajamaShirt(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  tone: Tone,
): void {
  drawPants(ctx, x, y, top, lean, flare, tone, 'straight');
  const beltY = outfitBeltY(y, top);

  const shirtGrad = ctx.createLinearGradient(x - 9, top, x + 9, beltY);
  shirtGrad.addColorStop(0, tone(GOWN_LIGHT));
  shirtGrad.addColorStop(0.5, tone(GOWN));
  shirtGrad.addColorStop(1, tone(GOWN_SHADE));
  ctx.fillStyle = shirtGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 9.4 + lean, top + 1);
  ctx.quadraticCurveTo(x - 10.4 + lean, top + 7, x - 9 + lean * 0.8, beltY + 1.5);
  ctx.lineTo(x + 9 + lean * 0.8, beltY + 1.5);
  ctx.quadraticCurveTo(x + 10.4 + lean, top + 7, x + 9.4 + lean, top + 1);
  ctx.quadraticCurveTo(x + lean, top - 2.4, x - 9.4 + lean, top + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // collar points
  ctx.fillStyle = tone(GOWN_LIGHT);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(x + side * 4 + lean, top + 1.4);
    ctx.lineTo(x + side * 0.6 + lean, top + 4.4);
    ctx.lineTo(x + side * 1.4 + lean, top + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // placket buttoned wrong: the line sits off-centre and the buttons miss the holes
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + 1.5 + lean * 0.6, top + 3.6);
  ctx.lineTo(x + 1 + lean * 0.4, beltY + 1);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 1 ? tone(ACCENT) : tone(FLUFF);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x + 2.2 + lean * 0.5, top + 7 + i * 3.4, 0.9, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // chest pocket
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - 7 + lean, top + 7);
  ctx.lineTo(x - 4.4 + lean, top + 7);
  ctx.lineTo(x - 4.4 + lean, top + 10);
  ctx.stroke();

  // waistband
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x - 9 + lean * 0.7, beltY + 1);
  ctx.lineTo(x + 9 + lean * 0.7, beltY + 1);
  ctx.stroke();
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/** Gran: rose quilted bed jacket, lilac nightgown, and a white feather collar. */
function drawBedJacket(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  tone: Tone,
): void {
  drawNightgownSkirt(ctx, x, y, top, lean, flare, tone);
  const beltY = outfitBeltY(y, top);

  const jacketGrad = ctx.createLinearGradient(x - 11, top, x + 11, beltY + 2);
  jacketGrad.addColorStop(0, tone(GOWN_LIGHT));
  jacketGrad.addColorStop(0.55, tone(GOWN));
  jacketGrad.addColorStop(1, tone(GOWN_SHADE));
  ctx.fillStyle = jacketGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.9;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 11 + lean, top + 1);
  ctx.quadraticCurveTo(x - 12.4 + lean, top + 8, x - 10.6 + lean * 0.8, beltY + 2);
  ctx.quadraticCurveTo(x + lean * 0.5, beltY + 4.5, x + 10.6 + lean * 0.8, beltY + 2);
  ctx.quadraticCurveTo(x + 12.4 + lean, top + 8, x + 11 + lean, top + 1);
  ctx.quadraticCurveTo(x + lean, top - 2.8, x - 11 + lean, top + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // the nightgown showing down the centre
  ctx.fillStyle = tone(TOP);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - 2.2 + lean * 0.6, top + 2.5);
  ctx.lineTo(x + 2.2 + lean * 0.6, top + 2.5);
  ctx.lineTo(x + 3.2 + lean * 0.6, beltY + 2);
  ctx.lineTo(x - 3.2 + lean * 0.6, beltY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // quilting
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.globalAlpha = 0.36;
  ctx.lineWidth = 1.15;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 9.5 + lean, top + 7 + i * 3.4);
    ctx.lineTo(x - 1 + lean * 0.7, top + 2 + i * 3.4);
    ctx.moveTo(x + 9.5 + lean, top + 7 + i * 3.4);
    ctx.lineTo(x + 1 + lean * 0.7, top + 2 + i * 3.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // feather collar, a row of soft white bumps
  ctx.fillStyle = tone(FLUFF);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 3.1 + lean, top + 1.8, 2.1, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // shawl pin
  ctx.fillStyle = tone(ACCENT);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + lean * 0.5, top + 10, 1.7, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** Kid: lime dinosaur onesie with a yellow belly, hood spikes, and a tail. */
function drawOnesie(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  tone: Tone,
): void {
  ctx.lineJoin = 'round';
  ctx.save();
  gownPath(ctx, x, y, top, lean, flare);
  ctx.clip();
  const onesieGrad = ctx.createLinearGradient(x - 14, top - 6, x + 14, y + 4);
  onesieGrad.addColorStop(0, tone(GOWN_LIGHT));
  onesieGrad.addColorStop(0.45, tone(GOWN));
  onesieGrad.addColorStop(1, tone(mix(GOWN, GOWN_SHADE, 0.6)));
  ctx.fillStyle = onesieGrad;
  ctx.fillRect(x - 20 - flare, top - 8, 40 + flare * 2, y - top + 14);

  // belly patch
  ctx.fillStyle = tone(TOP);
  ctx.strokeStyle = tone(TOP_SHADE);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x + lean * 0.4, y - 13.5, 6.8, 7.2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // soft folds
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const fx of [-8, -2, 4, 9]) {
    ctx.moveTo(x + fx + lean * 0.4, top + 2);
    ctx.quadraticCurveTo(x + fx + lean * 0.5, y - 8, x + fx * 1.1 + lean * 0.4, y - 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // zip
  ctx.strokeStyle = tone(GOWN_SHADE);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x + lean * 0.5, top + 2);
  ctx.lineTo(x + lean * 0.3, y - 5);
  ctx.stroke();

  // ink the onesie outline
  gownPath(ctx, x, y, top, lean, flare);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawOutfit(
  ctx: Ctx,
  x: number,
  y: number,
  top: number,
  lean: number,
  flare: number,
  facingAway: boolean,
  tone: Tone,
): void {
  switch (OUTFIT) {
    case 'openRobePajamas':
      drawOpenRobePajamas(ctx, x, y, top, lean, flare, facingAway, tone);
      break;
    case 'pajamaShirt':
      drawPajamaShirt(ctx, x, y, top, lean, flare, tone);
      break;
    case 'bedJacket':
      drawBedJacket(ctx, x, y, top, lean, flare, tone);
      break;
    case 'dinoOnesie':
      drawOnesie(ctx, x, y, top, lean, flare, tone);
      break;
  }
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

  const facingAway = ay < -0.55;
  drawOutfit(ctx, x, y, top, lean, flare, facingAway, tone);

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
    ctx.fillStyle = tone(SPINE);
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
    // hood crest behind everything on the head: tall teal spikes, clear of the bed hair
    ctx.fillStyle = tone(SPINE);
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

  const hairBounce = Math.sin(time * 7 + p.walkPhase) * 1.2 * (0.4 + moving);
  if (HAIR_STYLE === 'bun') {
    bunHair(ctx, hx, hy, ax, ay, trail, hairBounce, tone);
  } else if (HAIR_STYLE === 'ponytail') {
    ponytailHair(ctx, hx, hy, ax, ay, trail, hairBounce, tone);
  } else if (HAIR_STYLE === 'curls') {
    curlsHair(ctx, hx, hy, ax, ay, trail, tone);
  } else {
    // dino hood: a thick lime rim behind the face; the crest spikes were drawn above
    ctx.fillStyle = tone(GOWN);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hx - ax * 1.2, hy - 1, HEAD_R + 3.2, HEAD_R + 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = tone(GOWN_LIGHT);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(hx - ax * 1.2, hy - 1, HEAD_R + 2.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // The kid's "hair" is an orange cowlick; the back of the hood must stay lime.
  ctx.fillStyle = tone(facingAway ? (HAIR_STYLE === 'dinoHood' ? GOWN : HAIR) : SKIN);
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

    // sleep mask pushed up into the hair (tenant and flatmate); gran and kid do not wear one
    if (MASK_STYLE === 'forehead') {
      ctx.strokeStyle = tone(MASK_SHADE);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hx - HEAD_R + 0.8, hy - 6.5);
      ctx.lineTo(hx + HEAD_R - 0.8, hy - 6.5);
      ctx.stroke();
      sleepMask(ctx, hx + ax * 3.2, hy - 9.6, 0.1 + ax * 0.08 + trail * 0.03, tone);
    } else if (MASK_STYLE === 'neck') {
      ctx.strokeStyle = tone(MASK_SHADE);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy + 12.5, 9.5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // dino hood teeth framing the face opening
    if (HAIR_STYLE === 'dinoHood') {
      ctx.fillStyle = tone(FLUFF);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.15;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 1.09 + (i * Math.PI * 0.82) / 4;
        const rx = hx + Math.cos(a) * (HEAD_R + 2.6);
        const ry = hy + Math.sin(a) * (HEAD_R + 2.6);
        const ix = hx + Math.cos(a) * (HEAD_R - 0.7);
        const iy = hy + Math.sin(a) * (HEAD_R - 0.7);
        const tx = hx + Math.cos(a + 0.12) * (HEAD_R + 0.5);
        const ty = hy + Math.sin(a + 0.12) * (HEAD_R + 0.5);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(ix, iy);
        ctx.lineTo(tx, ty);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // gran's hearing aid, tucked behind the facing ear
    if (GLASSES) {
      const eside = ax >= 0 ? 1 : -1;
      ctx.fillStyle = tone('#f2d7b0');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(hx + eside * (HEAD_R - 1.6), hy + 6.2, 1.55, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = tone(ACCENT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + eside * (HEAD_R - 1.6), hy + 7.5);
      ctx.quadraticCurveTo(hx + eside * (HEAD_R + 1), hy + 10, hx + eside * (HEAD_R + 0.5), hy + 12);
      ctx.stroke();
    }
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
