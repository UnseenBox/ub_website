import { paintHome } from './SurfaceArt';
import { ellipse, roundRect } from './paint';

/**
 * The little framed family photo shown on the end-of-day card: dad (still in
 * his prospecting helmet), mum and two kids in front of the cottage.
 * Painted in a fixed 200 x 150 design space and scaled to the canvas.
 */

const INK = '#3b2616';
const W = 200;
const H = 150;

interface Person {
  x: number;
  /** Where the feet are. */
  base: number;
  height: number;
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  helmet?: boolean;
  ponytail?: boolean;
  dress?: boolean;
}

function outline(ctx: CanvasRenderingContext2D, width = 1.4): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function paintPerson(ctx: CanvasRenderingContext2D, p: Person): void {
  const headR = p.height * 0.14;
  const headY = p.base - p.height + headR;
  const bodyTop = headY + headR * 0.85;
  const bodyW = p.height * 0.3;
  const legTop = p.base - p.height * 0.28;

  // Legs.
  ctx.fillStyle = p.bottom;
  if (!p.dress) {
    for (const dx of [-bodyW * 0.22, bodyW * 0.22]) {
      roundRect(ctx, p.x + dx - bodyW * 0.16, legTop, bodyW * 0.32, p.base - legTop, 2);
      ctx.fill();
      outline(ctx);
    }
  }
  // Body (a soft trapezoid for dresses, a rounded block otherwise).
  ctx.beginPath();
  if (p.dress) {
    ctx.moveTo(p.x - bodyW * 0.42, bodyTop);
    ctx.lineTo(p.x + bodyW * 0.42, bodyTop);
    ctx.lineTo(p.x + bodyW * 0.75, p.base - 2);
    ctx.lineTo(p.x - bodyW * 0.75, p.base - 2);
    ctx.closePath();
  } else {
    roundRect(ctx, p.x - bodyW / 2, bodyTop, bodyW, legTop - bodyTop + 3, 4);
  }
  ctx.fillStyle = p.top;
  ctx.fill();
  outline(ctx);
  // Arms.
  ctx.fillStyle = p.skin;
  for (const s of [-1, 1]) {
    roundRect(ctx, p.x + s * bodyW * 0.62 - 1.6, bodyTop + 2, 3.2, p.height * 0.24, 1.6);
    ctx.fill();
    outline(ctx, 1);
  }
  // Hair behind the head.
  if (p.ponytail) {
    ctx.fillStyle = p.hair;
    ellipse(ctx, p.x + headR * 1.05, headY + headR * 0.7, headR * 0.45, headR * 0.9);
    outline(ctx, 1);
  }
  // Head.
  ctx.fillStyle = p.skin;
  ellipse(ctx, p.x, headY, headR, headR * 1.04);
  outline(ctx);
  // Hair cap.
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(p.x, headY - headR * 0.28, headR * 1.02, headR * 0.7, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Prospecting helmet.
  if (p.helmet) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(p.x, headY - headR * 0.32, headR * 1.12, headR * 0.85, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 1.2);
    ctx.fillStyle = '#fff6c9';
    ellipse(ctx, p.x, headY - headR * 0.95, headR * 0.28, headR * 0.2);
  }
  // Face.
  ctx.fillStyle = INK;
  ellipse(ctx, p.x - headR * 0.38, headY + headR * 0.05, headR * 0.12, headR * 0.15);
  ellipse(ctx, p.x + headR * 0.38, headY + headR * 0.05, headR * 0.12, headR * 0.15);
  ctx.beginPath();
  ctx.arc(p.x, headY + headR * 0.3, headR * 0.38, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,110,0.35)';
  ellipse(ctx, p.x - headR * 0.62, headY + headR * 0.38, headR * 0.2, headR * 0.13);
  ellipse(ctx, p.x + headR * 0.62, headY + headR * 0.38, headR * 0.2, headR * 0.13);
}

export function paintFamilyPhoto(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.scale(w / W, h / H);

  // Soft shadow and wooden frame.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, 3, 5, W - 4, H - 4, 9);
  ctx.fill();
  const wood = ctx.createLinearGradient(0, 0, W, H);
  wood.addColorStop(0, '#c68a4e');
  wood.addColorStop(1, '#8a5a2e');
  ctx.fillStyle = wood;
  roundRect(ctx, 0, 0, W - 4, H - 4, 9);
  ctx.fill();
  outline(ctx, 2.2);
  ctx.fillStyle = '#fff3dc';
  roundRect(ctx, 8, 8, W - 20, H - 20, 4);
  ctx.fill();
  outline(ctx, 1);

  // The picture itself.
  const px = 15;
  const py = 15;
  const pw = W - 34;
  const ph = H - 34;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 3);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, py, 0, py + ph);
  sky.addColorStop(0, '#9fd8ff');
  sky.addColorStop(0.7, '#fff0cc');
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = '#8fcf6b';
  ellipse(ctx, px + pw * 0.25, py + ph * 0.72, pw * 0.7, ph * 0.3);
  ctx.fillStyle = '#76c250';
  ellipse(ctx, px + pw * 0.85, py + ph * 0.76, pw * 0.65, ph * 0.3);
  // The cottage in the background.
  ctx.save();
  ctx.translate(px + 62, py + 14);
  ctx.scale(0.2, 0.2);
  paintHome(ctx, 520, 300);
  ctx.restore();
  // Foreground lawn.
  const lawn = ctx.createLinearGradient(0, py + ph * 0.78, 0, py + ph);
  lawn.addColorStop(0, '#6fbf4a');
  lawn.addColorStop(1, '#4e9a38');
  ctx.fillStyle = lawn;
  ctx.fillRect(px, py + ph * 0.8, pw, ph * 0.2);

  const base = py + ph - 5;
  paintPerson(ctx, { x: 58, base, height: 62, skin: '#f2c29b', hair: '#4a2f1b', top: '#3f7fd1', bottom: '#4b3a2a', helmet: true });
  paintPerson(ctx, { x: 92, base, height: 55, skin: '#e9b48a', hair: '#7a4a2a', top: '#e2694a', bottom: '#e2694a', dress: true, ponytail: true });
  paintPerson(ctx, { x: 122, base, height: 40, skin: '#f2c29b', hair: '#2f2118', top: '#5fcf6e', bottom: '#5fcf6e', dress: true });
  paintPerson(ctx, { x: 144, base, height: 34, skin: '#e9b48a', hair: '#c9842f', top: '#ffd23f', bottom: '#3f7fd1' });
  ctx.restore();

  // A little glass shine across the corner.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(px, py + 38);
  ctx.lineTo(px + 46, py);
  ctx.lineTo(px + 70, py);
  ctx.lineTo(px, py + 64);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
