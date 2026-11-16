import { mulberry32 } from '../core/Random';
import { ellipse, roundRect, star } from './paint';

/** The four blade metals available for the digging shovels. */
export type ShovelMetal = 'iron' | 'steel' | 'gold' | 'diamond';

interface MetalSkin {
  light: string;
  mid: string;
  shade: string;
}

const SKINS: Record<ShovelMetal, MetalSkin> = {
  iron: { light: '#c2cad2', mid: '#8a949e', shade: '#4f5860' },
  steel: { light: '#b9d6f2', mid: '#5f8fbf', shade: '#2f4e72' },
  gold: { light: '#fff0a0', mid: '#e0a21b', shade: '#8a5a0c' },
  diamond: { light: '#e6fdff', mid: '#35c8d8', shade: '#1c6f86' },
};

const OUTLINE = '#2b1c0e';
const CX = 30;
const TIP_Y = 228;

/**
 * Paints one shovel sprite in logical units (60 x 232) onto an already
 * cleared and scaled context. The handle, grip, collar and blade silhouette
 * match `drawShovel` in TextureFactory so every metal reads as one family;
 * only the blade metal changes.
 */
export function paintShovelSprite(ctx: CanvasRenderingContext2D, metal: ShovelMetal): void {
  const skin = SKINS[metal];
  const rng = mulberry32(90210);
  const between = (a: number, b: number): number => a + rng() * (b - a);

  drawGrip(ctx);
  drawHandle(ctx, rng, between);
  drawCollar(ctx);
  drawBlade(ctx, skin, metal, between);
}

function drawGrip(ctx: CanvasRenderingContext2D): void {
  // Old wood grip kept together with a wrap of faded tape.
  ctx.fillStyle = '#5b3a21';
  roundRect(ctx, CX - 23, 8, 46, 22, 11);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,210,0.16)';
  roundRect(ctx, CX - 19, 11, 38, 6, 3);
  ctx.fill();
  for (const y of [13, 20, 27]) {
    ctx.strokeStyle = 'rgba(198,191,166,0.8)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(CX - 21, y + (y === 13 ? 0.4 : -0.3));
    ctx.lineTo(CX + 21, y + (y === 27 ? -0.4 : 0.3));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(112,105,88,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - 21, y - 2.4);
    ctx.lineTo(CX + 21, y - 2.4);
    ctx.stroke();
  }
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  between: (a: number, b: number) => number,
): void {
  // Worn wooden handle.
  const wood = ctx.createLinearGradient(CX - 7, 0, CX + 7, 0);
  wood.addColorStop(0, '#3f2c19');
  wood.addColorStop(0.35, '#7a5330');
  wood.addColorStop(0.7, '#8d6038');
  wood.addColorStop(1, '#3a2816');
  ctx.fillStyle = wood;
  roundRect(ctx, CX - 6.5, 26, 13, 132, 6);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Grain along the handle.
  ctx.strokeStyle = 'rgba(38,22,8,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y = between(34, 140);
    ctx.beginPath();
    ctx.moveTo(CX - 5 + rng() * 2, y);
    ctx.quadraticCurveTo(CX + (rng() - 0.5) * 4, y + 9, CX - 4 + rng() * 3, y + 18);
    ctx.stroke();
  }
  // A couple of knots.
  for (const [kx, ky] of [[CX - 1.5, 58], [CX + 2, 118]] as const) {
    ctx.fillStyle = 'rgba(44,26,10,0.8)';
    ellipse(ctx, kx, ky, 3.4, 4.6);
    ctx.fillStyle = 'rgba(130,94,56,0.6)';
    ellipse(ctx, kx, ky, 1.6, 2.2);
  }
}

