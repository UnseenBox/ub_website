import type { HeroId } from '../core/Hero';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES, type EnemyTypeId } from '../entities/EnemyTypes';
import { createPet } from '../entities/Pets';
import { Player } from '../entities/Player';
import { drawEnemy } from '../rendering/EnemyArt';
import { drawPet } from '../rendering/PetArt';
import { drawPlayer } from '../rendering/PlayerArt';

/**
 * Dev only (never imported by the game): paints the three store covers for My House, My Rules
 * with the game's own art and saves them into covers/ through the dev server's /__cover/ endpoint.
 *
 *   npm run dev, open the game, then in the console:
 *   await (await import('/src/debug/renderCovers.ts')).renderCovers()
 */

const INK = '#241a14';
const GREEN = '#1d4a40';
const GREEN_DARK = '#0f2e29';

function wall(ctx: CanvasRenderingContext2D, w: number, floorY: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, floorY);
  grad.addColorStop(0, GREEN);
  grad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, floorY);
  // the wallpaper: little houses and gnome hats
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = Math.max(2, w / 640);
  ctx.lineJoin = 'round';
  const step = Math.round(w / 9);
  for (let y = step * 0.4; y < floorY - step * 0.3; y += step) {
    for (let x = ((y / step) % 2) * step * 0.5; x < w + step; x += step) {
      const s = step * 0.2;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x, y - s * 0.8);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x - s, y + s);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + step * 0.42, y + s * 1.6);
      ctx.lineTo(x + step * 0.5, y + s * 0.2);
      ctx.lineTo(x + step * 0.58, y + s * 1.6);
      ctx.closePath();
      ctx.stroke();
    }
  }
  // skirting board
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(0, floorY - w * 0.012, w, w * 0.012);
}

