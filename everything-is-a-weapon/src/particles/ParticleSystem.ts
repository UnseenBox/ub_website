export type ParticleKind =
  | 'spark' | 'dust' | 'smoke' | 'steam' | 'ember' | 'ash'
  | 'splinter' | 'shard' | 'chip' | 'scrap' | 'water' | 'foam' | 'dirt' | 'star' | 'confetti'
  | 'feather' | 'flour' | 'peanut' | 'paint' | 'bubble' | 'note';

export type ParticleShape = 'circle' | 'rect' | 'tri' | 'line' | 'star';

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
}

export interface BurstOptions {
  dirX?: number;
  dirY?: number;
  /** Half-angle of the emission cone in radians (default: full circle). */
  spread?: number;
  color?: string;
}

const POOL_SIZE = 700;

/** Fixed-size pooled particle system. Nothing is allocated after construction. */
export class ParticleSystem {
  readonly pool: Particle[] = [];
  activeCount = 0;
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, rotation: 0, spin: 0,
        color: '#fff', shape: 'circle', drag: 0, gravity: 0, grow: 1, alpha: 1,
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
      p.maxLife = p.life = preset.life[0] + Math.random() * (preset.life[1] - preset.life[0]);
      p.size = preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]);
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 14;
      p.color = options?.color ?? preset.colors[Math.floor(Math.random() * preset.colors.length)]!;
      p.shape = preset.shape;
      p.drag = preset.drag;
      p.gravity = preset.gravity;
      p.grow = preset.grow;
      p.alpha = preset.alpha;
    }
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
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy = p.vy * damping + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      active++;
    }
    this.activeCount = active;
  }
}
