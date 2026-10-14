import { INK } from '../core/constants';
import { TAU } from '../core/math';
import { onTop, prism, type Ctx } from './draw';
import { registerObjectArt, type ArtContext } from './ObjectArt';

/**
 * Drawings for the pickups (objects/PickupObjects.ts). They hover and glow a little so they
 * read as "take me" rather than "throw me".
 */

type Art = (a: ArtContext) => void;

/** A slow pulse on the floor underneath, and how far the thing is bobbing above it. */
function beacon(ctx: Ctx, x: number, y: number, time: number, color: string, seed: number): number {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.2 + seed);
  ctx.globalAlpha = 0.2 + pulse * 0.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 13 + pulse * 5, (13 + pulse * 5) * 0.62, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  return 3 + Math.sin(time * 2.6 + seed) * 2;
}

function twinkle(ctx: Ctx, x: number, y: number, time: number, seed: number): void {
  const t = (time * 0.9 + seed) % 1;
  const a = seed * 2.4 + Math.floor(time * 0.9 + seed) * 2.1;
  const sx = x + Math.cos(a) * 12;
  const sy = y + Math.sin(a) * 8;
  const r = Math.sin(t * Math.PI) * 3.6;
  if (r < 0.4) return;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - r, sy);
  ctx.lineTo(sx + r, sy);
  ctx.moveTo(sx, sy - r);
  ctx.lineTo(sx, sy + r);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

const chili: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#ff5a4e', o.seed);
  onTop(ctx, x, y, angle, z + 3 + lift, (c) => {
    // the pod: a fat comma
    const pod = (): void => {
      c.beginPath();
      c.moveTo(-8, -3.5);
      c.quadraticCurveTo(1, -8, 8, -1);
      c.quadraticCurveTo(11, 3.5, 9.5, 5);
      c.quadraticCurveTo(3, 1.5, -6.5, 3.5);
      c.quadraticCurveTo(-10.5, 1, -8, -3.5);
      c.closePath();
    };
    c.lineJoin = 'round';
    pod();
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.stroke();
    c.fillStyle = tone('#e5383b');
    c.fill();
    c.strokeStyle = tone('#ff9a8a');
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-4.5, -3);
    c.quadraticCurveTo(1, -5, 5, -1.6);
    c.stroke();
    // stalk
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(-8, -1);
    c.quadraticCurveTo(-12, -2, -12.5, -6);
    c.stroke();
    c.strokeStyle = tone('#4caf50');
    c.lineWidth = 2.4;
    c.stroke();
    c.lineCap = 'butt';
  });
  // it is so hot the air above it wobbles
  const top = y - z - lift - 12;
  ctx.strokeStyle = 'rgba(255, 190, 120, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const t = (time * 1.4 + o.seed + i * 0.33) % 1;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
    const wx = x + i * 5 + Math.sin(time * 6 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(wx, top - t * 10);
    ctx.quadraticCurveTo(wx + 2.5, top - t * 10 - 3, wx, top - t * 10 - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
};

const tuna: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#7fd6ff', o.seed);
  const base = z + lift;
  prism(ctx, x, y, angle, base, base + 5, (c) => c.arc(0, 0, 8, 0, TAU), tone('#3f7cac'), tone('#c9d2e0'), INK, 3.2);
  onTop(ctx, x, y, 0, base + 5, (c) => {
    c.strokeStyle = 'rgba(34, 27, 54, 0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 5.6, 0, TAU);
    c.stroke();
    // a little fish stamped on the lid
    c.fillStyle = tone('#3f7cac');
    c.beginPath();
    c.ellipse(-0.8, 0, 3.6, 2.1, 0, 0, TAU);
    c.moveTo(2.2, 0);
    c.lineTo(5, -2.2);
    c.lineTo(5, 2.2);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(-2.4, -0.5, 0.7, 0, TAU);
    c.fill();
  });
  if (lift > 0) twinkle(ctx, x, y - base - 5, time, o.seed);
};

const plasters: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#9be564', o.seed);
  const base = z + lift;
  prism(ctx, x, y, angle, base, base + 6, (c) => c.rect(-8, -6, 16, 12), tone('#d8d2c2'), tone('#fffdf6'), INK, 3);
  onTop(ctx, x, y, angle, base + 6, (c) => {
    c.fillStyle = tone('#e5383b');
    c.fillRect(-1.6, -4, 3.2, 8);
    c.fillRect(-4, -1.6, 8, 3.2);
  });
  if (lift > 0) twinkle(ctx, x, y - base - 6, time, o.seed);
};

