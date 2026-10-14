import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Zone } from '../hazards/Zone';
import { hash, type Ctx } from './draw';

function blobPath(ctx: Ctx, x: number, y: number, r: number, seed: number, squashY = 0.78): void {
  const points = 10;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const rr = r * (0.86 + 0.14 * Math.sin(seed * 3.1 + i * 2.3));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * squashY;
    if (i === 0) ctx.moveTo(px, py);
    else {
      const pa = ((i - 0.5) / points) * TAU;
      const pr = r * (0.92 + 0.14 * Math.sin(seed * 1.7 + i * 1.3));
      ctx.quadraticCurveTo(x + Math.cos(pa) * pr * 1.04, y + Math.sin(pa) * pr * 1.04 * squashY, px, py);
    }
  }
  ctx.closePath();
}

function lightning(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  const segments = 5;
  ctx.moveTo(x0, y0);
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const off = i === segments ? 0 : (hash(seed + i * 13.7) - 0.5) * len * 0.35;
    ctx.lineTo(x0 + (x1 - x0) * t + (nx / len) * off, y0 + (y1 - y0) * t + (ny / len) * off);
  }
}

function strokeBolts(ctx: Ctx, draw: () => void): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.strokeStyle = '#fffbe0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Zones that lie flat on the floor, drawn before anything standing in the room. */
export function drawFloorZone(ctx: Ctx, z: Zone, time: number): void {
  const { x, y, r, seed } = z;
  switch (z.zone) {
    case 'water': {
      const live = z.energized;
      blobPath(ctx, x, y, r, seed);
      ctx.fillStyle = live ? 'rgba(160, 235, 160, 0.72)' : 'rgba(74, 214, 232, 0.6)';
      ctx.fill();
      ctx.strokeStyle = live ? '#fff7a8' : 'rgba(255,255,255,0.75)';
      ctx.lineWidth = live ? 3 : 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.3, Math.PI * 1.1, Math.PI * 1.5);
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (live) {
        const slice = Math.floor(time * 18);
        strokeBolts(ctx, () => {
          for (let i = 0; i < 4; i++) {
            const a0 = hash(slice * 3.3 + i * 7.1 + seed) * TAU;
            const a1 = a0 + 1.6 + hash(slice + i) * 2.4;
            lightning(
              ctx,
              x + Math.cos(a0) * r * 0.8, y + Math.sin(a0) * r * 0.6,
              x + Math.cos(a1) * r * 0.75, y + Math.sin(a1) * r * 0.55,
              slice + i * 31,
            );
          }
        });
      }
      break;
    }
    case 'glass': {
      ctx.fillStyle = 'rgba(205, 248, 236, 0.9)';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        const a = hash(seed + i * 5.3) * TAU;
        const d = hash(seed * 2 + i * 3.1) * r * 0.85;
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d * 0.8;
        const s = 3 + hash(seed + i) * 4;
        const rot = hash(seed * 5 + i) * TAU;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(rot) * s, sy + Math.sin(rot) * s);
        ctx.lineTo(sx + Math.cos(rot + 2.2) * s, sy + Math.sin(rot + 2.2) * s);
        ctx.lineTo(sx + Math.cos(rot + 4) * s * 0.7, sy + Math.sin(rot + 4) * s * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'dirt':
    case 'mud': {
      const mud = z.zone === 'mud';
      blobPath(ctx, x, y, r, seed);
      ctx.fillStyle = mud ? 'rgba(74, 50, 30, 0.92)' : 'rgba(122, 86, 52, 0.85)';
      ctx.fill();
      if (mud) {
        ctx.strokeStyle = 'rgba(160, 120, 80, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = mud ? 'rgba(130, 98, 66, 0.9)' : 'rgba(77, 51, 32, 0.9)';
      for (let i = 0; i < 7; i++) {
        const a = hash(seed + i * 4.1) * TAU;
        const d = hash(seed * 3 + i) * r * 0.7;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75, 2 + hash(seed + i * 9) * 3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'foam': {
      const fade = Number.isFinite(z.ttl) ? Math.min(1, z.ttl / 1.5) : 1;
      const grow = Math.min(1, z.age / 0.25);
      ctx.globalAlpha = 0.9 * fade;
      for (let i = 0; i < 9; i++) {
        const a = hash(seed + i * 2.7) * TAU;
        const d = hash(seed * 4 + i * 1.9) * r * 0.75;
        const rr = (5 + hash(seed + i * 6.3) * (r * 0.3)) * grow;
        ctx.fillStyle = i % 3 === 0 ? '#dcefff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rr, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'fire': {
      ctx.fillStyle = 'rgba(255, 140, 40, 0.16)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 1.15, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'oil': {
      blobPath(ctx, x, y, r, seed);
      ctx.fillStyle = 'rgba(70, 48, 16, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(226, 178, 74, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // the rainbow sheen you get on a spill
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      const sheen = ['rgba(255, 120, 190, 0.5)', 'rgba(120, 220, 255, 0.5)', 'rgba(255, 230, 120, 0.5)'];
      for (let i = 0; i < 3; i++) {
        const a = hash(seed + i * 2.9) * TAU;
        const d = r * (0.2 + hash(seed * 2 + i) * 0.35);
        ctx.strokeStyle = sheen[i]!;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.28, r * 0.12, a, 0.3, 2.6);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      break;
    }
    case 'paint': {
      const colors = ['#ff5a8a', '#4ad6e8', '#ffd23f', '#9be564'];
      const color = colors[Math.floor(hash(seed) * colors.length)]!;
      blobPath(ctx, x, y, r, seed);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      // splatter round the edge
      for (let i = 0; i < 8; i++) {
        const a = hash(seed + i * 1.9) * TAU;
        const d = r * (0.95 + hash(seed * 3 + i) * 0.35);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.78, 2 + hash(seed + i * 5) * 5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.3, Math.PI * 1.1, Math.PI * 1.5);
      ctx.stroke();
      ctx.lineCap = 'butt';
      break;
    }
    case 'flour': {
      // a dusting settles on the floor under the cloud
      blobPath(ctx, x, y, r * 0.9, seed);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      break;
    }
    case 'magnet': {
      // rings of pull closing in on it; nothing while it is being carried
      if (z.attached && z.attached.kind === 'object' && z.attached.held) break;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.7 + i / 3) % 1;
        const rr = r * (1 - t * 0.85);
        ctx.strokeStyle = `rgba(229, 56, 59, ${(0.34 * Math.sin(t * Math.PI)).toFixed(3)})`;
        ctx.setLineDash([7, 9]);
        ctx.beginPath();
        ctx.ellipse(x, y, rr, rr * 0.78, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    }
    case 'music': {
      // a dance floor nobody asked for
      const beat = 0.5 + 0.5 * Math.sin(time * 10.5);
      const tiles = ['rgba(164, 140, 242, 0.2)', 'rgba(255, 90, 138, 0.2)', 'rgba(74, 214, 232, 0.2)', 'rgba(255, 210, 63, 0.2)'];
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * TAU + time * 0.4;
        ctx.fillStyle = tiles[(i + Math.floor(time * 3.5)) % tiles.length]!;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.ellipse(x, y, r * (0.86 + beat * 0.08), r * 0.78 * (0.86 + beat * 0.08), 0, a0, a0 + TAU / 8);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'feathers': {
      blobPath(ctx, x, y, r * 0.85, seed);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
      break;
    }
    case 'slick':
    case 'electric':
    case 'wind':
    case 'trap':
    case 'steam':
      break;
  }
}

function flame(ctx: Ctx, x: number, y: number, w: number, h: number, lean: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x + lean, y - h);
  ctx.quadraticCurveTo(x + w * 1.1, y - h * 0.5, x + w, y);
  ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
  ctx.closePath();
}

/** Zones with height or glow (flames, arcs, wind), drawn over the room's contents. */
export function drawOverlayZone(ctx: Ctx, z: Zone, time: number): void {
  const { x, y, r, seed } = z;
  switch (z.zone) {
    case 'fire': {
      const lift = z.attached ? (z.attached.kind === 'object' ? z.attached.def.height + z.attached.body.z : 14) : 0;
      const small = r < 18;
      const count = small ? 1 : Math.min(7, 3 + Math.floor(r / 12));
      const fade = Number.isFinite(z.ttl) ? Math.min(1, z.ttl / 0.6) : 1;
      for (let i = 0; i < count; i++) {
        const a = hash(seed + i * 3.9) * TAU;
        const d = small ? 0 : hash(seed * 2 + i * 1.3) * r * 0.55;
        const fx = x + Math.cos(a) * d;
        const fy = y + Math.sin(a) * d * 0.7 - lift;
        const flick = 0.75 + 0.25 * Math.sin(time * 13 + i * 2.1 + seed);
        const h = (small ? 13 : 20 + hash(seed + i) * 16) * flick * fade;
        const w = (small ? 4 : 7 + hash(seed + i * 7) * 4) * fade;
        const lean = Math.sin(time * 7 + i + seed) * 3;
        ctx.fillStyle = '#ff5a2e';
        flame(ctx, fx, fy, w, h, lean);
        ctx.fill();
        ctx.fillStyle = '#ff9f1c';
        flame(ctx, fx, fy, w * 0.68, h * 0.72, lean * 0.7);
        ctx.fill();
        ctx.fillStyle = '#ffe45c';
        flame(ctx, fx, fy, w * 0.36, h * 0.42, lean * 0.4);
        ctx.fill();
      }
      break;
    }
    case 'electric': {
      if (z.tags.has('outlet')) return;
      const lift = z.attached && z.attached.kind === 'object' ? z.attached.body.z + 4 : z.attached ? 12 : 0;
      ctx.fillStyle = 'rgba(255, 221, 80, 0.14)';
      ctx.beginPath();
      ctx.ellipse(x, y - lift, r, r * 0.8, 0, 0, TAU);
      ctx.fill();
      const slice = Math.floor(time * 20);
      strokeBolts(ctx, () => {
        const bolts = z.tags.has('carried') ? 2 : 4;
        for (let i = 0; i < bolts; i++) {
          const a = hash(slice * 1.7 + i * 9.1 + seed) * TAU;
          const len = r * (0.55 + hash(slice + i * 3) * 0.5);
          lightning(ctx, x, y - lift, x + Math.cos(a) * len, y - lift + Math.sin(a) * len * 0.8, slice * 3 + i * 17);
        }
      });
      break;
    }
    case 'wind': {
      const lift = 12;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;
      const px = -z.dirY;
      const py = z.dirX;
      const start = z.offset - r;
      const span = r * 2;
      const ox = x - z.dirX * z.offset;
      const oy = y - z.dirY * z.offset;
      for (let i = 0; i < 6; i++) {
        const lane = (hash(seed + i * 4.7) - 0.5) * r * 0.9;
        const t = (time * (1.1 + hash(seed + i) * 0.6) + hash(seed * 2 + i)) % 1;
        const d0 = start + span * t;
        const d1 = d0 + 22;
        ctx.strokeStyle = `rgba(255,255,255,${(0.55 * Math.sin(t * Math.PI)).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(ox + z.dirX * d0 + px * lane, oy + z.dirY * d0 + py * lane - lift);
        ctx.lineTo(ox + z.dirX * d1 + px * lane, oy + z.dirY * d1 + py * lane - lift);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      break;
    }
    case 'flour': {
      // a slow, churning cloud you cannot see through
      const fade = Number.isFinite(z.ttl) ? Math.min(1, z.ttl / 1.6) : 1;
      const swell = Math.min(1, z.age / 0.35);
      for (let i = 0; i < 11; i++) {
        const a = hash(seed + i * 2.3) * TAU + time * (0.15 + hash(seed + i) * 0.2);
        const d = hash(seed * 3 + i * 1.7) * r * 0.62;
        const rr = (r * 0.24 + hash(seed + i * 4.1) * r * 0.22) * swell;
        ctx.globalAlpha = 0.34 * fade;
        ctx.fillStyle = i % 3 === 0 ? '#f3ecdb' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75 - 16, rr, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'feathers': {
      // the inside of a cushion, taking its time to come down
      const fade = Number.isFinite(z.ttl) ? Math.min(1, z.ttl / 1.4) : 1;
      const spread = Math.min(1, z.age / 0.3);
      ctx.strokeStyle = 'rgba(34, 27, 54, 0.35)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 22; i++) {
        const a = hash(seed + i * 2.3) * TAU + time * (0.2 + hash(seed + i) * 0.3);
        const d = hash(seed * 3 + i * 1.7) * r * 0.8 * spread;
        const drift = ((time * (0.25 + hash(seed + i * 5) * 0.2) + hash(seed + i * 9)) % 1) * 34;
        const fx = x + Math.cos(a) * d + Math.sin(time * 2 + i) * 4;
        const fy = y + Math.sin(a) * d * 0.75 - 34 + drift;
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = i % 4 === 0 ? '#f4efe2' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(fx, fy, 5, 1.9, a + time * 1.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'steam': {
      const fade = Number.isFinite(z.ttl) ? Math.min(1, z.ttl / 1.6) : 1;
      const swell = Math.min(1, z.age / 0.3);
      for (let i = 0; i < 10; i++) {
        const a = hash(seed + i * 2.9) * TAU + time * (0.2 + hash(seed + i) * 0.25);
        const d = hash(seed * 3 + i * 1.3) * r * 0.6;
        const rise = ((time * 0.3 + hash(seed + i * 7)) % 1) * 26;
        const rr = (r * 0.22 + hash(seed + i * 4.1) * r * 0.2) * swell;
        ctx.globalAlpha = 0.3 * fade;
        ctx.fillStyle = i % 3 === 0 ? '#e4f7fb' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75 - 14 - rise, rr, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    default:
      break;
  }
}
