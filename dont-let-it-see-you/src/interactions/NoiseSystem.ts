import type { EventBus } from '../core/EventBus';
import type { NoiseEvent, NoiseKind } from '../core/Events';

export interface NoiseRipple {
  x: number;
  y: number;
  level: number;
  kind: NoiseKind;
  /** Seconds since it happened, used for the expanding ring and for debug. */
  age: number;
  byPlayer: boolean;
}

/**
 * Sound as a gameplay object.
 *
 * A click is not UI here: it is a disturbance at a position with a loudness, and
 * creatures decide for themselves whether it was worth turning around for. The
 * system queues events so that every creature in a step hears the same world.
 */
export class NoiseSystem {
  private readonly queue: NoiseEvent[] = [];
  readonly ripples: NoiseRipple[] = [];
  /** Loudest player-made noise this attempt, for the "silent run" bonus. */
  loudestByPlayer = 0;
  totalPlayerNoise = 0;

  private static readonly RIPPLE_LIFETIME = 1.1;

  constructor(private readonly bus: EventBus) {}

  emit(x: number, y: number, level: number, kind: NoiseKind, byPlayer: boolean): void {
    if (level <= 0) return;
    const ev: NoiseEvent = { x, y, level, kind, byPlayer };
    this.queue.push(ev);
    this.ripples.push({ x, y, level, kind, age: 0, byPlayer });
    if (this.ripples.length > 40) this.ripples.shift();
    if (byPlayer) {
      this.loudestByPlayer = Math.max(this.loudestByPlayer, level);
      this.totalPlayerNoise += level;
    }
    this.bus.emit('NOISE_CREATED', ev);
  }

  /** Hand the step's noises to whoever can hear them, then clear. */
  drain(): NoiseEvent[] {
    if (this.queue.length === 0) return EMPTY;
    return this.queue.splice(0, this.queue.length);
  }

  update(dt: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      if (r.age > NoiseSystem.RIPPLE_LIFETIME) this.ripples.splice(i, 1);
    }
  }

  reset(): void {
    this.queue.length = 0;
    this.ripples.length = 0;
    this.loudestByPlayer = 0;
    this.totalPlayerNoise = 0;
  }
}

const EMPTY: NoiseEvent[] = [];
