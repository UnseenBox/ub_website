import { TAU, Rng } from '../core/Mathx';
import { VIEW } from '../core/Tuning';
import { PALETTE, circle, withAlpha, type Ctx } from '../rendering/DrawUtils';

export type ParticleKind = 'dust' | 'spark' | 'glass' | 'light' | 'motes';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  spin: number;
  alive: boolean;
}

/**
 * Pooled particles. The room is mostly empty and mostly still, so the budget is
 * small on purpose: floating motes to give the dark some depth, and short bursts
 * when something physical happens.
 */
export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private readonly active: Particle[] = [];
  private readonly rng = new Rng(0x5eed);
  private readonly motes: Particle[] = [];

  private static readonly MAX = 220;

  constructor() {
    for (let i = 0; i < ParticleSystem.MAX; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, kind: 'dust', spin: 0, alive: false,
      });
    }
    this.seedMotes();
  }

  private seedMotes(): void {
    this.motes.length = 0;
    for (let i = 0; i < 46; i++) {
      this.motes.push({
        x: this.rng.range(0, VIEW.width),
        y: this.rng.range(0, VIEW.height),
        vx: this.rng.range(-5, 5),
        vy: this.rng.range(-7, -1),
        life: 1,
        maxLife: 1,
        size: this.rng.range(0.5, 1.6),
        kind: 'motes',
        spin: this.rng.range(0, TAU),
        alive: true,
      });
    }
  }

  burst(x: number, y: number, count: number, kind: ParticleKind): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop();
      if (!p) return;
      const a = this.rng.next() * TAU;
      const speed =
        kind === 'glass' ? this.rng.range(60, 190) : kind === 'spark' ? this.rng.range(30, 110) : this.rng.range(8, 34);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = kind === 'dust' ? this.rng.range(0.6, 1.5) : this.rng.range(0.3, 0.9);
      p.life = p.maxLife;
      p.size = kind === 'glass' ? this.rng.range(1, 2.6) : this.rng.range(0.8, 2);
      p.kind = kind;
      p.spin = this.rng.range(0, TAU);
      p.alive = true;
      this.active.push(p);
    }
  }

  update(dt: number, airflow: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.kind === 'dust' ? 1.6 : 3.4;
      const damp = Math.exp(-drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      if (p.kind === 'glass') p.vy += 160 * dt;
    }

    // Motes drift forever; a running fan pushes them, which is a quiet tell.
    for (const m of this.motes) {
      m.x += (m.vx + airflow * 14) * dt;
      m.y += m.vy * dt;
      m.spin += dt * 0.6;
      if (m.y < -8) {
        m.y = VIEW.height + 6;
        m.x = this.rng.range(0, VIEW.width);
      }
      if (m.x < -8) m.x = VIEW.width + 6;
      if (m.x > VIEW.width + 8) m.x = -6;
    }
  }

  draw(ctx: Ctx): void {
    ctx.save();
    for (const m of this.motes) {
      const a = 0.06 + Math.sin(m.spin) * 0.04;
      ctx.fillStyle = withAlpha(PALETTE.fog, Math.max(0.015, a));
      circle(ctx, m.x, m.y, m.size);
      ctx.fill();
    }

    for (const p of this.active) {
      const t = p.life / p.maxLife;
      let color: string = PALETTE.fog;
      let alpha = t * 0.5;
      if (p.kind === 'glass') {
        color = PALETTE.cold;
        alpha = t * 0.85;
      } else if (p.kind === 'spark') {
        color = PALETTE.eye;
        alpha = t * 0.8;
      } else if (p.kind === 'light') {
        color = PALETTE.warm;
        alpha = t * 0.6;
      }
      ctx.fillStyle = withAlpha(color, alpha);
      circle(ctx, p.x, p.y, p.size * (0.5 + t * 0.6));
      ctx.fill();
    }
    ctx.restore();
  }

  reset(): void {
    for (const p of this.active) {
      p.alive = false;
      this.pool.push(p);
    }
    this.active.length = 0;
    this.seedMotes();
  }

  get count(): number {
    return this.active.length;
  }
}
