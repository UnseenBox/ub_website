import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { EnemyTypeId } from '../EnemyTypes';
import { ChairmanScript } from './ChairmanScript';

/**
 * A boss's own fight. The shared Enemy code gives every boss walking, lunging, slamming and
 * throwing; a script is where one boss gets something nobody else does. It runs beside that
 * AI (it never replaces it), can see every hit the boss takes, and keeps its own state, which
 * the boss's drawing code reads to show it.
 *
 * To give another boss a script: write a class implementing this, and add it to `createBossScript`.
 */
export interface BossScript {
  /** Runs every simulation tick while the boss is up and about. */
  update(game: Game, boss: Enemy, dt: number): void;
  /** Sees each hit before it lands and returns the damage that actually does. 0 = blocked. */
  filterDamage?(game: Game, boss: Enemy, amount: number, cause: DamageCause): number;
  /** The boss has just fallen. */
  onDefeat?(game: Game, boss: Enemy): void;
  /** Shown instead of POOF! when the body finally goes. */
  readonly deathText?: string;
}

export function createBossScript(id: EnemyTypeId): BossScript | null {
  switch (id) {
    case 'chairman': return new ChairmanScript();
    default: return null;
  }
}
