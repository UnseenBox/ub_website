import { randRange, TAU } from '../util/math';

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatText {
  alive: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  /** Font size in CSS pixels. Big texts pop in with a quick overshoot. */
  size: number;
}

/** A column of light where an enemy beams in. */
export interface Beam {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

/** An expanding ring of light, used for KOs. */
export interface Shockwave {
  x: number;
  y: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

const PARTICLE_POOL = 520;
const TEXT_POOL = 24;
const GRAVITY = 9.8;

/**
 * Object pools for splatter droplets and floating text. Pooled so that
 * frequent slime hits never allocate. Purely visual: nothing here affects physics.
 */
export class Effects {
  readonly particles: Particle[] = [];
  readonly texts: FloatText[] = [];
  readonly shockwaves: Shockwave[] = [];
  readonly beams: Beam[] = [];
  /** Full-screen flash strength, 0..1. It fades quickly. */
  screenFlash = 0;
  private nextParticle = 0;
  private nextText = 0;

  constructor() {
    for (let i = 0; i < PARTICLE_POOL; i++) {
      this.particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0.05, color: '#fff' });
    }
    for (let i = 0; i < TEXT_POOL; i++) {
      this.texts.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 18 });
    }
  }

  private acquire(): Particle {
    const p = this.particles[this.nextParticle];
    this.nextParticle = (this.nextParticle + 1) % PARTICLE_POOL;
    return p;
  }

  /** Droplets flung out from a point. (nx, ny) biases the spray direction. */
  burst(x: number, y: number, color: string, count: number, speed: number, nx = 0, ny = 1): void {
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const a = base + randRange(-1.1, 1.1);
      const s = speed * randRange(0.45, 1.1);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = randRange(0.45, 0.9);
      p.life = p.maxLife;
      p.size = randRange(0.03, 0.09);
      p.color = color;
    }
  }

  /** A short ring of sparkle at a point, used for impacts. */
  ring(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const a = (i / count) * TAU;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * 1.8;
      p.vy = Math.sin(a) * 1.8;
      p.maxLife = 0.3;
      p.life = 0.3;
      p.size = 0.05;
      p.color = color;
    }
  }

  text(x: number, y: number, text: string, color: string, size = 18): void {
    const t = this.texts[this.nextText];
    this.nextText = (this.nextText + 1) % TEXT_POOL;
    t.alive = true;
    t.x = x;
    t.y = y;
    t.text = text;
    t.color = color;
    t.size = size;
    t.maxLife = size > 24 ? 1.3 : 0.9;
    t.life = t.maxLife;
  }

  /** Heavy slime chunks: bigger, slower and longer-lived than burst droplets. */
  splatter(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const a = randRange(0, TAU);
      const s = speed * randRange(0.35, 1);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s + speed * 0.35;
      p.maxLife = randRange(0.8, 1.4);
      p.life = p.maxLife;
      p.size = randRange(0.09, 0.2);
      p.color = color;
    }
  }

  shockwave(x: number, y: number, color: string, maxR: number, life = 0.45): void {
    this.shockwaves.push({ x, y, maxR, life, maxLife: life, color });
  }

  /** A light column from the ground up, with sparks rising inside it. */
  beam(x: number, y: number, color: string, life = 0.7): void {
    this.beams.push({ x, y, life, maxLife: life, color });
    for (let i = 0; i < 18; i++) {
      const p = this.acquire();
      p.alive = true;
      p.x = x + randRange(-0.35, 0.35);
      p.y = y + randRange(0, 2.2);
      p.vx = randRange(-0.3, 0.3);
      p.vy = randRange(4, 9);
      p.maxLife = randRange(0.4, 0.8);
      p.life = p.maxLife;
      p.size = randRange(0.03, 0.07);
      p.color = color;
    }
  }

  flash(strength: number): void {
    this.screenFlash = Math.max(this.screenFlash, strength);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const t of this.texts) {
      if (!t.alive) continue;
      t.life -= dt;
      t.y += 0.9 * dt;
      if (t.life <= 0) t.alive = false;
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.life -= dt;
      if (w.life <= 0) this.shockwaves.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }
    this.screenFlash = Math.max(0, this.screenFlash - dt * 3.5);
  }

  clear(): void {
    for (const p of this.particles) p.alive = false;
    for (const t of this.texts) t.alive = false;
    this.shockwaves.length = 0;
    this.beams.length = 0;
    this.screenFlash = 0;
  }
}
