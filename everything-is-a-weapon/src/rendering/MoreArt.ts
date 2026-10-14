import { INK } from '../core/constants';
import { TAU } from '../core/math';
import { onTop, prism, roundRectPath, type PathFn } from './draw';
import { registerObjectArt, type ArtContext } from './ObjectArt';

/** Drawings for objects/MoreObjects.ts (the throwable ones; pickups are in PickupArt.ts). */

type Art = (a: ArtContext) => void;

const circle = (r: number): PathFn => (c) => c.arc(0, 0, r, 0, TAU);

const cactus: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 8, circle(9), tone('#b5552f'), tone('#d9773f'), INK, 3.5);
  // the plant: a fat column with one arm, drawn upright whatever way the pot is turned
  const base = y - z - 8;
  const stem = (x0: number, y0: number, x1: number, y1: number, width: number): void => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = tone('#4caf50');
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.lineCap = 'butt';
  };
  stem(x + 5, base - 7, x + 9, base - 7, 4);
  stem(x + 9, base - 7, x + 9, base - 12, 4);
  stem(x, base, x, base - 15, 7.5);
  ctx.strokeStyle = tone('#d8f5b0');
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const sy = base - 3 - i * 3.6;
    ctx.moveTo(x - 4.5, sy);
    ctx.lineTo(x - 7, sy - 1.5);
    ctx.moveTo(x + 1, sy - 1);
    ctx.lineTo(x + 1, sy - 3);
  }
  ctx.stroke();
  ctx.fillStyle = tone('#ff7aa8');
  ctx.beginPath();
  ctx.arc(x, base - 19, 2.4, 0, TAU);
  ctx.fill();
};

const guitar: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 5, (c) => {
    c.ellipse(-10, 0, 11, 8.5, 0, 0, TAU);
    c.ellipse(2, 0, 8, 6.5, 0, 0, TAU);
  }, tone('#8f5a2c'), tone('#e0a050'), INK, 3.5);
  onTop(ctx, x, y, angle, z + 5, (c) => {
    c.fillStyle = tone('#5a3a22');
    c.fillRect(6, -1.8, 17, 3.6);
    c.fillRect(21, -3.2, 5, 6.4);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-4, 0, 3.2, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    c.lineWidth = 0.7;
    c.beginPath();
    for (const s of [-1, 0, 1]) {
      c.moveTo(-14, s);
      c.lineTo(23, s * 0.8);
    }
    c.stroke();
  });
};

const piggybank: Art = ({ ctx, x, y, z, angle, tone }) => {
  const dx = Math.cos(angle);
  const cy = y - z - 8;
  ctx.fillStyle = INK;
  for (const lx of [-6, 5]) ctx.fillRect(x + lx - 1.5, y - z - 3, 3.5, 4);
  ctx.fillStyle = tone('#ff9ec4');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, cy, 11, 8.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // ear, snout, eye, and the slot
  const side = dx >= 0 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x + side * 3, cy - 7.5);
  ctx.lineTo(x + side * 6, cy - 12);
  ctx.lineTo(x + side * 8, cy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = tone('#ff7aa8');
  ctx.beginPath();
  ctx.ellipse(x + side * 11, cy + 0.5, 3, 3.6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + side * 6, cy - 2.5, 1.2, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 3.5 - side, cy - 7.6, 6, 1.6);
};

const coin: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 1.5, circle(4), tone('#c9961a'), tone('#ffd23f'), INK, 2.4);
  onTop(ctx, x, y, angle, z + 1.5, (c) => {
    c.strokeStyle = tone('#c9961a');
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 2.2, 0, TAU);
    c.stroke();
  });
};

const syrup: Art = ({ ctx, x, y, z, angle, tone }) => {
  ctx.globalAlpha = 0.94;
  prism(ctx, x, y, angle, z, z + 11, circle(7), tone('#8a4b12'), tone('#b9651a'), INK, 3.5);
  ctx.globalAlpha = 1;
  prism(ctx, x, y, angle, z + 11, z + 16, circle(3), tone('#8a4b12'), tone('#e5383b'), INK, 3);
  // a maple leaf of sorts on the label
  ctx.fillStyle = tone('#fbf6e9');
  ctx.fillRect(x - 5, y - z - 9, 10, 6);
  ctx.fillStyle = tone('#e5383b');
  ctx.beginPath();
  ctx.moveTo(x, y - z - 8.4);
  ctx.lineTo(x + 2.4, y - z - 5.6);
  ctx.lineTo(x, y - z - 4);
  ctx.lineTo(x - 2.4, y - z - 5.6);
  ctx.closePath();
  ctx.fill();
};

