import type Phaser from 'phaser';
import { mulberry32 } from '../core/Random';
import { ART_RES } from './RockArt';
import { FONT_FAMILY } from '../config/Theme';
import { TAU, blobPath, blobPoints, ellipse, makeCanvasTexture, roundRect, star } from './paint';

export const HOLE_VARIANTS = 4;
/** Blob radius inside the hole/rim textures; scale = desiredRadius / HOLE_RADIUS. */
export const HOLE_RADIUS = 60;

/** Logical geometry of the cutting machine texture (texture px = logical * ART_RES). */
export const MACHINE = { width: 440, height: 420, bedY: 300, crossbarY: 10, crossbarH: 46 } as const;
export const SAW_RADIUS = 80;
export const SHOVEL = { width: 60, height: 232, tipY: 228 } as const;

/**
 * All shared artwork is painted procedurally at boot: zero image downloads,
 * consistent style, and every texture is created exactly once.
 */
export function createSharedTextures(textures: Phaser.Textures.TextureManager): void {
  const T = textures;

  makeCanvasTexture(T, 'soft', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  for (let i = 0; i < HOLE_VARIANTS; i++) {
    const pts = blobPoints(mulberry32(100 + i), 9, 0.22, 0.8);
    makeCanvasTexture(T, `hole${i}`, 128, 128, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fill(blobPath(pts, 64, 64, HOLE_RADIUS));
    });
    makeCanvasTexture(T, `rim${i}`, 176, 176, (ctx) => {
      const g = ctx.createRadialGradient(88, 88, HOLE_RADIUS * 0.7, 88, 88, HOLE_RADIUS * 1.4);
      g.addColorStop(0, 'rgba(48,26,12,0.5)');
      g.addColorStop(1, 'rgba(48,26,12,0)');
      ctx.fillStyle = g;
      ctx.fill(blobPath(pts, 88, 88, HOLE_RADIUS * 1.42));
    });
  }

  makeCanvasTexture(T, 'clod', 44, 36, (ctx) => {
    const rng = mulberry32(7);
    const path = blobPath(blobPoints(rng, 8, 0.25, 0.75), 22, 19, 17);
    ctx.fillStyle = '#9a6538';
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = '#c99260';
    ellipse(ctx, 18, 12, 14, 8);
    ctx.restore();
  });

  makeCanvasTexture(T, 'chunk', 24, 22, (ctx) => {
    const path = blobPath(blobPoints(mulberry32(3), 7, 0.3, 0.85), 12, 11, 10);
    ctx.fillStyle = '#d6a06a';
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = 'rgba(80,45,20,0.45)';
    ellipse(ctx, 14, 17, 11, 6);
    ctx.fillStyle = 'rgba(255,240,215,0.5)';
    ellipse(ctx, 9, 7, 5, 3);
    ctx.restore();
  });

  makeCanvasTexture(T, 'pebble', 30, 26, (ctx) => {
    const path = blobPath(blobPoints(mulberry32(11), 8, 0.18, 0.8), 15, 13, 12);
    const g = ctx.createRadialGradient(11, 9, 1, 15, 13, 14);
    g.addColorStop(0, '#e2ddd5');
    g.addColorStop(1, '#8a837a');
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(50,35,25,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
  });

  makeCanvasTexture(T, 'star', 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(20, 20, 0, 20, 20, 12);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    star(ctx, 20, 20, 19, '#ffffff');
  });

  makeCanvasTexture(T, 'spark', 26, 10, (ctx) => {
    const g = ctx.createRadialGradient(13, 5, 0, 13, 5, 13);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ellipse(ctx, 13, 5, 13, 5);
  });

  makeCanvasTexture(T, 'ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, TAU);
    ctx.stroke();
  });

  makeCanvasTexture(T, 'shadow', 128, 48, (ctx) => {
    const g = ctx.createRadialGradient(64, 24, 0, 64, 24, 64);
    g.addColorStop(0, 'rgba(30,15,5,0.45)');
    g.addColorStop(1, 'rgba(30,15,5,0)');
    ctx.save();
    ctx.scale(1, 48 / 128);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
  });

  makeCanvasTexture(T, 'coin', 52, 52, (ctx) => {
    ctx.fillStyle = '#c47d0e';
    ellipse(ctx, 26, 28, 23, 23);
    const g = ctx.createRadialGradient(20, 18, 2, 26, 26, 24);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(0.5, '#ffd23f');
    g.addColorStop(1, '#f0a81c');
    ctx.fillStyle = g;
    ellipse(ctx, 26, 25, 23, 23);
    ctx.strokeStyle = 'rgba(196,125,14,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(26, 25, 16, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#b86d06';
    ctx.font = `700 22px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 26, 26);
  });

  makeCanvasTexture(T, 'ray', 90, 420, (ctx) => {
    const g = ctx.createLinearGradient(0, 420, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(45, 420);
    ctx.lineTo(0, 0);
    ctx.lineTo(90, 0);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvasTexture(T, 'confetti', 14, 9, (ctx) => {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 0, 14, 9, 3);
    ctx.fill();
  });

  makeCanvasTexture(T, 'cloud', 240, 100, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [x, y, r] of [[60, 62, 34], [105, 45, 44], [155, 55, 36], [190, 68, 26], [125, 72, 30]]) {
      ellipse(ctx, x, y, r, r);
    }
    ctx.fillStyle = 'rgba(190,220,240,0.35)';
    ellipse(ctx, 125, 88, 90, 10);
  });

  makeCanvasTexture(T, 'sky', 8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6cc4ff');
    g.addColorStop(0.7, '#c5ecff');
    g.addColorStop(1, '#fff1d2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
  });

  drawShovel(T);
  drawSaw(T);
  drawMachine(T);
}

function drawShovel(T: Phaser.Textures.TextureManager): void {
  const S = ART_RES;
  makeCanvasTexture(T, 'shovel', SHOVEL.width * S, SHOVEL.height * S, (ctx) => {
    ctx.scale(S, S);
    const cx = SHOVEL.width / 2;
    const rng = mulberry32(90210);
    const between = (a: number, b: number): number => a + rng() * (b - a);

    // Worn wooden handle.
    const wood = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
    wood.addColorStop(0, '#3f2c19');
    wood.addColorStop(0.35, '#7a5330');
    wood.addColorStop(0.7, '#8d6038');
    wood.addColorStop(1, '#3a2816');
    ctx.fillStyle = wood;
    roundRect(ctx, cx - 6.5, 26, 13, 132, 6);
    ctx.fill();
    ctx.strokeStyle = '#2b1c0e';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Grain along the handle.
    ctx.strokeStyle = 'rgba(38,22,8,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = between(34, 140);
      ctx.beginPath();
      ctx.moveTo(cx - 5 + rng() * 2, y);
      ctx.quadraticCurveTo(cx + (rng() - 0.5) * 4, y + 9, cx - 4 + rng() * 3, y + 18);
      ctx.stroke();
    }
    // A couple of knots.
    for (const [kx, ky] of [[cx - 1.5, 58], [cx + 2, 118]] as const) {
      ctx.fillStyle = 'rgba(44,26,10,0.8)';
      ellipse(ctx, kx, ky, 3.4, 4.6);
      ctx.fillStyle = 'rgba(130,94,56,0.6)';
      ellipse(ctx, kx, ky, 1.6, 2.2);
    }

    // Grip: old wood, kept together with a wrap of faded tape.
    ctx.fillStyle = '#5b3a21';
    roundRect(ctx, cx - 23, 8, 46, 22, 11);
    ctx.fill();
    ctx.strokeStyle = '#2b1c0e';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,210,0.16)';
    roundRect(ctx, cx - 19, 11, 38, 6, 3);
    ctx.fill();
    for (const y of [13, 20, 27]) {
      ctx.strokeStyle = 'rgba(198,191,166,0.8)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx - 21, y + between(-1, 1));
      ctx.lineTo(cx + 21, y + between(-1, 1));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(112,105,88,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 21, y - 2.4);
      ctx.lineTo(cx + 21, y - 2.4);
      ctx.stroke();
    }

    // Rusty collar with a loose rivet.
    const metal = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
    metal.addColorStop(0, '#5f5145');
    metal.addColorStop(0.45, '#a2958a');
    metal.addColorStop(1, '#544840');
    ctx.fillStyle = metal;
    roundRect(ctx, cx - 9, 150, 18, 24, 5);
    ctx.fill();
    ctx.strokeStyle = '#372d25';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, cx - 4, 154, 2.4, 3.4);
    ctx.fillStyle = '#b6aa9c';
    ellipse(ctx, cx + 1.5, 159, 3.1, 3.1);
    ctx.strokeStyle = '#372d25';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Blade: dull, chipped steel with rust.
    const blade = new Path2D();
    blade.moveTo(cx - 26, 170);
    blade.quadraticCurveTo(cx, 162, cx + 26, 170);
    blade.quadraticCurveTo(cx + 31, 202, cx + 15, 221);
    blade.lineTo(cx + 7, 215);
    blade.quadraticCurveTo(cx + 2, 226, cx - 2, SHOVEL.tipY);
    blade.quadraticCurveTo(cx - 18, 216, cx - 25, 206);
    blade.quadraticCurveTo(cx - 30, 192, cx - 26, 170);
    blade.closePath();
    const steel = ctx.createLinearGradient(cx - 28, 170, cx + 28, 220);
    steel.addColorStop(0, '#948a80');
    steel.addColorStop(0.45, '#776d63');
    steel.addColorStop(1, '#4e453d');
    ctx.fillStyle = steel;
    ctx.fill(blade);

    ctx.save();
    ctx.clip(blade);
    // Rust patches.
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(178,86,32,0.58)' : 'rgba(201,120,52,0.46)';
      const rx = between(5, 13);
      ellipse(ctx, cx + between(-24, 24), between(172, 218), rx, rx * between(0.5, 0.9));
    }
    // Rust speckles.
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rng() < 0.6 ? 'rgba(150,70,26,0.5)' : 'rgba(212,132,66,0.45)';
      ellipse(ctx, cx + between(-26, 26), between(170, 222), between(0.6, 1.8), between(0.6, 1.6));
    }
    // Scratches.
    ctx.strokeStyle = 'rgba(226,220,208,0.32)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 9; i++) {
      const x = cx + between(-22, 22);
      const y = between(174, 214);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + between(-6, 6), y + between(6, 20));
      ctx.stroke();
    }
    // Worn bright edge and a soft top light.
    ctx.strokeStyle = 'rgba(226,220,208,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 24, 206);
    ctx.quadraticCurveTo(cx - 12, 220, cx - 3, 226);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,240,0.22)';
    ellipse(ctx, cx - 13, 182, 4, 12, 0.2);
    ctx.fillStyle = 'rgba(40,26,14,0.28)';
    ellipse(ctx, cx + 6, 212, 13, 7);
    ctx.restore();

    ctx.strokeStyle = '#3d342c';
    ctx.lineWidth = 2;
    ctx.stroke(blade);
  });
}

function drawSaw(T: Phaser.Textures.TextureManager): void {
  const R = SAW_RADIUS * ART_RES;
  const size = Math.ceil(R * 2 + 8);
  makeCanvasTexture(T, 'saw', size, size, (ctx) => {
    const c = size / 2;
    const teeth = 30;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU;
      const a1 = ((i + 0.65) / teeth) * TAU;
      const p0 = { x: c + Math.cos(a0) * R * 0.88, y: c + Math.sin(a0) * R * 0.88 };
      const p1 = { x: c + Math.cos(a1) * R, y: c + Math.sin(a1) * R };
      if (i === 0) ctx.moveTo(p0.x, p0.y);
      else ctx.lineTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.closePath();
    ctx.fillStyle = '#c9d1da';
    ctx.fill();
    ctx.strokeStyle = '#5f6875';
    ctx.lineWidth = 2 * ART_RES;
    ctx.stroke();
    const disc = ctx.createRadialGradient(c - R * 0.3, c - R * 0.3, R * 0.1, c, c, R * 0.9);
    disc.addColorStop(0, '#f6f8fb');
    disc.addColorStop(0.6, '#b9c2cc');
    disc.addColorStop(1, '#8a94a0');
    ctx.fillStyle = disc;
    ellipse(ctx, c, c, R * 0.86, R * 0.86);
    ctx.strokeStyle = 'rgba(70,80,95,0.25)';
    ctx.lineWidth = ART_RES;
    for (const k of [0.7, 0.5]) {
      ctx.beginPath();
      ctx.arc(c, c, R * k, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = R * 0.07;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.6, -2.7, -1.7);
    ctx.stroke();
    ctx.fillStyle = '#3d4450';
    ellipse(ctx, c, c, R * 0.24, R * 0.24);
    ctx.fillStyle = '#9aa3ad';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      ellipse(ctx, c + Math.cos(a) * R * 0.14, c + Math.sin(a) * R * 0.14, R * 0.035, R * 0.035);
    }
    ctx.fillStyle = '#ff9f2e';
    ellipse(ctx, c, c, R * 0.07, R * 0.07);
  });
}

function drawMachine(T: Phaser.Textures.TextureManager): void {
  const S = ART_RES;
  makeCanvasTexture(T, 'machine', MACHINE.width * S, MACHINE.height * S, (ctx) => {
    ctx.scale(S, S);
    const paint = (x: number, w: number) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#ffc06e');
      g.addColorStop(0.35, '#f7a23c');
      g.addColorStop(1, '#c8691c');
      return g;
    };
    // Posts.
    for (const x of [32, 368]) {
      ctx.fillStyle = paint(x, 40);
      roundRect(ctx, x, 30, 40, 290, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,50,10,0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Crossbar.
    const bar = ctx.createLinearGradient(0, MACHINE.crossbarY, 0, MACHINE.crossbarY + MACHINE.crossbarH);
    bar.addColorStop(0, '#ffc06e');
    bar.addColorStop(1, '#d77a22');
    ctx.fillStyle = bar;
    roundRect(ctx, 18, MACHINE.crossbarY, 404, MACHINE.crossbarH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,50,10,0.55)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, 34, MACHINE.crossbarY + 6, 372, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#8a4a14';
    for (const x of [44, 396]) ellipse(ctx, x, MACHINE.crossbarY + 28, 5, 5);
    // Bed plate.
    const bed = ctx.createLinearGradient(0, MACHINE.bedY, 0, MACHINE.bedY + 34);
    bed.addColorStop(0, '#d9dfe6');
    bed.addColorStop(1, '#7f8994');
    ctx.fillStyle = bed;
    roundRect(ctx, 46, MACHINE.bedY, 348, 34, 10);
    ctx.fill();
    ctx.strokeStyle = '#4f5763';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2c3038';
    roundRect(ctx, 214, MACHINE.bedY + 3, 12, 28, 4);
    ctx.fill();
    // Base.
    const base = ctx.createLinearGradient(0, 330, 0, 418);
    base.addColorStop(0, '#4a5072');
    base.addColorStop(1, '#2d3049');
    ctx.fillStyle = base;
    roundRect(ctx, 30, 332, 380, 84, 22);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, 44, 338, 352, 12, 6);
    ctx.fill();
    // Hazard stripe.
    ctx.save();
    roundRect(ctx, 60, 356, 150, 14, 7);
    ctx.clip();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(60, 356, 150, 14);
    ctx.fillStyle = '#2d3049';
    for (let x = 50; x < 220; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 370);
      ctx.lineTo(x + 10, 356);
      ctx.lineTo(x + 18, 356);
      ctx.lineTo(x + 8, 370);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Vents.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(70 + i * 22, 388);
      ctx.lineTo(70 + i * 22, 402);
      ctx.stroke();
    }
    // Control panel.
    ctx.fillStyle = '#1d2033';
    roundRect(ctx, 250, 356, 130, 46, 12);
    ctx.fill();
    ctx.fillStyle = '#6cf08a';
    ellipse(ctx, 275, 379, 9, 9);
    ctx.fillStyle = '#ff5a4a';
    ellipse(ctx, 305, 379, 9, 9);
    ctx.fillStyle = '#5fd0ff';
    roundRect(ctx, 324, 368, 44, 22, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const x of [272, 302]) ellipse(ctx, x, 376, 3, 2);
  });
}
