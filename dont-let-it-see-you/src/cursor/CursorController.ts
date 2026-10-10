import { approach, clamp01 } from '../core/Mathx';
import type { EventBus } from '../core/EventBus';
import type { PointerState } from '../input/InputManager';
import { CursorDecoy, type DecoySpec } from './CursorDecoy';

/**
 * Simple aim reticle: tracks mouse position for flashlight aiming and bottle throws.
 * Nothing hunts the mouse — it's a tool, not a liability.
 */
export class CursorController {
  /** Current mouse position in world coords. */
  x = 0;
  y = 0;

  /** Machine echoes (screaming projectors, etc.) for distraction. */
  readonly decoys: CursorDecoy[] = [];

  /** 0..1+ worst enemy awareness — drives reticle pulse/tremor. */
  heat = 0;
  displayHeat = 0;
  exposed = false;
  pursued = false;

  pulse = 0;
  tremor = 0;

  private decoySeed = 1;

  constructor(private readonly bus: EventBus) {}

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clearDecoys();
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
    _roomTime: number,
    _lightAt: (x: number, y: number) => number,
  ): void {
    // Mouse position is the aim point
    this.x = pointer.x;
    this.y = pointer.y;

    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.update(dt, () => 1);
      if (d.dead) {
        this.bus.emit('DECOY_EXPIRED', { decoyId: d.id });
        this.decoys.splice(i, 1);
      }
    }

    this.displayHeat = approach(this.displayHeat, this.heat, 8, dt);
    this.pulse += dt * (1.6 + this.displayHeat * 9);
    this.tremor = clamp01((this.displayHeat - 0.8) / 0.3);
  }

  spawnDecoy(spec: DecoySpec): CursorDecoy {
    const decoy = new CursorDecoy(spec, this.decoySeed++);
    this.decoys.push(decoy);
    this.bus.emit('DECOY_SPAWNED', {
      decoyId: decoy.id,
      pattern: decoy.pattern,
      sourceId: decoy.sourceId,
    });
    return decoy;
  }

  clearDecoys(): void {
    this.decoys.length = 0;
  }

  removeDecoysFrom(sourceId: string): void {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      if (d.sourceId !== sourceId) continue;
      this.decoys.splice(i, 1);
      this.bus.emit('DECOY_EXPIRED', { decoyId: d.id });
    }
  }

  get decoyCount(): number {
    return this.decoys.length;
  }
}