const bubblewrap: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#bfe9ff', o.seed);
  const base = z + lift;
  // a roll of it, standing on end
  ctx.globalAlpha = 0.9;
  prism(ctx, x, y, angle, base, base + 9, (c) => c.arc(0, 0, 9, 0, TAU), tone('#9fd3ee'), tone('#d9f1fb'), INK, 3);
  ctx.globalAlpha = 1;
  onTop(ctx, x, y, angle, base + 9, (c) => {
    c.strokeStyle = 'rgba(34, 27, 54, 0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 3, 0, TAU);
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(Math.cos(i * 1.05) * 6, Math.sin(i * 1.05) * 6, 1.3, 0, TAU);
      c.fill();
    }
  });
  if (lift > 0) twinkle(ctx, x, y - base - 9, time, o.seed);
};

const snooze: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#c9b6ff', o.seed);
  const base = z + lift;
  prism(ctx, x, y, angle, base, base + 3, (c) => c.arc(0, 0, 9, 0, TAU), tone('#2a2540'), tone('#3a3552'), INK, 3);
  prism(ctx, x, y, angle, base + 3, base + 6.5, (c) => c.arc(0, 0, 6.5, 0, TAU), tone('#5a3fb0'), tone('#a48cf2'), INK, 2.6);
  // Zzz
  ctx.font = 'italic 800 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 2; i++) {
    const t = (time * 0.6 + i * 0.5 + o.seed) % 1;
    ctx.globalAlpha = Math.sin(t * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('z', x + 7 + t * 7, y - base - 12 - t * 12);
  }
  ctx.globalAlpha = 1;
};

const bone: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#ffd9a0', o.seed);
  onTop(ctx, x, y, angle, z + 3 + lift, (c) => {
    const shape = (): void => {
      c.beginPath();
      c.rect(-6, -1.8, 12, 3.6);
      for (const sx of [-7, 7]) {
        c.moveTo(sx + 3, -2.6);
        c.arc(sx, -2.6, 3, 0, TAU);
        c.moveTo(sx + 3, 2.6);
        c.arc(sx, 2.6, 3, 0, TAU);
      }
    };
    shape();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = tone('#fff7e6');
    c.fill();
  });
  if (lift > 0) twinkle(ctx, x, y - z - lift - 4, time, o.seed);
};

const cracker: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#ffd23f', o.seed);
  const base = z + lift;
  prism(ctx, x, y, angle, base + 1, base + 3, (c) => c.rect(-7, -7, 14, 14), tone('#c9961a'), tone('#f2c66d'), INK, 2.6);
  onTop(ctx, x, y, angle, base + 3, (c) => {
    c.fillStyle = tone('#c9961a');
    for (const px of [-3.5, 0, 3.5]) {
      for (const py of [-3.5, 0, 3.5]) {
        c.beginPath();
        c.arc(px, py, 0.8, 0, TAU);
        c.fill();
      }
    }
  });
  if (lift > 0) twinkle(ctx, x, y - base - 4, time, o.seed);
};

const seeds: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lift = o.held || z > 1 ? 0 : beacon(ctx, x, y, time, '#ffd23f', o.seed);
  const base = z + lift;
  prism(ctx, x, y, angle, base, base + 8, (c) => c.rect(-8, -7, 16, 14), tone('#c9961a'), tone('#ffd23f'), INK, 3);
  // a sunflower on the packet
  const fy = y - base - 4;
  ctx.fillStyle = tone('#ff9f1c');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 3.4, fy + Math.sin(a) * 2.6, 1.7, 1.2, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tone('#5a3a22');
  ctx.beginPath();
  ctx.arc(x, fy, 2, 0, TAU);
  ctx.fill();
  if (lift > 0) twinkle(ctx, x, y - base - 9, time, o.seed);
};

export function registerPickupArt(): void {
  const arts: Record<string, Art> = { chili, tuna, plasters, bubblewrap, snooze, bone, cracker, seeds };
  for (const [id, draw] of Object.entries(arts)) registerObjectArt(id, draw);
}
