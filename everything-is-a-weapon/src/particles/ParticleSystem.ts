export type ParticleKind =
  | 'spark' | 'dust' | 'smoke' | 'steam' | 'ember' | 'ash'
  | 'splinter' | 'shard' | 'chip' | 'scrap' | 'water' | 'foam' | 'dirt' | 'star' | 'confetti'
  | 'feather' | 'flour' | 'peanut' | 'paint' | 'bubble' | 'note' | 'sparkle' | 'blast' | 'shock' | 'glint';

export type ParticleShape = 'circle' | 'rect' | 'tri' | 'line' | 'star' | 'streak' | 'puff' | 'shock' | 'glow';

interface Preset {
  readonly colors: readonly string[];
  readonly shape: ParticleShape;
  readonly size: readonly [number, number];
  readonly life: readonly [number, number];
  readonly drag: number;
  /** Positive values pull particles down the screen, which reads as "falling" in this view. */
  readonly gravity: number;
  /** Size multiplier reached at end of life. */
  readonly grow: number;
  readonly alpha: number;
  /** Optional orbital drift in radians/second: curves the flight path into a spiral. */
  readonly swirl?: readonly [number, number];
  /** Optional stagger window in seconds: particles in one burst wake up one after another. */
  readonly delay?: number;
}

const PRESETS: Readonly<Record<ParticleKind, Preset>> = {
  spark: { colors: ['#ffd23f', '#fff7c2', '#ffffff'], shape: 'line', size: [2, 4], life: [0.12, 0.35], drag: 4, gravity: 300, grow: 0.3, alpha: 1 },
  dust: { colors: ['#d8c7a0', '#c9b68c', '#efe3c5'], shape: 'circle', size: [3, 7], life: [0.3, 0.6], drag: 5, gravity: -20, grow: 1.8, alpha: 0.55 },
  smoke: { colors: ['#4a4458', '#6a637a', '#3a3547'], shape: 'circle', size: [6, 12], life: [0.7, 1.3], drag: 2, gravity: -70, grow: 2.2, alpha: 0.4 },
  steam: { colors: ['#ffffff', '#e4f7fb'], shape: 'circle', size: [6, 11], life: [0.5, 1], drag: 2.5, gravity: -90, grow: 2.4, alpha: 0.5 },
  ember: { colors: ['#ff8a3d', '#ffd23f', '#ff5a4e'], shape: 'circle', size: [1.5, 3.5], life: [0.4, 0.9], drag: 1.5, gravity: -140, grow: 0.2, alpha: 1 },
  ash: { colors: ['#3a3547', '#544d63', '#221b36'], shape: 'rect', size: [2, 5], life: [0.6, 1.2], drag: 3, gravity: 40, grow: 0.6, alpha: 0.9 },
  splinter: { colors: ['#c98a4b', '#8f5a2c', '#e0a868'], shape: 'rect', size: [3, 8], life: [0.35, 0.7], drag: 3.5, gravity: 260, grow: 0.8, alpha: 1 },
  shard: { colors: ['#c9f5e8', '#8fe3c8', '#ffffff'], shape: 'tri', size: [3, 7], life: [0.4, 0.8], drag: 3, gravity: 280, grow: 0.8, alpha: 0.95 },
  chip: { colors: ['#e8e4f0', '#a9a3bd', '#ff7b54'], shape: 'rect', size: [2, 5], life: [0.3, 0.6], drag: 4, gravity: 240, grow: 0.7, alpha: 1 },
  scrap: { colors: ['#f4efe2', '#ffffff', '#c9c1ab'], shape: 'rect', size: [3, 6], life: [0.5, 1], drag: 5, gravity: 60, grow: 1, alpha: 1 },
  water: { colors: ['#4ad6e8', '#9cecf5', '#ffffff'], shape: 'circle', size: [2, 5], life: [0.3, 0.6], drag: 3, gravity: 320, grow: 0.5, alpha: 0.9 },
  foam: { colors: ['#ffffff', '#f1fbff', '#dcefff'], shape: 'circle', size: [4, 9], life: [0.5, 1], drag: 4.5, gravity: -10, grow: 1.5, alpha: 0.85 },
  dirt: { colors: ['#6b4a2f', '#8a623f', '#4d3320'], shape: 'circle', size: [2, 5], life: [0.35, 0.7], drag: 4, gravity: 260, grow: 0.8, alpha: 1 },
  confetti: { colors: ['#ff5a4e', '#ffd23f', '#4ad6e8', '#9be564', '#a48cf2', '#ffffff'], shape: 'rect', size: [3, 5.5], life: [0.7, 1.3], drag: 3.2, gravity: 190, grow: 1, alpha: 1 },
  feather: { colors: ['#ffffff', '#f4efe2', '#e8e4f0'], shape: 'rect', size: [3, 6], life: [0.9, 1.7], drag: 4.5, gravity: 34, grow: 1, alpha: 0.95 },
  flour: { colors: ['#ffffff', '#f6f1e4'], shape: 'circle', size: [7, 14], life: [0.8, 1.6], drag: 3, gravity: -18, grow: 2.2, alpha: 0.5 },
  peanut: { colors: ['#fbf3ea', '#ffe3ec', '#e9f5ff'], shape: 'rect', size: [2.5, 4.5], life: [0.7, 1.4], drag: 3.4, gravity: 170, grow: 1, alpha: 1 },
  paint: { colors: ['#ff5a8a', '#4ad6e8', '#ffd23f', '#9be564'], shape: 'circle', size: [2.5, 6], life: [0.35, 0.7], drag: 3, gravity: 300, grow: 0.6, alpha: 1 },
  bubble: { colors: ['rgba(255,255,255,0.85)', 'rgba(220,245,255,0.8)'], shape: 'circle', size: [2, 5], life: [0.6, 1.2], drag: 2.5, gravity: -60, grow: 1.3, alpha: 0.8 },
  note: { colors: ['#a48cf2', '#ff5a8a', '#4ad6e8', '#ffd23f'], shape: 'star', size: [4, 6], life: [0.8, 1.3], drag: 2, gravity: -40, grow: 1, alpha: 1 },
  // Hit sparks: short red-orange streaks with hot tips. Thin, fast and numerous,
  // so they read as a shower of embers rather than a handful of solid shapes.
  sparkle: {
    colors: ['#ff3b30', '#ff2d2d', '#e11d2e', '#ff5a3c', '#ff7a4a', '#c0121f'],
    shape: 'streak', size: [3.5, 6.5], life: [0.35, 0.7], drag: 2.6, gravity: -28, grow: 0.7, alpha: 1,
    swirl: [1.8, 3.4], delay: 0.03,
  },
  // Translucent red smoke behind the sparks: body, not another hard shape.
  blast: {
    colors: ['#e11d2e', '#c0121f', '#ff3b30'],
    shape: 'puff', size: [10, 16], life: [0.45, 0.8], drag: 2.6, gravity: -24, grow: 1.5, alpha: 0.45,
    swirl: [1.2, 2.4], delay: 0.05,
  },
  // A screen-space shockwave: grows fast, fades as it expands.
  shock: { colors: ['#ff3b30'], shape: 'shock', size: [11, 15], life: [0.36, 0.46], drag: 0, gravity: 0, grow: 5.6, alpha: 1 },
  // The impact flare: a brief red-orange pop that swells and vanishes.
  glint: { colors: ['#ff8a5c', '#ff2d2d', '#b3121f'], shape: 'glow', size: [8, 11], life: [0.16, 0.28], drag: 6, gravity: 0, grow: 2.0, alpha: 0.7 },
  star: { colors: ['#ffd23f', '#ffffff', '#ff5a4e'], shape: 'star', size: [4, 8], life: [0.35, 0.7], drag: 4, gravity: 0, grow: 0.3, alpha: 1 },
};

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  shape: ParticleShape;
  drag: number;
  gravity: number;
  grow: number;
  alpha: number;
  /** Seconds left before this particle wakes up (staggered bursts). */
  delay: number;
  /** Orbital velocity in radians/second; curves the flight path. */
  swirl: number;
  /** Twinkle phase seed, so simultaneous particles do not pulse in lockstep. */
  phase: number;
}

