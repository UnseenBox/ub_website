import { TAU, clamp01 } from '../core/Mathx';
import { Rng } from '../core/Mathx';
import type { AttentionSource } from '../stealth/AttentionSystem';

export type DecoyPattern = 'STATIC' | 'MOVING' | 'RANDOM' | 'CLICKING' | 'AGGRESSIVE';

export interface DecoySpec {
  pattern: DecoyPattern;
  x: number;
  y: number;
  duration: number;
  /** 0..1. How convincing it is to an enemy that cannot tell real from fake. */
  potency: number;
  /** Repeating noise the decoy emits, in design units. 0 for a silent decoy. */
  noise: number;
  /** Radius of its movement, for the patterns that move. */
  radius: number;
  /** Optional waypoint path for a scripted decoy. */
  path?: readonly { x: number; y: number }[];
  sourceId: string | null;
}

/**
 * A machine echo: a screaming projector, terminal, or mirror shard.
 *
 * It satisfies the same AttentionSource interface as the player's body,
 * which is the whole trick: an enemy that does not check `isReal` cannot tell
 * the difference, and one that does check is immune. No special-casing anywhere else.
 */
export class CursorDecoy implements AttentionSource {
  readonly id: string;
  readonly isReal = false;

  x: number;
  y: number;
  speed = 0;
  headingX = 0;
  headingY = -1;
  movementIntensity = 0;
  dwellTime = 0;
  visibility = 1;
  noiseLevel = 0;
  potency: number;

  readonly pattern: DecoyPattern;
  readonly duration: number;
  readonly sourceId: string | null;

  age = 0;
  dead = false;
  /** Set on the frames the decoy "clicks", so the room can emit a noise. */
  clickedThisStep = false;

  private readonly originX: number;
  private readonly originY: number;
  private readonly radius: number;
  private readonly baseNoise: number;
  private readonly rng: Rng;
  private readonly path: readonly { x: number; y: number }[] | undefined;
  private phase: number;
  private clickTimer: number;
  private wanderX = 0;
  private wanderY = 0;
  private wanderTimer = 0;

  private static nextId = 0;

  constructor(spec: DecoySpec, seed: number) {
    this.id = `decoy-${CursorDecoy.nextId++}`;
    this.pattern = spec.pattern;
    this.x = spec.x;
    this.y = spec.y;
    this.originX = spec.x;
    this.originY = spec.y;
    this.duration = spec.duration;
    this.potency = spec.potency;
    this.radius = spec.radius;
    this.baseNoise = spec.noise;
    this.path = spec.path;
    this.sourceId = spec.sourceId;
    this.rng = new Rng(seed ^ 0x9e3779b9);
    this.phase = this.rng.next() * TAU;
    this.clickTimer = this.rng.range(0.6, 1.4);
  }

  update(dt: number, lightAt: (x: number, y: number) => number): void {
    this.age += dt;
    this.clickedThisStep = false;
    if (this.age >= this.duration) {
      this.dead = true;
      return;
    }

    const px = this.x;
    const py = this.y;

    switch (this.pattern) {
      case 'STATIC': {
        // Breathes very slightly so it does not read as a dead pixel.
        this.phase += dt * 1.1;
        this.x = this.originX + Math.cos(this.phase) * 1.6;
        this.y = this.originY + Math.sin(this.phase * 0.7) * 1.6;
        break;
      }
      case 'MOVING': {
        if (this.path && this.path.length > 1) {
          const total = this.path.length;
          const t = (this.age / this.duration) * (total - 1);
          const i = Math.min(total - 2, Math.floor(t));
          const f = t - i;
          const a = this.path[i];
          const b = this.path[i + 1];
          this.x = a.x + (b.x - a.x) * f;
          this.y = a.y + (b.y - a.y) * f;
        } else {
          this.phase += dt * 1.25;
          this.x = this.originX + Math.cos(this.phase) * this.radius;
          this.y = this.originY + Math.sin(this.phase * 1.3) * this.radius * 0.6;
        }
        break;
      }
      case 'RANDOM': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = this.rng.range(0.18, 0.55);
          const a = this.rng.next() * TAU;
          const r = this.rng.range(0.4, 1) * this.radius;
          this.wanderX = this.originX + Math.cos(a) * r;
          this.wanderY = this.originY + Math.sin(a) * r * 0.7;
        }
        this.x += (this.wanderX - this.x) * Math.min(1, dt * 7);
        this.y += (this.wanderY - this.y) * Math.min(1, dt * 7);
        break;
      }
      case 'CLICKING': {
        this.phase += dt * 0.6;
        this.x = this.originX + Math.cos(this.phase) * this.radius * 0.35;
        this.y = this.originY + Math.sin(this.phase) * this.radius * 0.2;
        this.clickTimer -= dt;
        if (this.clickTimer <= 0) {
          this.clickTimer = this.rng.range(0.7, 1.6);
          this.clickedThisStep = true;
        }
        break;
      }
      case 'AGGRESSIVE': {
        // Darts in straight bursts, the way a panicking player moves. Loud.
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = this.rng.range(0.3, 0.7);
          const a = this.rng.next() * TAU;
          this.wanderX = this.originX + Math.cos(a) * this.radius;
          this.wanderY = this.originY + Math.sin(a) * this.radius * 0.8;
        }
        this.x += (this.wanderX - this.x) * Math.min(1, dt * 14);
        this.y += (this.wanderY - this.y) * Math.min(1, dt * 14);
        break;
      }
    }

    const dx = this.x - px;
    const dy = this.y - py;
    this.speed = Math.hypot(dx, dy) / dt;
    if (this.speed > 4) {
      const inv = 1 / Math.hypot(dx, dy);
      this.headingX = dx * inv;
      this.headingY = dy * inv;
      this.dwellTime = 0;
    } else {
      this.dwellTime += dt;
    }
    this.movementIntensity = clamp01(this.speed / 900);
    this.visibility = 0.45 + 0.55 * clamp01(lightAt(this.x, this.y));
    this.noiseLevel = this.clickedThisStep ? this.baseNoise : Math.max(0, this.noiseLevel - dt * 3);
  }

  /** 0..1 fade used by the renderer at the start and end of the decoy's life. */
  get fade(): number {
    const inRamp = clamp01(this.age / 0.25);
    const outRamp = clamp01((this.duration - this.age) / 0.45);
    return Math.min(inRamp, outRamp);
  }
}
