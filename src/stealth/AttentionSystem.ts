import { clamp01 } from '../core/Mathx';

/**
 * PRESENCE, the game's real currency.
 *
 * Enemies hunt the player's BODY (see PlayerAttention): where it stands, how
 * fast it moves, how lit it is, and where the flashlight beam points. Thrown
 * bottles and ringing phones register as short-lived echo sources through the
 * same interface, so every awareness rule written once works for both.
 */
export interface AttentionSource {
  readonly id: string;
  x: number;
  y: number;
  /** Logical units per second. */
  speed: number;
  /** Unit heading. Where this attention is *pointing*, which is half the game. */
  headingX: number;
  headingY: number;
  /** 0..1 agitation derived from speed. */
  movementIntensity: number;
  /** Seconds spent held in one spot. */
  dwellTime: number;
  /** 0..1 how legible it is, from room lighting. */
  visibility: number;
  /** Decaying click residue carried at this position. */
  noiseLevel: number;
  /** False for decoys. Advanced enemies read this; early ones cannot. */
  isReal: boolean;
  /** Weight multiplier so a weak decoy is less convincing than the real thing. */
  potency: number;
}

/**
 * How strongly the flashlight beam `source` is shining on the point (tx, ty).
 *
 * This is the new gaze axis. A body standing next to a creature with the beam
 * off is far less provocative than the same body shining the beam down its
 * throat, so alignment is raised to a power: only a fairly direct shine spikes.
 */
export function pointingFactor(
  source: AttentionSource,
  tx: number,
  ty: number,
  bodyRadius: number,
): number {
  const dx = tx - source.x;
  const dy = ty - source.y;
  const len = Math.hypot(dx, dy);

  // The cursor is literally on top of it. That is as direct as pointing gets.
  if (len <= bodyRadius) return 1;
  if (len < 1e-4) return 1;

  const alignment = (dx / len) * source.headingX + (dy / len) * source.headingY;
  if (alignment <= 0) return 0;
  // alignment^4 keeps a glancing heading almost free while a true point spikes.
  const a2 = alignment * alignment;
  return clamp01(a2 * a2);
}

/** Registry of live attention sources for a room. */
export class AttentionSystem {
  private readonly sources: AttentionSource[] = [];

  add(source: AttentionSource): void {
    if (!this.sources.includes(source)) this.sources.push(source);
  }

  remove(source: AttentionSource): void {
    const i = this.sources.indexOf(source);
    if (i >= 0) this.sources.splice(i, 1);
  }

  removeById(id: string): void {
    for (let i = this.sources.length - 1; i >= 0; i--) {
      if (this.sources[i].id === id) this.sources.splice(i, 1);
    }
  }

  get all(): readonly AttentionSource[] {
    return this.sources;
  }

  clear(): void {
    this.sources.length = 0;
  }
}