export interface BurstOptions {
  dirX?: number;
  dirY?: number;
  /** Half-angle of the emission cone in radians (default: full circle). */
  spread?: number;
  color?: string;
}

/** Comfortably above the busiest moments (massive hits, broken glass, a boss dying). */
const POOL_SIZE = 1400;

/** Fixed-size pooled particle system. Nothing is allocated after construction. */
export class ParticleSystem {
  readonly pool: Particle[] = [];
  activeCount = 0;
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, rotation: 0, spin: 0,
        color: '#fff', shape: 'circle', drag: 0, gravity: 0, grow: 1, alpha: 1, delay: 0, swirl: 0, phase: 0,
      });
    }
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.activeCount = 0;
  }

  burst(kind: ParticleKind, x: number, y: number, count: number, speed: number, options?: BurstOptions): void {
    const preset = PRESETS[kind];
    const cone = options?.spread !== undefined;
    const base = cone ? Math.atan2(options?.dirY ?? 0, options?.dirX ?? 1) : 0;
    const spread = options?.spread ?? Math.PI;
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = base + (Math.random() * 2 - 1) * spread;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      this.apply(preset, p, options?.color);
    }
  }

  /**
   * Emits `count` particles evenly around a circle, flying outward: the starburst ring
   * that pops around an impact point. The ring starts clear of whatever sprite or text
   * sits on the contact, so the burst stays readable.
   */
  ringBurst(kind: ParticleKind, x: number, y: number, count: number, speed: number, radius: number, options?: BurstOptions): void {
    const preset = PRESETS[kind];
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4 + (options ? Math.atan2(options.dirY ?? 0, options.dirX ?? 1) : 0);
      const r = radius * (0.8 + Math.random() * 0.45);
      const v = speed * (0.6 + Math.random() * 0.55);
      p.active = true;
      p.x = x + Math.cos(angle) * r;
      p.y = y + Math.sin(angle) * r * 0.8;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v * 0.8;
      this.apply(preset, p, options?.color);
      // A ring is a shape: keep it synchronized instead of waking petal by petal.
      p.delay = 0;
    }
  }

  /** Copies a preset's look onto a particle, keeping per-particle randomness. */
  private apply(preset: Preset, p: Particle, color?: string): void {
    p.maxLife = p.life = preset.life[0] + Math.random() * (preset.life[1] - preset.life[0]);
    p.size = preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]);
    p.rotation = Math.random() * Math.PI * 2;
    p.spin = (Math.random() - 0.5) * 14;
    p.color = color ?? preset.colors[Math.floor(Math.random() * preset.colors.length)]!;
    p.shape = preset.shape;
    p.drag = preset.drag;
    p.gravity = preset.gravity;
    p.grow = preset.grow;
    p.alpha = preset.alpha;
    p.swirl = preset.swirl ? (preset.swirl[0] + Math.random() * (preset.swirl[1] - preset.swirl[0])) * (Math.random() < 0.5 ? -1 : 1) : 0;
    p.delay = preset.delay ? Math.random() * preset.delay : 0;
    p.phase = Math.random() * Math.PI * 2;
  }

  /** Round-robin reuse: when the pool is full the oldest particles are recycled first. */
  private acquire(): Particle {
    for (let i = 0; i < POOL_SIZE; i++) {
      const index = (this.cursor + i) % POOL_SIZE;
      const p = this.pool[index]!;
      if (!p.active) {
        this.cursor = (index + 1) % POOL_SIZE;
        return p;
      }
    }
    const p = this.pool[this.cursor]!;
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    return p;
  }

  update(dt: number): void {
    let active = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i]!;
      if (!p.active) continue;
      if (p.delay > 0) {
        // Staggered wake-up: the particle hangs invisible for a beat, then pops.
        p.delay -= dt;
        active++;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy = p.vy * damping + p.gravity * dt;
      if (p.swirl !== 0) {
        // Rotate the velocity a little each step: the flight path becomes an arc.
        const a = p.swirl * dt;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const vx = p.vx * cos - p.vy * sin;
        p.vy = p.vx * sin + p.vy * cos;
        p.vx = vx;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      active++;
    }
    this.activeCount = active;
  }
}
