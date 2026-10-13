import { clamp01 } from '../core/math';

export const SHOT_TUNING = {
  /** Pulls shorter than this are treated as a click, not a shot. */
  deadZone: 18,
  /** Pull length (world units) that gives full power. */
  maxPull: 250,
  minSpeed: 380,
  maxSpeed: 2000,
  /** Slightly above 1 so the first part of the pull gives finer control over soft shots. */
  curve: 1.15,
  /** Number of audible and visible steps across the power range. */
  steps: 10,
} as const;

export const speedForPower = (power: number): number =>
  SHOT_TUNING.minSpeed + (SHOT_TUNING.maxSpeed - SHOT_TUNING.minSpeed) * Math.pow(clamp01(power), SHOT_TUNING.curve);

export interface Shot {
  dirX: number;
  dirY: number;
  /** 0 to 1. */
  power: number;
  /** Launch speed in world units per second. */
  speed: number;
  /** Reserved for the curve shot; always 0 until the spin system exists. */
  spin: number;
  /** Seconds the player spent aiming. */
  charge: number;
  launchX: number;
  launchY: number;
}

/**
 * Slingshot aiming. The press can land anywhere: only the drag vector matters, and it is
 * applied at the ball. Pull away from where you want the ball to go, let go to shoot.
 */
export class ShotController {
  aiming = false;
  /** Drag vector, clamped to maxPull. Points from the ball towards the pull handle. */
  pullX = 0;
  pullY = 0;
  /** Unit shot direction (opposite the pull). */
  dirX = 0;
  dirY = -1;
  power = 0;
  speed = 0;
  /** False while the pull is still inside the dead zone. */
  armed = false;
  step = 0;
  private charge = 0;

  begin(): void {
    this.aiming = true;
    this.pullX = 0;
    this.pullY = 0;
    this.power = 0;
    this.speed = 0;
    this.armed = false;
    this.step = 0;
    this.charge = 0;
  }

  /**
   * Feeds the drag so far, in world units from the press point.
   * Returns true when the power crossed into a new step.
   */
  update(dragX: number, dragY: number, dt: number): boolean {
    if (!this.aiming) return false;
    this.charge += dt;
    const len = Math.hypot(dragX, dragY);
    const { deadZone, maxPull, steps } = SHOT_TUNING;
    const k = len > maxPull ? maxPull / len : 1;
    this.pullX = dragX * k;
    this.pullY = dragY * k;
    this.armed = len > deadZone;
    if (!this.armed) {
      this.power = 0;
      this.speed = 0;
      this.step = 0;
      return false;
    }
    this.dirX = -dragX / len;
    this.dirY = -dragY / len;
    this.power = clamp01((Math.min(len, maxPull) - deadZone) / (maxPull - deadZone));
    this.speed = speedForPower(this.power);
    const step = Math.min(steps, Math.floor(this.power * steps) + 1);
    const changed = step !== this.step;
    this.step = step;
    return changed;
  }

  /** Ends the aim. Returns the shot, or null if the pull never left the dead zone. */
  release(launchX: number, launchY: number): Shot | null {
    if (!this.aiming) return null;
    this.aiming = false;
    if (!this.armed) return null;
    this.armed = false;
    return {
      dirX: this.dirX,
      dirY: this.dirY,
      power: this.power,
      speed: this.speed,
      spin: 0,
      charge: this.charge,
      launchX,
      launchY,
    };
  }

  cancel(): void {
    this.aiming = false;
    this.armed = false;
    this.power = 0;
    this.pullX = 0;
    this.pullY = 0;
  }
}
