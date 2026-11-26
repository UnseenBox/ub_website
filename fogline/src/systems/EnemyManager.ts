import Phaser from 'phaser';
import { ENEMIES, EnemyDef, HitZone } from '../data/enemies';
import { FIELD } from '../game/config';
import { Zombie } from '../entities/Zombie';
import { audio } from '../audio/AudioManager';

export interface RayHit {
  zombie: Zombie;
  zone: HitZone;
}

/**
 * Owns the zombie pool: spawning, per-frame update, crowd separation and
 * spatial queries for hit resolution. Zombies are reused, never destroyed.
 */
export class EnemyManager {
  private pool: Zombie[] = [];
  readonly live: Zombie[] = [];
  private rng = Math.random;
  /** Called when a zombie's attack strike lands on the bunker. */
  onStrike: (z: Zombie) => void = () => {};
  /** Called when a zombie reaches the line for the first time. */
  onArrive: (z: Zombie) => void = () => {};
  /** Spitter/Howler actions: 'charge' (wind-up starts), 'spit', 'howl'. */
  onAction: (z: Zombie, action: 'charge' | 'spit' | 'howl') => void = () => {};
  /** Called when a corpse finishes fading and is returned to the pool. */
  onRecycle: (z: Zombie) => void = () => {};

  constructor(private readonly scene: Phaser.Scene, prewarm = 40) {
    for (let i = 0; i < prewarm; i++) this.pool.push(new Zombie(scene));
  }

  spawn(id: string, healthMul: number, speedMul: number, x?: number, z?: number): Zombie {
    const def: EnemyDef = ENEMIES[id];
    if (!def) throw new Error(`Unknown enemy ${id}`);
    const zb = this.pool.pop() ?? new Zombie(this.scene);
    // A Lurker comes up out of the mud close to the wire instead of walking in from the fog.
    const burrow = def.special?.burrow;
    const sx = x ?? (this.rng() * 2 - 1) * (burrow ? Math.min(10, FIELD.spawnHalfWidth) : FIELD.spawnHalfWidth);
    const sz = z ?? (burrow ? burrow.near + this.rng() * (burrow.far - burrow.near) : FIELD.spawnZ - this.rng() * 4);
    zb.reset(def, healthMul, speedMul, sx, sz, this.rng);
    this.live.push(zb);
    // A fat zombie (bloat body) is announced by its own groan as it comes out of the fog.
    // A group of them shares one cue, so the sound never stacks.
    if (def.rig === 'bloat') this.bigSpawnCue(sx);
    return zb;
  }

  private lastBigCue = -Infinity;

  private bigSpawnCue(x: number): void {
    const now = this.scene.time.now;
    if (now - this.lastBigCue < 1500) return;
    this.lastBigCue = now;
    audio.play('big_zombie_spawn', { volume: 0.6, pan: Math.max(-1, Math.min(1, x / FIELD.spawnHalfWidth)) * 0.6 });
  }

  get aliveCount(): number {
    let n = 0;
    for (const z of this.live) if (z.alive) n++;
    return n;
  }

  update(dt: number): void {
    // Separation: keep bodies from stacking on the same spot.
    const live = this.live;
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (!b.alive) continue;
        const dz = Math.abs(a.z - b.z);
        if (dz > 1.6) continue;
        const dx = b.x - a.x;
        const minGap = 0.75;
        if (Math.abs(dx) < minGap) {
          const push = (minGap - Math.abs(dx)) * 0.5 * Math.min(1, dt * 6) * (1 - dz / 1.6);
          const dir = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
          a.push(-dir * push);
          b.push(dir * push);
        }
      }
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const z = live[i];
      const wasAttacking = z.state === 'attack';
      const strike = z.update(dt);
      if (!wasAttacking && z.state === 'attack') this.onArrive(z);
      if (strike) this.onStrike(z);
      if (z.action) {
        this.onAction(z, z.action);
        z.action = null;
      }
      if (!z.active) {
        live.splice(i, 1);
        z.release();
        this.pool.push(z);
        this.onRecycle(z);
      }
    }
  }

  /** Nearest zombie under a screen point (closest to camera wins). */
  raycast(px: number, py: number): RayHit | null {
    let best: RayHit | null = null;
    let bestZ = Infinity;
    for (const z of this.live) {
      if (!z.alive || z.z >= bestZ) continue;
      const zone = z.hitTest(px, py);
      if (zone) {
        best = { zombie: z, zone };
        bestZ = z.z;
      }
    }
    return best;
  }

  /** Alive zombies within `radius` metres of a ground point. */
  inRadius(x: number, z: number, radius: number, out: { zombie: Zombie; dist: number }[] = []): { zombie: Zombie; dist: number }[] {
    out.length = 0;
    for (const zb of this.live) {
      if (!zb.alive) continue;
      const d = Math.hypot(zb.x - x, zb.z - z);
      if (d <= radius) out.push({ zombie: zb, dist: d });
    }
    return out;
  }

  /** Every alive zombie under a screen point, nearest first (for shots that go through). */
  raycastAll(px: number, py: number): RayHit[] {
    const out: RayHit[] = [];
    for (const z of this.live) {
      if (!z.alive) continue;
      const zone = z.hitTest(px, py);
      if (zone) out.push({ zombie: z, zone });
    }
    return out.sort((a, b) => a.zombie.z - b.zombie.z);
  }

  /** A Howler's scream: everyone alive within `radius` metres moves faster for a while. */
  hasteAround(x: number, z: number, radius: number, mul: number, seconds: number, except?: Zombie): number {
    let n = 0;
    for (const zb of this.live) {
      if (!zb.alive || zb === except || zb.def.special?.howl) continue;
      if (Math.hypot(zb.x - x, zb.z - z) <= radius) {
        zb.haste(mul, seconds);
        n++;
      }
    }
    return n;
  }

  /** The alive zombie closest to the bunker (for support targeting). */
  closest(): Zombie | null {
    let best: Zombie | null = null;
    for (const z of this.live) if (z.alive && (!best || z.z < best.z)) best = z;
    return best;
  }

  randomAlive(maxZ = Infinity): Zombie | null {
    const c = this.live.filter((z) => z.alive && z.z < maxZ);
    return c.length ? c[Math.floor(this.rng() * c.length)] : null;
  }

  clear(): void {
    for (const z of this.live) {
      z.release();
      this.pool.push(z);
    }
    this.live.length = 0;
  }
}
