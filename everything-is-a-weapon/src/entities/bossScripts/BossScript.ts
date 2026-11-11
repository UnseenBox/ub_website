import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { EnemyTypeId } from '../EnemyTypes';
import { ChairmanScript } from './ChairmanScript';
import { FlusherScript } from './FlusherScript';
import { FridgeScript } from './FridgeScript';
import { KrakenScript } from './KrakenScript';
import { PianoScript } from './PianoScript';
import { MowerScript } from './MowerScript';
import { MomScript } from './MomScript';
import { VacuumScript } from './VacuumScript';
import { HydraScript } from './HydraScript';
import { FanScript } from './FanScript';
import { PopcornScript } from './PopcornScript';
import { CablesScript } from './CablesScript';
import { CookerScript } from './CookerScript';
import { TrainScript } from './TrainScript';
import { JunkScript } from './JunkScript';

type Ctx = CanvasRenderingContext2D;

/**
 * A boss's own fight. The shared Enemy code gives every boss walking, lunging and slamming;
 * a script is where one boss gets something nobody else does: its own attacks, its own
 * rules about taking damage, and its own things to draw on the floor and in the air.
 *
 * It runs beside the shared AI. While `busy` is true the script is in charge of the boss
 * (it moves the body itself) and the shared AI sits out; the moment the boss is stunned,
 * shocked or set alight the script is expected to drop whatever it was doing.
 *
 * To give another boss a script: write a class implementing this, and add it to `createBossScript`.
 */
export interface BossScript {
  /** Runs every simulation tick while the boss is up and about. */
  update(game: Game, boss: Enemy, dt: number): void;
  /** True while the script is performing an attack and driving the body itself. */
  readonly busy?: boolean;
  /** Sees each hit before it lands and returns the damage that actually does. 0 = blocked. */
  filterDamage?(game: Game, boss: Enemy, amount: number, cause: DamageCause): number;
  /** The boss has just fallen. */
  onDefeat?(game: Game, boss: Enemy): void;
  /** Warnings and zones painted on the floor, under everything standing on it. World coordinates. */
  drawFloor?(ctx: Ctx, game: Game, boss: Enemy, time: number): void;
  /** Projectiles and markers drawn over the top. World coordinates. */
  drawAir?(ctx: Ctx, game: Game, boss: Enemy, time: number): void;
  /** Where a throw should be aimed instead of at his body (touch aim assist uses it). null = the body. */
  aimPoints?(boss: Enemy): ReadonlyArray<{ x: number; y: number }> | null;
  /** Shown instead of POOF! when the body finally goes. */
  readonly deathText?: string;
}

export function createBossScript(id: EnemyTypeId): BossScript | null {
  switch (id) {
    case 'chairman': return new ChairmanScript();
    case 'flusher': return new FlusherScript();
    case 'fridgezilla': return new FridgeScript();
    case 'kraken': return new KrakenScript();
    case 'piano': return new PianoScript();
    case 'mower': return new MowerScript();
    case 'mom': return new MomScript();
    case 'vacuumasaurus': return new VacuumScript();
    case 'hydra': return new HydraScript();
    case 'fan': return new FanScript();
    case 'popcorn': return new PopcornScript();
    case 'cables': return new CablesScript();
    case 'cooker': return new CookerScript();
    case 'train': return new TrainScript();
    case 'junk': return new JunkScript();
    default: return null;
  }
}