function drawCollar(ctx: CanvasRenderingContext2D): void {
  // Metal collar with a loose rivet.
  const collar = ctx.createLinearGradient(CX - 10, 0, CX + 10, 0);
  collar.addColorStop(0, '#5f5145');
  collar.addColorStop(0.45, '#a2958a');
  collar.addColorStop(1, '#544840');
  ctx.fillStyle = collar;
  roundRect(ctx, CX - 9, 150, 18, 24, 5);
  ctx.fill();
  ctx.strokeStyle = '#372d25';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, CX - 4, 154, 2.4, 3.4);
  ctx.fillStyle = '#b6aa9c';
  ellipse(ctx, CX + 1.5, 159, 3.1, 3.1);
  ctx.strokeStyle = '#372d25';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bladePath(): Path2D {
  // Exact silhouette of the blade in `drawShovel`.
  const blade = new Path2D();
  blade.moveTo(CX - 26, 170);
  blade.quadraticCurveTo(CX, 162, CX + 26, 170);
  blade.quadraticCurveTo(CX + 31, 202, CX + 15, 221);
  blade.lineTo(CX + 7, 215);
  blade.quadraticCurveTo(CX + 2, 226, CX - 2, TIP_Y);
  blade.quadraticCurveTo(CX - 18, 216, CX - 25, 206);
  blade.quadraticCurveTo(CX - 30, 192, CX - 26, 170);
  blade.closePath();
  return blade;
}

function drawBlade(
  ctx: CanvasRenderingContext2D,
  skin: MetalSkin,
  metal: ShovelMetal,
  between: (a: number, b: number) => number,
): void {
  const blade = bladePath();

  const body = ctx.createLinearGradient(CX - 28, 170, CX + 28, 220);
  body.addColorStop(0, skin.light);
  body.addColorStop(0.45, skin.mid);
  body.addColorStop(1, skin.shade);
  ctx.fillStyle = body;
  ctx.fill(blade);

  ctx.save();
  ctx.clip(blade);

  // Shared depth: a soft shade pool at the lower right of the blade.
  ctx.fillStyle = 'rgba(20,14,8,0.22)';
  ellipse(ctx, CX + 7, 212, 13, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ellipse(ctx, CX - 14, 181, 4, 11, 0.2);

  if (metal === 'iron') {
    // Matte iron: dull, a few light scratches, no rust.
    ctx.strokeStyle = 'rgba(232,238,244,0.32)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      const x = CX + between(-20, 18);
      const y = between(176, 212);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + between(-5, 5), y + between(6, 18));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(232,238,244,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX - 24, 206);
    ctx.quadraticCurveTo(CX - 12, 220, CX - 3, 226);
    ctx.stroke();
  } else if (metal === 'steel') {
    // Blue-grey steel with a clean sheen.
    const sheen = ctx.createLinearGradient(CX - 26, 172, CX + 24, 214);
    sheen.addColorStop(0, 'rgba(255,255,255,0.42)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = sheen;
    ctx.fillRect(CX - 32, 160, 64, 72);
    // Bright edge line along the cutting edge.
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(CX - 25, 205);
    ctx.quadraticCurveTo(CX - 12, 220, CX - 2, 227);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - 25, 205);
    ctx.quadraticCurveTo(CX - 12, 219, CX - 2, 226);
    ctx.stroke();
  } else if (metal === 'gold') {
    // Polished gold: soft white highlight on the upper blade.
    const gloss = ctx.createRadialGradient(CX - 9, 180, 2, CX - 9, 182, 16);
    gloss.addColorStop(0, 'rgba(255,255,255,0.62)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(CX - 30, 164, 60, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ellipse(ctx, CX - 10, 179, 9, 5, -0.35);
    // Darker inner edge so the gold reads as a hard, polished surface.
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(CX - 25, 205);
    ctx.quadraticCurveTo(CX - 12, 220, CX - 2, 227);
    ctx.stroke();
  } else {
    // Cut cyan crystal: faceted planes plus sparkle stars.
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath();
    ctx.moveTo(CX - 26, 170);
    ctx.lineTo(CX - 2, 182);
    ctx.lineTo(CX - 2, 227);
    ctx.lineTo(CX - 25, 206);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,90,110,0.22)';
    ctx.beginPath();
    ctx.moveTo(CX + 26, 170);
    ctx.lineTo(CX + 2, 184);
    ctx.lineTo(CX + 15, 221);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(CX - 20, 176);
    ctx.quadraticCurveTo(CX - 6, 186, CX + 2, 206);
    ctx.stroke();
    // Small white sparkle stars.
    for (const [sx, sy, sr] of [[17, 185, 3.4], [35, 196, 2.6], [23, 209, 3]] as const) {
      star(ctx, sx, sy, sr, '#ffffff');
    }
  }
  ctx.restore();

  // Shared outline.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke(blade);
}
