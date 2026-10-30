import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Dog, Hamster, Parrot, Pet } from '../entities/Pets';
import { drawCat } from './CatArt';
import { PET_OUTFITS, type PetOutfitId } from '../gameplay/PetOutfits';
import type { Ctx } from './draw';

/** The pets that are not the cat. Side-on stickers, like it, flipped to face the way they go. */

function inked(ctx: Ctx, fill: string, width = 2.6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, width: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 2.6;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function shadow(ctx: Ctx, x: number, y: number, rx: number): void {
  ctx.fillStyle = 'rgba(34, 27, 54, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 2, rx, rx * 0.4, 0, 0, TAU);
  ctx.fill();
}

// ───────────── Waffle ─────────────

const DOG = '#b5653a';
const DOG_DARK = '#7a3f20';
const DOG_TAN = '#e8b27a';

function drawDog(ctx: Ctx, dog: Dog, x: number, y: number, z: number, time: number): void {
  const biting = dog.riding;
  if (!biting) shadow(ctx, x, y - z, 13);
  const speed = Math.hypot(dog.vx, dog.vy);
  const running = speed > 40;
  const war = dog.frenzy > 0;

  ctx.save();
  ctx.translate(x, y - z);
  ctx.scale(dog.facing, 1);
  ctx.lineJoin = 'round';
  if (biting) {
    // hanging on by the teeth, the rest of it flying out behind
    ctx.translate(13, -9);
    ctx.rotate(Math.sin(time * 26) * 0.32);
    ctx.translate(-13, 9);
  }

  const stride = running ? Math.sin(dog.walkPhase) * 3.4 : 0;
  const bounce = running ? Math.abs(Math.cos(dog.walkPhase)) * 1.4 : 0;
  const hop = dog.barking * 2;
  const sit = dog.sitting && !running && !biting;
  const by = -6.5 - bounce - hop;

  // tail: wags when things are calm, straight out when not
  const wag = war || biting ? 0 : Math.sin(time * 14 + dog.seed) * 3;
  limb(ctx, -12, by - 1, -17, by - 8 + wag, DOG, 2.4);

  if (sit) {
    limb(ctx, -8, -3, -5, 0, DOG, 3);
    ctx.beginPath();
    ctx.moveTo(-13, -1);
    ctx.quadraticCurveTo(-14, -9, -4, -11);
    ctx.lineTo(9, -13);
    ctx.lineTo(9, -3);
    ctx.quadraticCurveTo(0, 0, -13, -1);
    ctx.closePath();
    inked(ctx, DOG);
    limb(ctx, 6, -4, 7, 0, DOG, 3);
  } else {
    limb(ctx, -9, by + 3, -9.5 - stride, 0, DOG_DARK, 2.8);
    limb(ctx, 8, by + 3, 8.5 + stride, 0, DOG_DARK, 2.8);
    ctx.beginPath();
    ctx.ellipse(0, by, 14, 5.4, 0, 0, TAU);
    inked(ctx, DOG);
    // shaded back, pale belly and a cream chest
    ctx.strokeStyle = DOG_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, by, 14, 5.4, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.fillStyle = DOG_TAN;
    ctx.beginPath();
    ctx.ellipse(1, by + 3, 9, 2, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11.5, by - 1, 3, 3.6, 0, 0, TAU);
    ctx.fill();
    limb(ctx, -6.5, by + 3.5, -6 + stride, 0, DOG, 2.8);
    limb(ctx, 10.5, by + 3.5, 11 - stride, 0, DOG, 2.8);
    // toe lines on the front feet
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-6 + stride, -1.6);
    ctx.lineTo(-6 + stride, 0.4);
    ctx.moveTo(11 - stride, -1.6);
    ctx.lineTo(11 - stride, 0.4);
    ctx.stroke();
  }
  if (war && !biting) {
    // hackles up along the back
    ctx.fillStyle = DOG_DARK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    for (const hx of [-8, -3, 2, 7]) {
      ctx.beginPath();
      ctx.moveTo(hx - 2.4, by - 4.6);
      ctx.lineTo(hx, by - 9);
      ctx.lineTo(hx + 2.4, by - 4.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.lineJoin = 'round';
  }
  // collar with a brass tag
  const hy = sit ? -15 : by - 5;
  const hx = sit ? 10 : 14;
  ctx.strokeStyle = '#e5383b';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(hx - 4.5, hy + 5.5);
  ctx.lineTo(hx - 1, hy + 7);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(hx - 0.5, hy + 8.6, 1.8, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // head: a long snout with a black nose on the end of it
  const open = biting ? 0 : dog.barking;
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy - 4.6);
  ctx.quadraticCurveTo(hx + 2, hy - 6, hx + 5, hy - 2.5 - open * 2);
  ctx.lineTo(hx + 11, hy - 1.5 - open * 3);
  ctx.lineTo(hx + 11, hy + 1.2 - open * 2);
  ctx.lineTo(hx + 4, hy + 2 - open);
  ctx.lineTo(hx + 10, hy + 3 + open * 3);
  ctx.lineTo(hx + 4, hy + 4.6 + open * 2);
  ctx.quadraticCurveTo(hx - 4, hy + 6, hx - 5, hy);
  ctx.closePath();
  inked(ctx, DOG);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + 11, hy - 1 - open * 3, 1.7, 0, TAU);
  ctx.fill();
  // eye and brow: squeezed shut while biting
  if (biting) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 0.5, hy - 2);
    ctx.lineTo(hx + 4.5, hy - 2.6);
    ctx.stroke();
    ctx.lineCap = 'butt';
  } else {
    ctx.beginPath();
    ctx.arc(hx + 2.2, hy - 2, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx + 1.8, hy - 2.4, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
  }
  if (war || dog.state === 'bark') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx - 0.5, hy - 5);
    ctx.lineTo(hx + 4, hy - 3.6);
    ctx.stroke();
  }
  // ear: flops, and flies up on a bark
  ctx.beginPath();
  const flap = dog.barking * 5 + (running ? Math.sin(dog.walkPhase * 2) * 1.5 : 0) + (biting ? Math.sin(time * 30) * 3 : 0);
  ctx.moveTo(hx - 3.5, hy - 4);
  ctx.quadraticCurveTo(hx - 9, hy - 3 - flap, hx - 6.5, hy + 5.5 - flap);
  ctx.quadraticCurveTo(hx - 2.5, hy + 4, hx - 1, hy - 3);
  ctx.closePath();
  inked(ctx, DOG_DARK, 2.2);
  ctx.fillStyle = '#e8b27a';
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy - 2.4);
  ctx.quadraticCurveTo(hx - 7.4, hy - 1.8 - flap * 0.7, hx - 5.8, hy + 3.4 - flap * 0.7);
  ctx.quadraticCurveTo(hx - 3.4, hy + 2.4, hx - 2.6, hy - 1.8);
  ctx.closePath();
  ctx.fill();
  if (dog.barking > 0.3) {
    // the noise itself
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const a of [-0.5, 0, 0.5]) {
      ctx.moveTo(hx + 15 + Math.cos(a) * 2, hy + Math.sin(a) * 8);
      ctx.lineTo(hx + 20 + Math.cos(a) * 3, hy + Math.sin(a) * 12);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // cosmetic outfit accessory (drawn when owned + equipped)
  const outfit = dog.outfitTag || '';
  if (outfit && outfit in PET_OUTFITS) {
    const def = PET_OUTFITS[outfit as PetOutfitId];
    ctx.fillStyle = def.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    if (outfit === 'dog_bandana') { ctx.beginPath(); ctx.ellipse(-6,-16,7,3.5,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
    else if (outfit === 'cat_bow') { ctx.beginPath(); ctx.ellipse(-5,-18,4,2,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9,-18); ctx.lineTo(-1,-18); ctx.stroke(); }
    else if (outfit === 'hamster_hat') { ctx.beginPath(); ctx.arc(-6,-19,5,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff3d6'; ctx.beginPath(); ctx.ellipse(-6,-17,3,1.2,0,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

// ───────────── Captain ─────────────

const RED = '#e5383b';
const RED_DARK = '#b0252b';
const BLUE = '#2f6fd6';
const GOLD = '#ffd23f';

function drawParrot(ctx: Ctx, parrot: Parrot, x: number, y: number, z: number, time: number): void {
  const air = parrot.flying;
  if (air > 0.3) shadow(ctx, x, y, 7 + Math.min(4, 200 / (z + 20)));
  const flap = Math.sin(time * 24 + parrot.seed);
  const diving = parrot.state === 'dive';

  ctx.save();
  ctx.translate(x, y - z);
  ctx.scale(parrot.facing, 1);
  if (air > 0.3) ctx.rotate(diving ? 0.5 : 0.18);
  ctx.lineJoin = 'round';

  // tail feathers with barring
  for (const [dx, color] of [[-1.5, BLUE], [1, RED_DARK]] as const) {
    ctx.beginPath();
    ctx.moveTo(-4, 1);
    ctx.lineTo(-14 + dx, 7 + dx);
    ctx.lineTo(-11 + dx, 9 + dx);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    inked(ctx, color, 2);
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8 + dx * 0.5, 4 + dx * 0.5);
    ctx.lineTo(-11 + dx, 7.4 + dx);
    ctx.stroke();
  }
  // far wing
  if (air > 0.3) {
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-7, -6 - flap * 11);
    ctx.lineTo(3, -5 - flap * 4);
    ctx.closePath();
    inked(ctx, BLUE, 2);
  }
  // body
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.2, 8, -0.5, 0, TAU);
  inked(ctx, RED);
  // chest feather scallops
  ctx.strokeStyle = RED_DARK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let r = 0; r < 3; r++) {
    ctx.moveTo(-4.5 + r * 0.8, -1 + r * 3);
    ctx.quadraticCurveTo(-1 + r * 0.8, 1 + r * 3, 2.5 + r * 0.5, -0.5 + r * 3);
  }
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.arc(4.6, -8, 5.4, 0, TAU);
  inked(ctx, RED);
  // crest feathers, bouncing with the wingbeat
  const crest = air > 0.3 ? flap * 2 : Math.sin(time * 3 + parrot.seed) * 0.8;
  ctx.fillStyle = RED;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(4.6 + k * 2.2, -12.6);
    ctx.quadraticCurveTo(5 + k * 3.4, -16.5 - crest, 7 + k * 4.4, -13.4);
    ctx.quadraticCurveTo(5.4 + k * 3, -12.4, 4.6 + k * 2.2, -12.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(6.2, -7.6, 2.8, 3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(6.6, -8, 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6.3, -8.4, 0.35, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  if (diving) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -11.5);
    ctx.lineTo(8.6, -9.6);
    ctx.stroke();
  }
  // beak
  ctx.beginPath();
  ctx.moveTo(8.8, -9.6);
  ctx.quadraticCurveTo(14.5, -9, 11, -3);
  ctx.quadraticCurveTo(10.5, -6.5, 8.6, -6);
  ctx.closePath();
  inked(ctx, '#2a2540', 1.6);
  // cere and a beak shine
  ctx.fillStyle = '#8f9bb0';
  ctx.beginPath();
  ctx.ellipse(9.6, -9, 1.3, 0.9, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.arc(11.4, -7.6, 0.8, 0, TAU);
  ctx.fill();
  // near wing: folded when perched, beating when not
  ctx.beginPath();
  if (air > 0.3) {
    ctx.moveTo(-3, -3);
    ctx.lineTo(-10, -4 + flap * 12);
    ctx.lineTo(-2, 2 + flap * 5);
    ctx.lineTo(4, -1);
  } else {
    ctx.moveTo(-3, -4);
    ctx.quadraticCurveTo(-8, 1, -4, 8);
    ctx.quadraticCurveTo(2, 4, 2, -3);
  }
  ctx.closePath();
  inked(ctx, BLUE, 2.2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -1.5);
  ctx.lineTo(1.5, -0.5);
  ctx.stroke();
  // covert bars across the folded wing
  if (air <= 0.3) {
    ctx.strokeStyle = '#1d4b9e';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5.4, 0.5);
    ctx.quadraticCurveTo(-3, 3.5, 0, 3);
    ctx.moveTo(-5.8, 3.4);
    ctx.quadraticCurveTo(-3.2, 6, 0.4, 5.4);
    ctx.stroke();
  }
  // feet
  if (air <= 0.3) {
    ctx.strokeStyle = '#2a2540';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-1, 7);
    ctx.lineTo(-1, 10);
    ctx.moveTo(2, 7);
    ctx.lineTo(2, 10);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────── Nugget ─────────────

function drawHamster(ctx: Ctx, ham: Hamster, x: number, y: number, z: number, time: number): void {
  const s = ham.size;
  const r = 11 * s;
  shadow(ctx, x, y - z, r);
  const cy = y - z - r + 1;
  const running = Math.hypot(ham.vx, ham.vy) > 30;
  const big = ham.frenzy > 0;

  // the hamster first, so the ball's shine goes over it
  ctx.save();
  ctx.translate(x, cy + r * 0.28);
  ctx.scale(ham.facing * s, s);
  ctx.lineJoin = 'round';
  const step = running ? Math.sin(time * 34) * 2 : 0;
  ctx.fillStyle = INK;
  ctx.fillRect(-4 + step, 3.5, 2.4, 2.6);
  ctx.fillRect(2.5 - step, 3.5, 2.4, 2.6);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5.2, 0, 0, TAU);
  inked(ctx, '#f2b25c', 2.2);
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.ellipse(2.4, 1.8, 3.8, 2.6, 0, 0, TAU);
  ctx.fill();
  // cheek pouches, stuffed while the seeds last
  const pouch = big ? 1.7 : 1;
  ctx.fillStyle = '#f7cd8d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (const [px, py, pr] of [[4.6, 2.4, 2.1], [1.8, 3.2, 1.7]] as const) {
    ctx.beginPath();
    ctx.arc(px, py, pr * pouch, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (big) {
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.arc(4.6, 2, 0.9, 0, TAU);
    ctx.fill();
  }
  // ears, eye, nose
  ctx.beginPath();
  ctx.arc(1.5, -5, 1.9, 0, TAU);
  inked(ctx, '#f2b25c', 1.6);
  ctx.fillStyle = '#ff8fa3';
  ctx.beginPath();
  ctx.arc(1.5, -5, 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(4, -1.4, big ? 1.5 : 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(3.7, -1.8, 0.35, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff8fa3';
  ctx.beginPath();
  ctx.arc(7, 0.2, 1, 0, TAU);
  ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6.6, -0.4);
  ctx.lineTo(10, -1.8);
  ctx.moveTo(6.6, 0.8);
  ctx.lineTo(10, 2);
  ctx.stroke();
  if (big) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1.8, -3.8);
    ctx.lineTo(5.4, -2.6);
    ctx.stroke();
  }
  ctx.restore();

  // the ball
  ctx.fillStyle = big ? 'rgba(255, 210, 63, 0.24)' : 'rgba(159, 227, 255, 0.24)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // seams that turn with it
  ctx.strokeStyle = big ? 'rgba(255, 159, 28, 0.9)' : 'rgba(74, 169, 214, 0.9)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a = ham.roll + (i * TAU) / 3;
    ctx.beginPath();
    ctx.ellipse(x, cy, Math.abs(Math.cos(a)) * r * 0.96 + 0.2, r * 0.96, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.72, Math.PI * 1.15, Math.PI * 1.5);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawPet(ctx: Ctx, pet: Pet, x: number, y: number, z: number, time: number): void {
  switch (pet.species) {
    case 'cat':
      drawCat(ctx, pet, x, y, z, time);
      break;
    case 'dog':
      drawDog(ctx, pet, x, y, z, time);
      break;
    case 'parrot':
      drawParrot(ctx, pet, x, y, z, time);
      break;
    case 'hamster':
      drawHamster(ctx, pet, x, y, z, time);
      break;
  }
}
