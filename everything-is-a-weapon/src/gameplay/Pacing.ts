/**
 * Ease-in. The first rooms after the tutorial (and the first endless floors) are played by
 * people who have only just learned to throw, and they meet a boss almost at once. Measured
 * with the balance bot, that boss was the single steepest wall in the game. So everything is
 * softer at first and reaches full strength by the tenth step.
 *
 * `step` is 1 for the tutorial, 2 for the first real room (or endless floor 1), and so on.
 */
export interface Ease {
  /** Multiplies enemy hit points. */
  readonly hp: number;
  /** Multiplies enemy speed. */
  readonly speed: number;
  /** Multiplies the hearts a touch costs. */
  readonly damage: number;
}

export const FULL: Ease = { hp: 1, speed: 1, damage: 1 };
/** Where the ease-in ends. */
export const EASE_UNTIL = 12;

const START: Ease = { hp: 0.5, speed: 0.85, damage: 0.7 };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function earlyEase(step: number): Ease {
  if (step <= 1 || step >= EASE_UNTIL) return FULL;
  const t = (step - 2) / (EASE_UNTIL - 2);
  return {
    hp: lerp(START.hp, 1, t),
    speed: lerp(START.speed, 1, t),
    damage: lerp(START.damage, 1, t),
  };
}

/**
 * Bosses that, in the balance bot's hands, cost far more hearts than their neighbours in the
 * opening stretch. Shorter fights mean less time in their reach. Only the early campaign
 * rooms are softened: the same bosses return at full strength deep in endless.
 */
const SOFTENED_EARLY: Readonly<Record<string, number>> = { flusher: 0.75, piano: 0.55, mom: 0.5, house: 0.6 };
const SOFTEN_UNTIL = 10;
/** Late bosses that killed bots of every style far more often than the bosses around them. */
const SOFTENED_ALWAYS: Readonly<Record<string, number>> = { cables: 0.55, cooker: 0.7, vacuumasaurus: 0.8, junk: 0.85 };

export function bossSoften(type: string, step: number): number {
  const early = step <= SOFTEN_UNTIL ? SOFTENED_EARLY[type] : undefined;
  return early ?? SOFTENED_ALWAYS[type] ?? 1;
}

/**
 * Generated crews toughen steadily with depth. This used to stop growing at depth 9 (room 17),
 * which made rooms 17-49 one long plateau; it now keeps rising until depth 29.
 */
export function depthHpScale(depth: number): number {
  return Math.min(2.3, 1 + 0.045 * Math.max(0, depth));
}
