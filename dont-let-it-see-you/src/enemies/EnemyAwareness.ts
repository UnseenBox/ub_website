import { LIGHT } from '../core/Tuning';
import { angleDelta, clamp, clamp01 } from '../core/Mathx';
import type { Rect } from '../core/Mathx';
import { isBlocked } from '../stealth/LineOfSight';
import type { AttentionSource } from '../stealth/AttentionSystem';
import type { AwarenessProfile } from '../enemies/EnemyDefinition';

export interface AwarenessInputs {
  x: number;
  y: number;
  facing: number;
  profile: AwarenessProfile;
  blockers: readonly Rect[];
  /** 0..1 flashlight glare on this creature this step. Provocation. */
  glare?: number;
}

export interface SourceReading {
  source: AttentionSource | null;
  /** Raw pressure in roughly 0..1.6. */
  pressure: number;
  /** True when the body is inside the awareness radius with a clear line. */
  inRadius: boolean;
  visible: boolean;
  distance: number;
  /** Debug breakdown. */
  proximity: number;
  pointing: number;
  speed: number;
  dwell: number;
  neglect: number;
  coneMultiplier: number;
}

const EMPTY: SourceReading = {
  source: null,
  pressure: 0,
  inRadius: false,
  visible: false,
  distance: Infinity,
  proximity: 0,
  pointing: 0,
  speed: 0,
  dwell: 0,
  neglect: 0,
  coneMultiplier: 0,
};

/**
 * Score the PLAYER'S BODY against one creature.
 *
 * New horror model — no cursor:
 *   proximity = inverse-square closeness, scaled by body visibility (light)
 *   pointing  = flashlight glare (shining the beam at it)
 *   speed     = movement agitation (sprint feeds everything)
 *   dwell     = standing exposed in the light too long
 *   neglect   = unused (kept for save compat, always 0)
 *
 * Darkness blurs but never erases. Hiding zeroes potency upstream.
 */
export function evaluateSource(
  e: AwarenessInputs,
  src: AttentionSource,
  out: SourceReading,
): SourceReading {
  const p = e.profile;
  const dx = src.x - e.x;
  const dy = src.y - e.y;
  const d = Math.hypot(dx, dy);

  out.source = src;
  out.distance = d;
  out.proximity = 0;
  out.pointing = 0;
  out.speed = 0;
  out.dwell = 0;
  out.neglect = 0;
  out.coneMultiplier = 0;
  out.inRadius = false;
  out.visible = false;
  out.pressure = 0;

  if (src.potency <= 0) return out;
  if (d > p.farRadius) return out;

  const visible = !p.requiresLineOfSight || !isBlocked(e.blockers, e.x, e.y, src.x, src.y);
  out.visible = visible;
  if (!visible) return out;

  // Gaze cone of the creature itself: flanking still matters.
  const angleTo = Math.atan2(dy, dx);
  const offAxis = Math.abs(angleDelta(e.facing, angleTo));
  const inCone = offAxis <= p.gazeAngle;
  const coneEdge = 1 - clamp01((offAxis - p.gazeAngle) / 0.5);
  const coneMul = inCone ? p.gazeBonus : p.blindMultiplier + (p.gazeBonus - p.blindMultiplier) * coneEdge * 0.35;
  out.coneMultiplier = coneMul;

  // DISTANCE × LIGHT: closeness only counts if it can actually see you.
  const ratio = d / p.awarenessRadius;
  const proximityBase = clamp01(1 - ratio * ratio);
  const lightGate = Math.max(LIGHT.minVisibility, src.visibility);
  const proximity = proximityBase * (0.3 + 0.7 * lightGate);
  out.proximity = proximity;
  out.inRadius = d <= p.awarenessRadius;

  // FLASHLIGHT GLARE: beam in its face.
  const glare = clamp01(e.glare ?? 0);
  out.pointing = glare;

  // MOVEMENT: sprinting is legible from far away.
  const speedTerm = src.movementIntensity * (0.45 + 0.55 * proximityBase);
  out.speed = speedTerm;

  // DWELL: standing still inside its radius, lit, for seconds.
  const dwellRamp = clamp01((src.dwellTime - 1.4) / 2.4);
  const dwellTerm = dwellRamp * (0.2 + 0.8 * proximityBase) * lightGate;
  out.dwell = dwellTerm;

  let raw =
    p.proximityWeight * proximity +
    p.pointWeight * glare +
    p.speedWeight * speedTerm +
    p.dwellWeight * dwellTerm;

  raw *= coneMul;
  raw *= src.potency;

  if (!src.isReal && p.seesThroughDecoys) raw *= 0.08;

  out.pressure = clamp(raw, 0, 1.8);
  return out;
}

/**
 * Pick the source provoking this creature most. With the cursor gone there is
 * normally exactly one real source (your body) plus thrown-bottle lures handled
 * through the noise path.
 */
export function strongestSource(
  e: AwarenessInputs,
  sources: readonly AttentionSource[],
  scratch: SourceReading,
  best: SourceReading,
): SourceReading {
  Object.assign(best, EMPTY);
  best.pressure = -Infinity;
  let found = false;
  for (let i = 0; i < sources.length; i++) {
    const reading = evaluateSource(e, sources[i], scratch);
    if (!found || reading.pressure > best.pressure) {
      Object.assign(best, reading);
      found = true;
    }
  }
  if (!found) Object.assign(best, EMPTY);
  return best;
}

export function makeReading(): SourceReading {
  return { ...EMPTY };
}
