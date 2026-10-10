import { LIGHT, PLAYER } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { AttentionSource } from './AttentionSystem';
import type { Player } from '../player/Player';

/**
 * THE BODY AS BAIT.
 *
 * The cursor is gone as a gameplay object. This is the only real attention
 * source left: the player's physical body. Monsters read:
 * - where you stand (proximity)
 * - how fast you move (sprint = loud, sneak = whisper)
 * - how lit you are (darkness hides, flashlight exposes)
 * - where your flashlight points (shining it at them is provocation)
 *
 * Hidden in a locker: potency 0, invisible. That is the whole hiding game.
 */
export class BodyAttention implements AttentionSource {
  readonly id = 'player-body';
  x = 0;
  y = 0;
  speed = 0;
  headingX = 1;
  headingY = 0;
  movementIntensity = 0;
  dwellTime = 0;
  visibility = 1;
  noiseLevel = 0;
  readonly isReal = true;
  potency = 1;
  /** Challenge scaling (JUMPY_CURSOR). Multiplies how convincing the body is. */
  sensitivity = 1;

  private stillTimer = 0;

  update(player: Player, lightLevel: number, dt: number): void {
    this.x = player.x;
    this.y = player.y;

    const spd = Math.hypot(player.vx, player.vy);
    this.speed = spd;
    // Sprinting at full tilt = max agitation. Sneaking barely registers.
    const raw = clamp01(spd / PLAYER.sprintSpeed);
    const sneakScale = player.sneaking ? 0.25 : player.sprinting ? 1 : 0.55;
    this.movementIntensity = clamp01(raw * sneakScale + (player.sprinting && player.moving ? 0.35 : 0));

    if (spd > 4) {
      const inv = 1 / Math.max(1, spd);
      this.headingX = player.vx * inv;
      this.headingY = player.vy * inv;
      this.stillTimer = 0;
      this.dwellTime = 0;
    } else {
      this.stillTimer += dt;
      this.dwellTime = this.stillTimer;
    }

    // Visibility: room light, modified by posture and flashlight.
    let vis = Math.max(LIGHT.minVisibility, lightLevel);
    if (player.sneaking) vis *= player.moving ? 0.8 : LIGHT.sneakShadowScale;
    if (player.flashlightOn && !player.hidden) {
      vis = Math.min(1, vis + PLAYER.flashlightVisibility * 0.45);
    }
    // Sprinting kicks up presence even in the dark.
    if (player.sprinting && player.moving) vis = Math.min(1, vis + 0.2);
    this.visibility = clamp01(vis);

    // Hidden = gone. No potency, no visibility.
    if (player.hidden || player.dead) {
      this.potency = 0;
      this.visibility = 0;
    } else {
      this.potency = this.sensitivity;
    }

    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 2.6);
  }

  registerNoise(level: number): void {
    this.noiseLevel = Math.min(8, this.noiseLevel + level);
  }
}

/**
 * How much the player's flashlight beam provokes the creature at (ex, ey).
 * Shining the beam straight into its face is brave or stupid — both are fun.
 */
export function flashlightGlare(
  player: Player,
  ex: number,
  ey: number,
  range: number,
): number {
  if (!player.flashlightOn || player.hidden || player.dead) return 0;
  const dx = ex - player.x;
  const dy = ey - player.y;
  const d = Math.hypot(dx, dy);
  if (d > range || d < 1e-4) return d < 40 ? 0.6 : 0;
  const aim = player.aimAngle;
  const toEnemy = Math.atan2(dy, dx);
  let diff = Math.abs(toEnemy - aim) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  const cone = 0.42; // ~24 degrees each side
  if (diff > cone) return 0;
  const align = 1 - diff / cone;
  const fall = 1 - d / range;
  return clamp01(align * (0.35 + 0.65 * fall));
}