function floor(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number): void {
  ctx.fillStyle = '#d8b989';
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(120, 80, 40, 0.22)';
  ctx.lineWidth = Math.max(2, w / 700);
  const plank = (h - floorY) / 4;
  for (let i = 1; i < 5; i++) {
    const y = floorY + plank * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    for (let x = (i % 2) * w * 0.07; x < w; x += w * 0.14) {
      ctx.beginPath();
      ctx.moveTo(x, y - plank);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  const shade = ctx.createLinearGradient(0, floorY, 0, h);
  shade.addColorStop(0, 'rgba(15, 46, 41, 0.35)');
  shade.addColorStop(0.3, 'rgba(15, 46, 41, 0)');
  shade.addColorStop(1, 'rgba(15, 46, 41, 0.25)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, floorY, w, h - floorY);
}

/** The wordmark: a roof over MY HOUSE, then MY RULES. `u` is the height of the big line. */
function wordmark(ctx: CanvasRenderingContext2D, cx: number, top: number, u: number): void {
  const font = (size: number): string => `${Math.round(size)}px "Bonk Display", "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // roof
  const roofW = u * 3.2;
  const roofY = top + u * 0.55;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = u * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - roofW / 2, roofY + u * 0.38);
  ctx.lineTo(cx, roofY - u * 0.42);
  ctx.lineTo(cx + roofW / 2, roofY + u * 0.38);
  ctx.stroke();
  ctx.strokeStyle = '#e8483d';
  ctx.lineWidth = u * 0.15;
  ctx.stroke();
  // chimney
  ctx.fillStyle = '#e8483d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = u * 0.07;
  ctx.fillRect(cx + roofW * 0.25, roofY - u * 0.38, u * 0.2, u * 0.32);
  ctx.strokeRect(cx + roofW * 0.25, roofY - u * 0.38, u * 0.2, u * 0.32);

  const line = (text: string, y: number, size: number, fill: string | CanvasGradient, tilt: number): void => {
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(tilt);
    ctx.font = font(size);
    ctx.fillStyle = INK;
    ctx.fillText(text, 0, size * 0.09);
    ctx.strokeStyle = INK;
    ctx.lineWidth = size * 0.2;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  line('MY HOUSE,', top + u * 1.45, u * 0.66, '#fff4dc', -0.018);
  const grad = ctx.createLinearGradient(0, top + u * 1.6, 0, top + u * 2.5);
  grad.addColorStop(0, '#ffe07a');
  grad.addColorStop(0.6, '#ffb12e');
  grad.addColorStop(1, '#ff8a1f');
  line('MY RULES', top + u * 2.45, u, grad, 0.02);
}

function hero(ctx: CanvasRenderingContext2D, id: HeroId, x: number, y: number, sc: number, faceRight: boolean): void {
  const pl = Object.assign(new Player(0, 0), { aimX: faceRight ? 0.32 : -0.32, aimY: 0.95 });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(15, 46, 41, 0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPlayer(ctx, pl, 0, 0, 2.0, id);
  const pet = createPet(id, 0, 0);
  pet.sitting = true;
  pet.facing = faceRight ? 1 : -1;
  if (pet.species === 'parrot') {
    pet.facing = 1;
    drawPet(ctx, pet, 16, 1, 34, 2.0);
  } else if (pet.species === 'hamster') drawPet(ctx, pet, faceRight ? 24 : -24, 6, 0, 2.0);
  else drawPet(ctx, pet, faceRight ? 26 : -26, 7, 0, 2.0);
  ctx.restore();
}

function gnome(ctx: CanvasRenderingContext2D, type: EnemyTypeId, x: number, y: number, sc: number, facing: number): void {
  const e = new Enemy(ENEMY_TYPES[type], 0, 0, -1, 0);
  e.facing = facing;
  e.aware = true;
  e.walkPhase = 0.7;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  drawEnemy(ctx, e, 0, 0, 1.3);
  ctx.restore();
}

function paint(w: number, h: number, layout: 'landscape' | 'portrait' | 'square'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const floorY = layout === 'portrait' ? h * 0.56 : h * 0.6;
  wall(ctx, w, floorY);
  floor(ctx, w, h, floorY);

  const u = layout === 'landscape' ? h * 0.15 : layout === 'portrait' ? w * 0.17 : w * 0.15;
  wordmark(ctx, w / 2, layout === 'portrait' ? h * 0.08 : h * 0.05, u);

  const ids: HeroId[] = ['tenant', 'flatmate', 'gran', 'kid'];
  const heroScale = layout === 'landscape' ? h / 185 : layout === 'portrait' ? w / 140 : w / 165;
  const baseY = layout === 'portrait' ? h * 0.86 : h * 0.9;
  if (layout === 'portrait') {
    hero(ctx, 'tenant', w * 0.36, baseY, heroScale * 1.1, true);
    hero(ctx, 'kid', w * 0.66, baseY - h * 0.02, heroScale * 0.95, false);
  } else {
    const spread = layout === 'landscape' ? w * 0.13 : w * 0.2;
    ids.forEach((id, i) => hero(ctx, id, w / 2 + (i - 1.5) * spread, baseY, heroScale, i < 2));
  }

  // the gnomes come in from both sides
  const gScale = heroScale * 0.9;
  if (layout === 'landscape') {
    gnome(ctx, 'basic', w * 0.06, h * 0.78, gScale, 0);
    gnome(ctx, 'kaboom', w * 0.13, h * 0.9, gScale, 0);
    gnome(ctx, 'heavy', w * 0.94, h * 0.8, gScale, Math.PI);
    gnome(ctx, 'helmet', w * 0.87, h * 0.93, gScale, Math.PI);
    gnome(ctx, 'fast', w * 0.21, h * 0.7, gScale * 0.9, 0.3);
    gnome(ctx, 'electric', w * 0.79, h * 0.7, gScale * 0.9, Math.PI - 0.3);
  } else if (layout === 'portrait') {
    gnome(ctx, 'basic', w * 0.1, h * 0.7, gScale * 0.9, 0);
    gnome(ctx, 'kaboom', w * 0.9, h * 0.68, gScale * 0.9, Math.PI);
    gnome(ctx, 'heavy', w * 0.88, h * 0.96, gScale, Math.PI);
    gnome(ctx, 'helmet', w * 0.1, h * 0.97, gScale, 0);
  } else {
    gnome(ctx, 'basic', w * 0.08, h * 0.7, gScale * 0.85, 0);
    gnome(ctx, 'kaboom', w * 0.92, h * 0.7, gScale * 0.85, Math.PI);
  }
  return canvas;
}

async function save(canvas: HTMLCanvasElement, name: string): Promise<string> {
  const blob = await (await fetch(canvas.toDataURL('image/png'))).blob();
  const res = await fetch(`/__cover/${name}`, { method: 'POST', body: blob });
  return res.text();
}

export async function renderCovers(): Promise<string[]> {
  await document.fonts.load('80px "Bonk Display"');
  return [
    await save(paint(1920, 1080, 'landscape'), 'cover-landscape-1920x1080.png'),
    await save(paint(800, 1200, 'portrait'), 'cover-portrait-800x1200.png'),
    await save(paint(800, 800, 'square'), 'cover-square-800x800.png'),
  ];
}
