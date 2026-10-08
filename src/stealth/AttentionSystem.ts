import { clamp01 } from '../core/Mathx';

/**
 * ATTENTION, the game's real currency.
 *
 * Enemies never look for the player's body. They look for sources of attention.
 * The player's cursor is one. A decoy is another. Because both satisfy the same
 * interface, every awareness rule written once works for both, and an enemy that
 * can tell them apart only has to check `isReal`.
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
 * How strongly `source` is pointing at the point (tx, ty).
 *
 * This is the gaze axis. A cursor sitting still next to a creature is far less
 * dangerous than a cursor aimed down its throat, so alignment is raised to a
 * power: only a fairly direct point registers hard.
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
