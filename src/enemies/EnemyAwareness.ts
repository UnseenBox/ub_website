import { CURSOR } from '../core/Tuning';
import { angleDelta, clamp, clamp01, invLerp } from '../core/Mathx';
import type { Rect } from '../core/Mathx';
import { isBlocked } from '../stealth/LineOfSight';
import { pointingFactor, type AttentionSource } from '../stealth/AttentionSystem';
import type { AwarenessProfile } from './EnemyDefinition';

export interface AwarenessInputs {
  x: number;
  y: number;
  facing: number;
  profile: AwarenessProfile;
  blockers: readonly Rect[];
}

export interface SourceReading {
  source: AttentionSource | null;
  /** Raw pressure in roughly 0..1.6. Negative means the source is soothing. */
  pressure: number;
  /** True when the source is inside the awareness radius with a clear line. */
  inRadius: boolean;
  visible: boolean;
  distance: number;
  /** Debug breakdown, so the overlay can explain exactly why you are in trouble. */
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
 * Score one attention source against one creature.
 *
 * This function is the game. It never looks at the player's body: it reads where
 * attention is, which way it is aimed, how agitated it is, how long it has sat
 * still, and whether the creature could see it from where it stands.
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

  if (d > p.farRadius) return out;

  const visible = !p.requiresLineOfSight || !isBlocked(e.blockers, e.x, e.y, src.x, src.y);
  out.visible = visible;
  if (!visible) return out;

  // Is the source inside the creature's own gaze cone? Most creatures are much
  // duller to anything behind them, which is what makes flanking a real option.
  const angleTo = Math.atan2(dy, dx);
  const offAxis = Math.abs(angleDelta(e.facing, angleTo));
  const inCone = offAxis <= p.gazeAngle;
  // Soften the cone edge so the boundary is not a tripwire.
  const coneEdge = 1 - clamp01((offAxis - p.gazeAngle) / 0.5);
  const coneMul = inCone ? p.gazeBonus : p.blindMultiplier + (p.gazeBonus - p.blindMultiplier) * coneEdge * 0.35;
  out.coneMultiplier = coneMul;

  // DISTANCE: how close attention has come. An inverse-square falloff rather
  // than a smoothstep, so the whole radius feels live instead of only the last
  // few pixels: half way in is already a third of the pressure.
  const ratio = d / p.awarenessRadius;
  const proximity = clamp01(1 - ratio * ratio);
  out.proximity = proximity;
  const nearness = proximity;
  out.inRadius = d <= p.awarenessRadius;

  // DIRECTION: is the cursor aimed at it? Falls off with range but never to zero.
  const pointing = pointingFactor(src, e.x, e.y, p.bodyRadius);
  const pointRange = 0.25 + 0.75 * clamp01(1 - d / p.farRadius);
  out.pointing = pointing * pointRange;

  // MOVEMENT: agitation. Weighted toward things happening close by, but a
  // panicking hand is legible from across a room, which is the Hound's whole point.
  const speedTerm = src.movementIntensity * (0.45 + 0.55 * nearness);
  out.speed = speedTerm;

  // DWELL: holding attention unnaturally still in one place.
  const dwellTerm =
    clamp01(invLerp(CURSOR.dwellGrace, CURSOR.dwellFull, src.dwellTime)) * (0.25 + 0.75 * nearness);
  out.dwell = dwellTerm;

  // NEGLECT: the Parasite's inversion. Being pointedly ignored up close.
  const neglect = p.neglectWeight > 0 ? (1 - pointing) * clamp01(1 - d / p.farRadius) : 0;
  out.neglect = neglect;

  let raw =
    p.proximityWeight * proximity +
    p.pointWeight * out.pointing +
    p.speedWeight * speedTerm +
    p.dwellWeight * dwellTerm +
    p.neglectWeight * neglect;

  raw *= coneMul;
  // Darkness does not erase attention, it only makes it harder to read.
  raw *= src.visibility;
  raw *= src.potency;

  // A creature that can tell a fake cursor from a real one is almost immune.
  if (!src.isReal && p.seesThroughDecoys) raw *= 0.08;

  out.pressure = clamp(raw, -0.6, 1.8);
  return out;
}

/**
 * Pick the source that is currently provoking this creature most. Using the
 * maximum rather than a sum keeps behaviour legible: the creature is looking at
 * one thing, and that thing is the one it walks toward.
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
