import type { Rng } from '../core/Random';
import type { Rock } from '../core/types';
import { PROSPECT_EFFECTS, TRAIT_EFFECTS } from '../data/traits';
import type { LevelOf } from './ToolStats';

/** What the skills decided for one swing. */
export interface SwingRoll {
  /** Multiplier on the swing's depth (a big hole, rage). */
  depth: number;
  /** Multiplier on the swing's width. */
  width: number;
  bigHole: boolean;
  /** A ghost copy of the tool will dig the same spot a moment later. */
  afterimage: boolean;
  /** The digger just flew into a rage on this swing. */
  rageStarted: boolean;
  /** The swing is part of a rage. */
  raging: boolean;
  /** Mini projectiles fired from the shovel with this swing. */
  shots: number;
}

export const PLAIN_SWING: SwingRoll = Object.freeze({
  depth: 1, width: 1, bigHole: false, afterimage: false, rageStarted: false, raging: false, shots: 0,
});

/**
 * The store's skills as game logic. It rolls the chances and keeps the small amount of state they need
 * (the same-spot streak, the rage timer, the scrap shot charges, the once-a-day breather). It draws and
 * plays nothing: the dig scene turns what it says into holes, ghosts and sounds. Times are scene
 * milliseconds, passed in, so the simulations can drive it with their own clock.
 */
export class TraitSystem {
  private spotX = Number.NEGATIVE_INFINITY;
  private spotCount = 0;
  private lastSwingAt = Number.NEGATIVE_INFINITY;
  private rageUntil = 0;
  private rageReadyAt = 0;
  private charges = 0;
  private secondWindDay = -1;

  constructor(
    private readonly levelOf: LevelOf,
    private readonly rng: Rng = Math.random,
  ) {}

  private lv(id: string): number {
    return this.levelOf(id);
  }

  // ---------- prospecting upgrades ----------

  /** Chance that a find is two rocks. */
  get doubleFindChance(): number {
    return Math.min(1, this.lv('up-double-find') * PROSPECT_EFFECTS.doubleFindPerLevel);
  }

  rollDoubleFind(): boolean {
    return this.rng() < this.doubleFindChance;
  }

  /** Chance that a hit frees an embedded rock at once. */
  get instantCrackChance(): number {
    return Math.min(1, this.lv('up-instant-crack') * PROSPECT_EFFECTS.instantCrackPerLevel);
  }

  rollInstantCrack(): boolean {
    return this.rng() < this.instantCrackChance;
  }

  /** Chance that a cut turns out a better rock than it was. */
  get luckyCutChance(): number {
    return Math.min(1, this.lv('up-lucky-cut') * PROSPECT_EFFECTS.luckyCutPerLevel);
  }

  rollLuckyCut(rock: Rock): boolean {
    // A legendary rock cannot get better.
    if (rock.rarity.id === 'legendary') return false;
    return this.rng() < this.luckyCutChance;
  }

  // ---------- the swing ----------

  /** True while the digger is in a rage. */
  raging(now: number): boolean {
    return now < this.rageUntil;
  }

  /** Cooldown and stamina multipliers of a rage (1 when calm). */
  cooldownMult(now: number): number {
    return this.raging(now) ? TRAIT_EFFECTS.angry.cooldownMult : 1;
  }

  staminaMult(now: number): number {
    return this.raging(now) ? TRAIT_EFFECTS.angry.staminaMult : 1;
  }

  /** Remaining rage, 0..1, for effects. */
  rageLeft(now: number): number {
    return this.raging(now) ? (this.rageUntil - now) / TRAIT_EFFECTS.angry.durationMs : 0;
  }

  /**
   * Rolls the skills for a swing that is about to land at x (field units). Call once per swing that
   * was paid for, before it digs.
   */
  rollSwing(x: number, now: number): SwingRoll {
    const E = TRAIT_EFFECTS;
    const same = Math.abs(x - this.spotX) <= E.angry.spotRadius && now - this.lastSwingAt < E.angry.streakGapMs;
    this.spotCount = same ? this.spotCount + 1 : 1;
    this.spotX = x;
    this.lastSwingAt = now;

    let rageStarted = false;
    const angry = this.lv('trait-angry');
    if (angry > 0 && !this.raging(now) && now >= this.rageReadyAt && this.spotCount >= E.angry.minRepeats
      && this.rng() < Math.min(1, E.angry.chancePerLevel * angry)) {
      this.rageUntil = now + E.angry.durationMs;
      this.rageReadyAt = this.rageUntil + E.angry.cooldownMs;
      rageStarted = true;
    }
    const raging = this.raging(now);

    const big = this.lv('trait-big-hole');
    const bigHole = big > 0 && this.rng() < Math.min(1, E.bigHole.chancePerLevel * big);

    const ghost = this.lv('trait-afterimage');
    const afterimage = ghost > 0 && this.rng() < Math.min(1, E.afterimage.chancePerLevel * ghost);

    let shots = 0;
    if (this.charges > 0) {
      this.charges--;
      shots = this.lv('trait-scrap-shot');
    }

    if (!bigHole && !raging && !afterimage && !rageStarted && shots === 0) return PLAIN_SWING;
    return {
      depth: (bigHole ? E.bigHole.depthMult : 1) * (raging ? E.angry.depthMult : 1),
      width: bigHole ? E.bigHole.widthMult : 1,
      bigHole, afterimage, rageStarted, raging, shots,
    };
  }

  // ---------- junk skills ----------

  /** A worthless rock that is dug up: does it turn hot and blow up? */
  rollHotRock(rock: Rock): boolean {
    const level = this.lv('trait-hot-rock');
    if (level <= 0 || rock.value > 0) return false;
    return this.rng() < Math.min(1, TRAIT_EFFECTS.hotRock.chancePerLevel * level);
  }

  /** A worthless rock could turn hot (used to let it out of a full bag). */
  mayGoHot(rock: Rock): boolean {
    return this.lv('trait-hot-rock') > 0 && rock.value <= 0;
  }

  /** A worthless rock was thrown away in the workshop: load the shovel. Returns true when Scrap Shot is owned. */
  onWorthlessThrown(): boolean {
    if (this.lv('trait-scrap-shot') <= 0) return false;
    this.charges = Math.min(TRAIT_EFFECTS.scrapShot.maxCharges, this.charges + TRAIT_EFFECTS.scrapShot.loadedSwings);
    return true;
  }

  /** Swings still loaded with Scrap Shot. */
  get loadedSwings(): number {
    return this.charges;
  }

  // ---------- survival and trade ----------

  /**
   * The breather: once per day, when the tank runs dry, part of it comes back. Returns the fraction of the
   * tank to restore, or 0 when the skill is missing or already used today.
   */
  trySecondWind(day: number): number {
    const level = this.lv('trait-second-wind');
    if (level <= 0 || this.secondWindDay === day) return 0;
    this.secondWindDay = day;
    return Math.min(1, TRAIT_EFFECTS.secondWind.restoreBase + TRAIT_EFFECTS.secondWind.restorePerLevel * level);
  }

  /** Multiplier on rock sale prices. */
  get sellMult(): number {
    return 1 + TRAIT_EFFECTS.haggler.perLevel * this.lv('trait-haggler');
  }

  /** A new run: forget the streak, the rage and the charges. */
  reset(): void {
    this.spotX = Number.NEGATIVE_INFINITY;
    this.spotCount = 0;
    this.lastSwingAt = Number.NEGATIVE_INFINITY;
    this.rageUntil = 0;
    this.rageReadyAt = 0;
    this.charges = 0;
    this.secondWindDay = -1;
  }
}
