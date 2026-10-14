import { FIXED_DT } from '../core/constants';
import type { GameEvent } from '../core/Events';
import type { InputFrame } from '../input/InputManager';

const SECONDS = 20;
const FIELDS = 6;
const CAPACITY = Math.ceil(SECONDS / FIXED_DT);

export interface Moment {
  readonly tick: number;
  readonly kind: string;
  readonly detail: string;
}

/**
 * Groundwork for "share your stupidest kill". Because the simulation is fixed-step and all
 * gameplay randomness comes from one seeded generator, (room seed + per-tick input) is enough
 * to re-simulate a clip. This class keeps the last 20 seconds of input in a ring buffer and a
 * short log of highlight moments; playback/export is intentionally not built yet.
 */
export class ReplayRecorder {
  seed = 0;
  roomId = '';
  startTick = 0;
  readonly moments: Moment[] = [];

  private readonly frames = new Float32Array(CAPACITY * FIELDS);
  private head = 0;
  private count = 0;
  private tick = 0;

  begin(roomId: string, seed: number): void {
    this.roomId = roomId;
    this.seed = seed;
    this.head = 0;
    this.count = 0;
    this.tick = 0;
    this.startTick = 0;
    this.moments.length = 0;
  }

  record(input: InputFrame): void {
    const o = this.head * FIELDS;
    const f = this.frames;
    f[o] = input.moveX;
    f[o + 1] = input.moveY;
    f[o + 2] = input.aimX;
    f[o + 3] = input.aimY;
    // Buttons packed as bit flags.
    f[o + 4] =
      (input.primaryDown ? 1 : 0) |
      (input.primaryPressed ? 2 : 0) |
      (input.primaryReleased ? 4 : 0) |
      (input.secondaryPressed ? 8 : 0) |
      (input.dodgePressed ? 16 : 0);
    f[o + 5] = this.tick;
    this.head = (this.head + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
    else this.startTick++;
    this.tick++;
  }

  /** Notes clip-worthy events so a future recorder knows where the highlights are. */
  observe(event: GameEvent): void {
    let detail = '';
    switch (event.type) {
      case 'CHAIN':
        detail = event.steps.join(' > ');
        break;
      case 'ENEMY_DEFEATED':
        detail = `${event.enemy.label} by ${event.cause.label}`;
        break;
      case 'EXPLOSION':
        detail = 'explosion';
        break;
      case 'DISCOVERY':
        detail = event.id;
        break;
      default:
        return;
    }
    this.moments.push({ tick: this.tick, kind: event.type, detail });
    if (this.moments.length > 40) this.moments.shift();
  }

  /** Snapshot a future ReplayManager could serialise and re-simulate. */
  snapshot(): { roomId: string; seed: number; startTick: number; frameCount: number; moments: readonly Moment[] } {
    return { roomId: this.roomId, seed: this.seed, startTick: this.startTick, frameCount: this.count, moments: this.moments };
  }
}
