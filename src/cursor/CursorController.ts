import { AWARENESS } from '../core/Tuning';
import { approach, clamp01 } from '../core/Mathx';
import type { EventBus } from '../core/EventBus';
import type { PointerState } from '../input/InputManager';
import type { AttentionSystem } from '../stealth/AttentionSystem';
import { CursorDecoy, type DecoySpec } from './CursorDecoy';
import { CursorSensor } from './CursorSensor';
import type { CursorStateName } from './CursorState';
import { CursorTrail } from './CursorTrail';

/**
 * Owns the aim reticle: the sensor that tracks the mouse, the trail it leaves,
 * the machine echoes that share its registry, and the reticle state rendered
 * from room heat. Nothing hunts the mouse — it aims the flashlight and throws.
 */
export class CursorController {
  readonly sensor = new CursorSensor();
  readonly trail = new CursorTrail();
  readonly decoys: CursorDecoy[] = [];

  state: CursorStateName = 'NORMAL';
  /** 0..1+ worst awareness any enemy currently holds. Drives reticle feedback. */
  heat = 0;
  /** Smoothed heat, so the reticle pulse does not stutter. */
  displayHeat = 0;
  /** True while at least one enemy has your body inside its awareness radius. */
  exposed = false;
  /** True while something is actively chasing. */
  pursued = false;

  /** Visual pulse phase, advanced faster the more danger there is. */
  pulse = 0;
  /** 0..1 instability used for the trembling near-death cursor. */
  tremor = 0;

  private decoySeed = 1;

  constructor(
    private readonly bus: EventBus,
    private readonly attention: AttentionSystem,
  ) {}

  reset(x: number, y: number): void {
    this.sensor.reset(x, y);
    this.trail.reset(x, y);
    this.clearDecoys();
    this.attention.clear();
    this.attention.add(this.sensor);
    this.state = 'NORMAL';
    this.heat = 0;
    this.displayHeat = 0;
    this.exposed = false;
    this.pursued = false;
    this.pulse = 0;
    this.tremor = 0;
  }

  update(
    dt: number,
    pointer: PointerState,
    roomTime: number,
    lightAt: (x: number, y: number) => number,
  ): void {
    this.sensor.update(dt, pointer, roomTime, lightAt);
    this.trail.update(dt, this.sensor.x, this.sensor.y, this.displayHeat);

    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.update(dt, lightAt);
      if (d.dead) {
        this.attention.remove(d);
        this.decoys.splice(i, 1);
        this.bus.emit('DECOY_EXPIRED', { decoyId: d.id });
      }
    }

    this.displayHeat = approach(this.displayHeat, this.heat, 8, dt);
    this.pulse += dt * (1.6 + this.displayHeat * 9);
    this.tremor = clamp01((this.displayHeat - 0.8) / 0.3);

    const next = this.deriveState();
    if (next !== this.state) {
      const from = this.state;
      this.state = next;
      this.bus.emit('CURSOR_STATE_CHANGED', { from, to: next });
    }
  }

  private deriveState(): CursorStateName {
    if (this.pursued) return 'PANICKING';
    if (this.heat >= AWARENESS.detect) return 'DETECTED';
    if (this.heat >= AWARENESS.suspicious) return 'SUSPICIOUS';
    if (this.exposed) return 'EXPOSED';
    return 'NORMAL';
  }

  spawnDecoy(spec: DecoySpec): CursorDecoy {
    const decoy = new CursorDecoy(spec, this.decoySeed++);
    this.decoys.push(decoy);
    this.attention.add(decoy);
    this.bus.emit('DECOY_SPAWNED', {
      decoyId: decoy.id,
      pattern: decoy.pattern,
      sourceId: decoy.sourceId,
    });
    return decoy;
  }

  clearDecoys(): void {
    for (const d of this.decoys) this.attention.remove(d);
    this.decoys.length = 0;
  }

  /** Kill the decoys a particular object was producing, for example a switched-off screen. */
  removeDecoysFrom(sourceId: string): void {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      if (d.sourceId !== sourceId) continue;
      this.attention.remove(d);
      this.decoys.splice(i, 1);
      this.bus.emit('DECOY_EXPIRED', { decoyId: d.id });
    }
  }

  get decoyCount(): number {
    return this.decoys.length;
  }

  registerClick(noise: number): void {
    this.sensor.registerClick(noise);
  }

  get x(): number {
    return this.sensor.x;
  }

  get y(): number {
    return this.sensor.y;
  }
}
