// Phone aim assistance: a crosshair near an enemy's head or chest is drawn onto it, so a
// slightly off thumb still hits. Pure, so it is unit-tested.
//
// Four things keep it smooth:
//  - the pull is worked out from the finger, never from where the crosshair already is, and
//    fades with distance, so there is no point at which it switches on or off;
//  - while the finger is sweeping the pull mostly lets go, so the crosshair neither clings
//    to what it passes nor hops between targets;
//  - once on a target the crosshair keeps to it (its walk is carried over at once, while the
//    bob and flinch of the body are filtered out), and it only changes target when the finger
//    is clearly nearer to another;
//  - every change of pull is eased in over a few frames, the same at any frame rate.

export const AIM = {
  /** Within this many pixels of the finger the crosshair sits right on the target. */
  lock: 85,
  /** Beyond this the target is ignored; between the two the pull fades. */
  reach: 130,
  /** Another target must be this much nearer to the finger to take over. */
  switchBy: 30,
  /** Seconds over which a change of pull is eased in. */
  ease: 0.06,
  /** Seconds over which a body's bob and flinch are averaged out. */
  steady: 0.22,
  /** A target that moves further than this in one frame is a different body. */
  teleport: 60,
  /** Crosshair travel (pixels a second) at which a sweep starts to loosen the pull, and is in full swing. */
  sweepFrom: 140,
  sweepFull: 480,
  /** Share of the pull a full sweep takes away. */
  sweepLoosen: 0.85,
  /** Seconds over which the finger's speed is averaged, so a trembling thumb reads as still. */
  pace: 0.09,
} as const;

/** A point worth aiming at, and the ground point of the body it belongs to. */
export interface AimPoint {
  owner: object;
  part: 'head' | 'chest';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

interface Lock {
  owner: object;
  part: AimPoint['part'];
  /** The aim point relative to the body's ground point, averaged over time. */
  rx: number;
  ry: number;
  /** Where the crosshair was aiming on the last frame. */
  x: number;
  y: number;
}

/** Share of the remaining difference closed after `dt` seconds with time constant `tau`. */
const eased = (dt: number, tau: number): number => 1 - Math.exp(-dt / tau);

/** 0 at `from`, 1 at `to`, with no corners between. */
function ramp(value: number, from: number, to: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** 1 when locked on, 0 out of reach. */
const strength = (distance: number): number => ramp(distance, AIM.reach, AIM.lock);

export class AimAssist {
  private lock: Lock | null = null;
  /** How far the crosshair sits from the finger. */
  private ox = 0;
  private oy = 0;
  /** The finger on the last frame, and its velocity averaged over a moment. */
  private last: { x: number; y: number } | null = null;
  private vx = 0;
  private vy = 0;

  reset(): void {
    this.lock = null;
    this.last = null;
    this.ox = this.oy = this.vx = this.vy = 0;
  }

  /** Where the crosshair goes for a finger at `finger`, `dt` seconds after the last call. */
  step(finger: { x: number; y: number }, points: readonly AimPoint[], dt: number): { x: number; y: number } {
    const moveX = this.last ? finger.x - this.last.x : 0;
    const moveY = this.last ? finger.y - this.last.y : 0;
    if (dt > 0) {
      const p = eased(dt, AIM.pace);
      this.vx += (moveX / dt - this.vx) * p;
      this.vy += (moveY / dt - this.vy) * p;
    }
    const hold = 1 - AIM.sweepLoosen * ramp(Math.hypot(this.vx, this.vy), AIM.sweepFrom, AIM.sweepFull);
    const point = this.choose(finger, points);
    let wantX = 0, wantY = 0;
    if (point) {
      const held = this.lock && this.lock.owner === point.owner && this.lock.part === point.part ? this.lock : null;
      const relX = point.x - point.baseX, relY = point.y - point.baseY;
      const k = eased(dt, AIM.steady);
      const rx = held ? held.rx + (relX - held.rx) * k : relX;
      const ry = held ? held.ry + (relY - held.ry) * k : relY;
      const x = point.baseX + rx, y = point.baseY + ry;
      const w = hold * strength(Math.hypot(x - finger.x, y - finger.y));
      // On the same target as last frame: carry its movement over, and take up the finger's.
      if (held && Math.hypot(x - held.x, y - held.y) <= AIM.teleport) {
        this.ox += w * (x - held.x - moveX);
        this.oy += w * (y - held.y - moveY);
      }
      this.lock = { owner: point.owner, part: point.part, rx, ry, x, y };
      wantX = (x - finger.x) * w;
      wantY = (y - finger.y) * w;
    } else {
      this.lock = null;
    }
    const k = eased(dt, AIM.ease);
    this.ox += (wantX - this.ox) * k;
    this.oy += (wantY - this.oy) * k;
    this.last = { x: finger.x, y: finger.y };
    return { x: finger.x + this.ox, y: finger.y + this.oy };
  }

  /** The held target while it is still the sensible one, otherwise the nearest in reach. */
  private choose(finger: { x: number; y: number }, points: readonly AimPoint[]): AimPoint | null {
    let nearest: AimPoint | null = null, nearestAt: number = AIM.reach;
    let held: AimPoint | null = null, heldAt = Infinity;
    for (const p of points) {
      const d = Math.hypot(p.x - finger.x, p.y - finger.y);
      if (d >= AIM.reach) continue;
      if (d < nearestAt) {
        nearest = p;
        nearestAt = d;
      }
      if (this.lock && p.owner === this.lock.owner && p.part === this.lock.part) {
        held = p;
        heldAt = d;
      }
    }
    return held && nearestAt > heldAt - AIM.switchBy ? held : nearest;
  }
}