const dumbbell: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z + 2, z + 5, (c) => c.rect(-9, -1.6, 18, 3.2), tone('#6d7689'), tone('#aab4c4'), INK, 3);
  for (const side of [-1, 1]) {
    prism(ctx, x, y, angle, z, z + 7, (c) => roundRectPath(c, side * 8.5 - 3.5, -6, 7, 12, 2.5), tone('#17132a'), tone('#3a3552'), INK, 3.2);
  }
};

const pizza: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 3.5, (c) => roundRectPath(c, -14, -14, 28, 28, 2), tone('#c9a070'), tone('#f1e3c4'), INK, 3.2);
  onTop(ctx, x, y, angle, z + 3.5, (c) => {
    c.strokeStyle = tone('#e5383b');
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 8, 0, TAU);
    c.stroke();
    c.fillStyle = tone('#e5383b');
    c.beginPath();
    c.moveTo(0, -5);
    c.lineTo(4.6, 3.2);
    c.lineTo(-4.6, 3.2);
    c.closePath();
    c.fill();
    c.fillStyle = tone('#ffd23f');
    c.beginPath();
    c.arc(0, 0.6, 1.5, 0, TAU);
    c.fill();
  });
};

const globe: Art = ({ ctx, x, y, z, angle, tone }) => {
  const cy = y - z - 11;
  ctx.fillStyle = tone('#4a90d9');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, cy, 11.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // continents slide round as it rolls
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, 10, 0, TAU);
  ctx.clip();
  ctx.fillStyle = tone('#6cc24a');
  for (let i = 0; i < 4; i++) {
    const a = angle + i * 1.7;
    const lx = x + Math.sin(a) * 11;
    if (Math.cos(a) < -0.2) continue;
    ctx.beginPath();
    ctx.ellipse(lx, cy + (i % 2 === 0 ? -3.5 : 3.5), 4.5 * Math.max(0.3, Math.cos(a)), 3.4 + (i % 3), 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x - 3, cy - 3, 6, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();
};

const trophy: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 4, (c) => roundRectPath(c, -7, -5, 14, 10, 2), tone('#3a2a1a'), tone('#5a3a22'), INK, 3);
  const top = y - z - 4;
  ctx.lineJoin = 'round';
  ctx.fillStyle = tone('#ffd23f');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  // handles
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * 7.5, top - 11, 4, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - 2, top);
  ctx.lineTo(x + 2, top);
  ctx.lineTo(x + 1.6, top - 5);
  ctx.quadraticCurveTo(x + 8.5, top - 7, x + 8, top - 16);
  ctx.lineTo(x - 8, top - 16);
  ctx.quadraticCurveTo(x - 8.5, top - 7, x - 1.6, top - 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#fff3a8');
  ctx.fillRect(x - 5, top - 14.5, 2.2, 6);
};

const lavalamp: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 5, circle(7), tone('#6d7689'), tone('#aab4c4'), INK, 3.2);
  const base = y - z - 5;
  ctx.fillStyle = tone('#7c3cd8');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - 6, base);
  ctx.quadraticCurveTo(x - 7, base - 12, x - 3, base - 20);
  ctx.lineTo(x + 3, base - 20);
  ctx.quadraticCurveTo(x + 7, base - 12, x + 6, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#ff7aa8');
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.22 + o.seed + i / 3) % 1;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t * 9 + i) * 2, base - 2.5 - t * 14, 2.4 - t, 2.9 - t, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tone('#aab4c4');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 3.2, base - 23, 6.4, 3.5);
  ctx.fill();
  ctx.stroke();
};

const kettle: Art = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 11, circle(9), tone('#8a94a8'), tone('#cfd8ea'), INK, 3.5);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const top = y - z - 11;
  // spout and handle
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(x + dx * 8, top + 6 + dy * 3);
  ctx.lineTo(x + dx * 14, top + 1 + dy * 5);
  ctx.stroke();
  ctx.strokeStyle = tone('#cfd8ea');
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, top + 1, 7, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.strokeStyle = tone('#2a2540');
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = tone('#2a2540');
  ctx.beginPath();
  ctx.arc(x, top, 2.2, 0, TAU);
  ctx.fill();
  // it has just boiled
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  const t = (time * 1.2) % 1;
  ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
  ctx.beginPath();
  ctx.moveTo(x + dx * 15, top - 1 + dy * 5 - t * 8);
  ctx.quadraticCurveTo(x + dx * 15 + 3, top - 4 + dy * 5 - t * 8, x + dx * 15, top - 7 + dy * 5 - t * 8);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export function registerMoreArt(): void {
  const arts: Record<string, Art> = { cactus, guitar, piggybank, coin, syrup, dumbbell, pizza, globe, trophy, lavalamp, kettle };
  for (const [id, draw] of Object.entries(arts)) registerObjectArt(id, draw);
}
