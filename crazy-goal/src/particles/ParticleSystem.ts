import { easeOutCubic, TAU } from '../core/math';
import { C } from '../rendering/Palette';

const DUST = 0;
const SPARK = 1;
const CHIP = 2;
const SHARD = 3;

interface Particle {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
}

interface Flash {
  active: boolean;
  rays: boolean;
  x: number;
  y: number;
  t: number;
  dur: number;
  size: number;
  rot: number;
  color: string;
}

const POOL = 460;
const FLASHES = 24;
const CONFETTI = [C.sun, C.blue, C.white, C.terra, C.blueLite] as const;
const EMBERS = [C.sun, C.orange, '#e2472b'] as const;
const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/** Pooled particles and one-shot impact flashes. Nothing here allocates after start-up. */
export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private readonly flashes: Flash[] = [];
  private cursor = 0;
  private flashCursor = 0;
  /** Reduced effects: fewer particles, no impact rays. */
  reduced = false;
  active = 0;

  constructor() {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({ active: false, kind: DUST, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0, maxLife: 1, size: 1, rot: 0, spin: 0, color: C.white });
    }
    for (let i = 0; i < FLASHES; i++) {
      this.flashes.push({ active: false, rays: false, x: 0, y: 0, t: 0, dur: 1, size: 1, rot: 0, color: C.white });
    }
  }

  private take(): Particle {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    p.active = true;
    p.gravity = 0;
    p.rot = 0;
    p.spin = 0;
    return p;
  }

  private count(n: number): number {
    return Math.max(1, Math.round(this.reduced ? n * 0.4 : n));
  }

  /** Soft puffs thrown off a surface along its normal. */
  dust(x: number, y: number, nx: number, ny: number, amount: number, color: string = C.white): void {
    const n = this.count(amount);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const along = rand(30, 190);
      const across = rand(-170, 170);
      p.kind = DUST;
      p.x = x + rand(-4, 4);
      p.y = y + rand(-4, 4);
      p.vx = nx * along - ny * across;
      p.vy = ny * along + nx * across;
      p.drag = 4.5;
      p.life = p.maxLife = rand(0.3, 0.6);
      p.size = rand(4, 9);
      p.color = color;
    }
  }

  /** Fast streaks for hard hits. */
  sparks(x: number, y: number, nx: number, ny: number, amount: number, color: string): void {
    const n = this.count(amount);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const along = rand(180, 620);
      const across = rand(-420, 420);
      p.kind = SPARK;
      p.x = x;
      p.y = y;
      p.vx = nx * along - ny * across;
      p.vy = ny * along + nx * across;
      p.drag = 5.5;
      p.life = p.maxLife = rand(0.14, 0.32);
      p.size = rand(2.5, 4.5);
      p.color = color;
    }
  }

  /** Tumbling paper chips thrown in a cone, then drifting down the screen. `tint` throws them all in one colour. */
  confetti(x: number, y: number, dirX: number, dirY: number, amount: number, speed: number, tint?: string): void {
    const n = this.count(amount);
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const a = base + rand(-0.75, 0.75);
      const v = speed * rand(0.35, 1);
      p.kind = CHIP;
      p.x = x + rand(-8, 8);
      p.y = y + rand(-8, 8);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 2.4;
      p.gravity = 520;
      p.life = p.maxLife = rand(0.9, 1.7);
      p.size = rand(6, 12);
      p.rot = rand(0, TAU);
      p.spin = rand(-9, 9);
      p.color = tint ?? CONFETTI[(Math.random() * CONFETTI.length) | 0];
    }
  }

  /** Embers off a burning ball: small and bright, drifting up the screen as they die. */
  embers(x: number, y: number, dirX: number, dirY: number, amount: number): void {
    const n = this.count(amount);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const v = rand(40, 240);
      p.kind = DUST;
      p.x = x + rand(-9, 9);
      p.y = y + rand(-9, 9);
      p.vx = dirX * v + rand(-80, 80);
      p.vy = dirY * v + rand(-80, 80) - 30;
      p.gravity = -170;
      p.drag = 3;
      p.life = p.maxLife = rand(0.25, 0.6);
      p.size = rand(2.5, 5.5);
      p.color = EMBERS[(Math.random() * EMBERS.length) | 0];
    }
  }

  /** Bits of whatever a burning ball went through, thrown the way it was going. */
  debris(x: number, y: number, dirX: number, dirY: number, amount: number, color: string): void {
    const n = this.count(amount);
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const a = base + rand(-1.5, 1.5);
      const v = rand(160, 780);
      p.kind = CHIP;
      p.x = x + rand(-30, 30);
      p.y = y + rand(-16, 16);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 2.8;
      p.gravity = 380;
      p.life = p.maxLife = rand(0.6, 1.2);
      p.size = rand(7, 15);
      p.rot = rand(0, TAU);
      p.spin = rand(-12, 12);
      p.color = Math.random() < 0.75 ? color : C.navy;
    }
  }

  /** Broken glass, flung mostly the way the ball was going. */
  shards(x: number, y: number, dirX: number, dirY: number, amount: number): void {
    const n = this.count(amount);
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < n; i++) {
      const p = this.take();
      const a = base + rand(-1.2, 1.2);
      const v = rand(120, 760);
      p.kind = SHARD;
      p.x = x + rand(-40, 40);
      p.y = y + rand(-8, 8);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 3.4;
      p.life = p.maxLife = rand(0.5, 1.1);
      p.size = rand(5, 13);
      p.rot = rand(0, TAU);
      p.spin = rand(-14, 14);
      p.color = Math.random() < 0.5 ? C.water : C.white;
    }
  }

  ring(x: number, y: number, size: number, color: string, dur = 0.34): void {
    this.flash(false, x, y, size, color, dur);
  }

  /** A burst of short rays at the point of a hard impact. */
  rays(x: number, y: number, size: number, color: string): void {
    if (this.reduced) return;
    this.flash(true, x, y, size, color, 0.22);
  }

  private flash(rays: boolean, x: number, y: number, size: number, color: string, dur: number): void {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % FLASHES;
    f.active = true;
    f.rays = rays;
    f.x = x;
    f.y = y;
    f.t = 0;
    f.dur = dur;
    f.size = size;
    f.rot = rand(0, TAU);
    f.color = color;
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      alive++;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    this.active = alive;
    for (let i = 0; i < FLASHES; i++) {
      const f = this.flashes[i];
      if (!f.active) continue;
      f.t += dt;
      if (f.t >= f.dur) f.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const f = p.life / p.maxLife;
      if (p.kind === DUST) {
        ctx.globalAlpha = f * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.7 - f * 0.7), 0, TAU);
        ctx.fill();
      } else if (p.kind === SPARK) {
        ctx.globalAlpha = Math.min(1, f * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * f + 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.kind === CHIP) {
        // A chip seen edge-on is thin: scaling one axis by a cosine fakes the tumble.
        const flip = Math.cos(p.rot * 1.7);
        ctx.globalAlpha = Math.min(1, f * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.32 * flip, p.size, p.size * 0.64 * flip);
        ctx.restore();
      } else {
        ctx.globalAlpha = Math.min(0.85, f * 2.5);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, p.size * 0.3);
        ctx.lineTo(p.size * 0.5, p.size * 0.1);
        ctx.lineTo(-p.size * 0.1, -p.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < FLASHES; i++) {
      const f = this.flashes[i];
      if (!f.active) continue;
      const t = f.t / f.dur;
      ctx.strokeStyle = f.color;
      if (f.rays) {
        // Rays shoot outwards and thin as they go.
        const inner = f.size * (0.25 + 0.55 * easeOutCubic(t));
        const outer = f.size * (0.45 + 0.75 * easeOutCubic(t));
        ctx.globalAlpha = 1 - t * t;
        ctx.lineWidth = 5 * (1 - t) + 1;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = f.rot + (k * TAU) / 8;
          const reach = k % 2 === 0 ? outer : outer * 0.78;
          ctx.moveTo(f.x + Math.cos(a) * inner, f.y + Math.sin(a) * inner);
          ctx.lineTo(f.x + Math.cos(a) * reach, f.y + Math.sin(a) * reach);
        }
        ctx.stroke();
      } else {
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * (0.25 + 0.75 * easeOutCubic(t)), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
