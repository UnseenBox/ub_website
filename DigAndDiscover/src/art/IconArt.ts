import type Phaser from 'phaser';
import { TAU, makeCanvasTexture } from './paint';

/** Custom icons painted in code. Keys: icon-star, icon-saw. */
export const ICON_STAR = 'icon-star';
export const ICON_SAW = 'icon-saw';

const SIZE = 160;

export function createIconTextures(T: Phaser.Textures.TextureManager): void {
  makeCanvasTexture(T, ICON_STAR, SIZE, SIZE, (ctx) => paintStar(ctx));
  makeCanvasTexture(T, ICON_SAW, SIZE, SIZE, (ctx) => paintSaw(ctx));
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * A chunky, friendly gold star: dark ink rim, warm gradient body, a lighter bevel
 * on the upper left, a glossy streak and a little twinkle. Corners are rounded.
 */
function paintStar(ctx: CanvasRenderingContext2D): void {
  const c = SIZE / 2;
  const cy = c + 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft drop shadow.
  ctx.save();
  ctx.translate(0, 6);
  starPath(ctx, c, cy, 66, 32);
  ctx.fillStyle = 'rgba(40,18,4,0.35)';
  ctx.strokeStyle = 'rgba(40,18,4,0.35)';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.fill();
  ctx.restore();

  // Ink rim (a fat round-joined stroke makes the points soft).
  starPath(ctx, c, cy, 66, 32);
  ctx.strokeStyle = '#4a2a0c';
  ctx.lineWidth = 16;
  ctx.stroke();

  // Body.
  const body = ctx.createLinearGradient(0, cy - 66, 0, cy + 60);
  body.addColorStop(0, '#fff3a0');
  body.addColorStop(0.45, '#ffd23a');
  body.addColorStop(1, '#f08a12');
  starPath(ctx, c, cy, 66, 32);
  ctx.fillStyle = body;
  ctx.strokeStyle = body;
  ctx.lineWidth = 9;
  ctx.fill();
  ctx.stroke();

  // Bevel: a smaller, lighter star nudged up and left, clipped to the body.
  ctx.save();
  starPath(ctx, c, cy, 66, 32);
  ctx.clip();
  starPath(ctx, c - 3, cy - 4, 50, 25);
  const bevel = ctx.createLinearGradient(0, cy - 50, 0, cy + 40);
  bevel.addColorStop(0, 'rgba(255,255,230,0.95)');
  bevel.addColorStop(1, 'rgba(255,200,60,0.15)');
  ctx.fillStyle = bevel;
  ctx.fill();
  // Shade along the bottom edges for volume.
  ctx.globalCompositeOperation = 'multiply';
  const shade = ctx.createLinearGradient(0, cy, 0, cy + 66);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(214,110,20,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, cy, SIZE, 80);
  ctx.restore();

  // Inner crisp outline for a hand-inked look.
  starPath(ctx, c, cy, 58, 28);
  ctx.strokeStyle = 'rgba(160,80,10,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gloss streak.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c - 4, cy - 2, 34, Math.PI * 1.08, Math.PI * 1.34);
  ctx.stroke();

  // Twinkle.
  const tx = c + 46;
  const ty = cy - 52;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(tx, ty - 14);
  ctx.quadraticCurveTo(tx, ty, tx + 14, ty);
  ctx.quadraticCurveTo(tx, ty, tx, ty + 14);
  ctx.quadraticCurveTo(tx, ty, tx - 14, ty);
  ctx.quadraticCurveTo(tx, ty, tx, ty - 14);
  ctx.fill();
}

/**
 * A circular saw blade: dished steel disc, hooked teeth, four relief cut-outs and a
 * bright orange arbor hub. Reads clearly even at 24 px.
 */
function paintSaw(ctx: CanvasRenderingContext2D): void {
  const c = SIZE / 2;
  const teeth = 22;
  const rOut = 72;
  const rBase = 60;
  ctx.lineJoin = 'round';

  // Shadow.
  ctx.fillStyle = 'rgba(30,16,6,0.35)';
  ctx.beginPath();
  ctx.arc(c, c + 5, rBase + 2, 0, TAU);
  ctx.fill();

  // Toothed outline: each tooth is a hook that leans in the cutting direction.
  const outline = (): void => {
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU;
      const aTip = a0 + (TAU / teeth) * 0.62;
      const a1 = a0 + TAU / teeth;
      const bx0 = c + Math.cos(a0) * rBase;
      const by0 = c + Math.sin(a0) * rBase;
      if (i === 0) ctx.moveTo(bx0, by0);
      else ctx.lineTo(bx0, by0);
      ctx.lineTo(c + Math.cos(aTip) * rOut, c + Math.sin(aTip) * rOut);
      ctx.lineTo(c + Math.cos(a1) * rBase, c + Math.sin(a1) * rBase);
    }
    ctx.closePath();
  };

  outline();
  ctx.strokeStyle = '#2b1a0c';
  ctx.lineWidth = 10;
  ctx.stroke();
  const steel = ctx.createRadialGradient(c - 22, c - 26, 6, c, c, rOut);
  steel.addColorStop(0, '#f4f7fa');
  steel.addColorStop(0.55, '#b9c3cc');
  steel.addColorStop(1, '#6f7c88');
  ctx.fillStyle = steel;
  ctx.fill();

  // Tooth tips glint.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < teeth; i += 2) {
    const aTip = (i / teeth) * TAU + (TAU / teeth) * 0.62;
    ctx.beginPath();
    ctx.arc(c + Math.cos(aTip) * (rOut - 3), c + Math.sin(aTip) * (rOut - 3), 2.2, 0, TAU);
    ctx.fill();
  }

  // Inner ring groove.
  ctx.strokeStyle = 'rgba(43,26,12,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 46, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 49, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();

  // Four relief cut-outs.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(31, 0, 11, 7, 0, 0, TAU);
    ctx.fillStyle = '#3a2a1c';
    ctx.fill();
    ctx.strokeStyle = '#2b1a0c';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Arbor hub.
  const hub = ctx.createRadialGradient(c - 4, c - 4, 2, c, c, 18);
  hub.addColorStop(0, '#ffc15a');
  hub.addColorStop(1, '#e0680f');
  ctx.fillStyle = hub;
  ctx.strokeStyle = '#2b1a0c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, 17, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2b1a0c';
  ctx.beginPath();
  ctx.arc(c, c, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(c - 6, c - 7, 3, 0, TAU);
  ctx.fill();
}
