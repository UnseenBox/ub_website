import {
  CONDITIONS,
  FIND_BY_ID,
  FIND_CONFIG,
  FINDS,
  type ConditionId,
  type FindCategory,
  type FindDef,
} from '../data/finds';

/** One concrete find sitting in the player's possession. */
export interface FindItem {
  /** Unique item id, unique across the life of the system. */
  id: string;
  /** The catalogue id this item was built from. */
  defId: string;
  category: FindCategory;
  /** Condition of the find. Artifacts really use it, the rest keep a neutral one. */
  condition: ConditionId;
  /** Sale value in dollars. Exactly 0 for anything that is not an artifact. */
  value: number;
}

/** Plain data used to save and restore the finds inventory. */
export interface FindsSave {
  artifacts: FindItem[];
  collection: Record<string, number>;
  junk: Record<string, number>;
}

const LAYER_COUNT = 10;
const MAX_COUNT = 9999;

function clampLayer(layerIndex: number): number {
  if (!Number.isFinite(layerIndex)) return 0;
  return Math.max(0, Math.min(LAYER_COUNT - 1, Math.floor(layerIndex)));
}

function isConditionId(value: unknown): value is ConditionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONDITIONS, value);
}

/** Weights of the conditions, in declaration order. */
const CONDITION_IDS = Object.keys(CONDITIONS) as ConditionId[];

/**
 * Decides when a swing turns up a find and which one.
 *
 * Finds never pay money on the spot. Artifacts are stored and sold later,
 * collection items are written into the collection record and junk is only
 * counted. The system is pure logic: no Phaser, no DOM.
 */
export class FindSystem {
  /** Swings since the last find. */
  private swingsSince = 0;
  /** Counter that makes every item id unique. */
  private counter = 0;

  /** Swings since the last find (the cooldown counter). */
  get swingsSinceLast(): number {
    return this.swingsSince;
  }

  /**
   * Call once per swing that is allowed to find something. At most ONE find per
   * swing. Returns the def that was found, or null.
   *
   * @param layerIndex 0 based layer index.
   * @param rng random source, defaults to Math.random.
   * @param hasFound tells whether the player already found a def (used for the
   *        new-find bonus on collection items). Optional.
   */
  roll(layerIndex: number, rng: () => number = Math.random, hasFound?: (defId: string) => boolean): FindDef | null {
    this.swingsSince++;
    if (this.swingsSince < FIND_CONFIG.minSwingsBetweenFinds) return null;

    const layer = clampLayer(layerIndex);
    const mult = FIND_CONFIG.layerMult;
    const base = FIND_CONFIG.chancePerSwing;

    const chances: { category: FindCategory; chance: number }[] = [
      { category: 'artifact', chance: base.artifact * mult.artifact[layer] },
      { category: 'collection', chance: base.collection * mult.collection[layer] },
      { category: 'junk', chance: base.junk * mult.junk[layer] },
    ];

    // Only categories with something to offer at this depth may happen.
    const usable = chances.filter((c) => c.chance > 0 && this.pool(c.category, layer).length > 0);
    if (usable.length === 0) return null;

    const total = usable.reduce((sum, c) => sum + c.chance, 0);
    if (rng() >= total) return null;

    // Second roll: which category, in proportion to its chance.
    let pick = rng() * total;
    let category: FindCategory = usable[usable.length - 1].category;
    for (const c of usable) {
      pick -= c.chance;
      if (pick < 0) {
        category = c.category;
        break;
      }
    }

    const def = this.pickDef(category, layer, rng, hasFound);
    if (!def) return null;
    this.swingsSince = 0;
    return def;
  }

  /**
   * Builds the concrete item: rolls the condition (artifacts only) and the
   * value = random in def.value * condition.valueMult * valueMult, rounded,
   * at least 1 for artifacts and exactly 0 for everything else.
   */
  makeItem(def: FindDef, rng: () => number = Math.random, valueMult = 1): FindItem {
    const item: FindItem = {
      id: `find-${++this.counter}`,
      defId: def.id,
      category: def.category,
      condition: 'good',
      value: 0,
    };
    if (def.category !== 'artifact') return item;

    item.condition = this.rollCondition(rng);
    const range = def.value ?? [0, 0];
    const raw = range[0] + rng() * (range[1] - range[0]);
    const mult = Number.isFinite(valueMult) && valueMult > 0 ? valueMult : 1;
    item.value = Math.max(1, Math.round(raw * CONDITIONS[item.condition].valueMult * mult));
    return item;
  }

  /** Clears the swing cooldown counter. */
  reset(): void {
    this.swingsSince = 0;
  }

  // ---------- internals ----------

  private rollCondition(rng: () => number): ConditionId {
    let total = 0;
    for (const id of CONDITION_IDS) total += CONDITIONS[id].weight;
    let roll = rng() * total;
    for (const id of CONDITION_IDS) {
      roll -= CONDITIONS[id].weight;
      if (roll < 0) return id;
    }
    return 'good';
  }

  /** Every def of a category that can appear at this layer. */
  private pool(category: FindCategory, layer: number): FindDef[] {
    return FINDS.filter((f) => f.category === category && this.canAppear(f, layer));
  }

  private canAppear(def: FindDef, layer: number): boolean {
    if (def.minLayer > layer) return false;
    if (def.maxLayer !== undefined && layer > def.maxLayer) return false;
    return true;
  }

  /** Tier by the layer's odds, then a def by weight inside that tier. */
  private pickDef(
    category: FindCategory,
    layer: number,
    rng: () => number,
    hasFound?: (defId: string) => boolean,
  ): FindDef | null {
    const odds = FIND_CONFIG.tierOdds[Math.min(FIND_CONFIG.tierOdds.length - 1, Math.floor(layer / 2))];
    let total = 0;
    for (const w of odds) total += w;
    let roll = rng() * total;
    let tier = 0;
    for (let i = 0; i < odds.length; i++) {
      roll -= odds[i];
      if (roll < 0) {
        tier = i;
        break;
      }
    }

    // A tier with nothing available falls back to the nearest tier that has
    // something: lower first (as the odds suggest), higher only when the
    // rolled tier was the lowest one on offer.
    const available = this.pool(category, layer);
    if (available.length === 0) return null;
    const tiers = Array.from(new Set(available.map((f) => f.tier))).sort((a, b) => a - b);
    if (!tiers.includes(tier)) {
      const lower = tiers.filter((t) => t < tier);
      tier = lower.length > 0 ? lower[lower.length - 1] : tiers[0];
    }
    const pool = available.filter((f) => f.tier === tier);
    if (pool.length === 0) return null;

    // New collection items are boosted so the collection fills up.
    const weights = pool.map((f) => {
      let w = Math.max(0, f.weight);
      if (f.category === 'collection' && hasFound && !hasFound(f.id)) w *= FIND_CONFIG.newFindBonus;
      return w;
    });
    let sum = 0;
    for (const w of weights) sum += w;
    if (sum <= 0) return pool[0];

    let r = rng() * sum;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}

/**
 * Everything the player has dug up: artifacts waiting to be sold, the
 * collection record and the junk tally. No money is ever created here.
 */
export class FindsInventory {
  /** Artifacts waiting to be sold. */
  readonly artifacts: FindItem[] = [];
  /** How many of each collection def has been found. */
  private readonly collection = new Map<string, number>();
  /** How many of each junk def has been found. */
  private readonly junk = new Map<string, number>();

  /** Stores an artifact. Non-artifacts are ignored. */
  addArtifact(item: FindItem): void {
    if (!item || item.category !== 'artifact') return;
    this.artifacts.push({ ...item });
  }

  /** Removes an artifact and returns its value (0 when the id is unknown). */
  sellArtifact(id: string): number {
    const index = this.artifacts.findIndex((a) => a.id === id);
    if (index < 0) return 0;
    const item = this.artifacts.splice(index, 1)[0];
    return item.value > 0 ? item.value : 0;
  }

  /** Sells every artifact and returns the total. */
  sellAllArtifacts(): number {
    let total = 0;
    for (const item of this.artifacts) total += item.value > 0 ? item.value : 0;
    this.artifacts.length = 0;
    return total;
  }

  /** Total value currently held in artifacts. */
  get artifactValue(): number {
    let total = 0;
    for (const item of this.artifacts) total += item.value > 0 ? item.value : 0;
    return total;
  }

  /**
   * Records a collection find.
   * @returns whether it was the first time and the new count for that def.
   */
  recordCollection(defId: string): { first: boolean; newCount: number } {
    const def = FIND_BY_ID[defId];
    if (!def || def.category !== 'collection') return { first: false, newCount: 0 };
    const count = (this.collection.get(defId) ?? 0) + 1;
    this.collection.set(defId, count);
    return { first: count === 1, newCount: count };
  }

  /** How many of this collection def has been found. */
  collectionCount(defId: string): number {
    return this.collection.get(defId) ?? 0;
  }

  /** Total number of collection finds (all defs). */
  get collectionFound(): number {
    let total = 0;
    for (const n of this.collection.values()) total += n;
    return total;
  }

  /** How many different collection defs exist in the catalogue. */
  get collectionTotal(): number {
    let total = 0;
    for (const f of FINDS) if (f.category === 'collection') total++;
    return total;
  }

  /** How many different collection defs the player has found. */
  get collectionUnique(): number {
    let total = 0;
    for (const n of this.collection.values()) if (n > 0) total++;
    return total;
  }

  /** Records a junk find. */
  recordJunk(defId: string): void {
    const def = FIND_BY_ID[defId];
    if (!def || def.category !== 'junk') return;
    this.junk.set(defId, (this.junk.get(defId) ?? 0) + 1);
  }

  /** How many of this junk def has been found. */
  junkCount(defId: string): number {
    return this.junk.get(defId) ?? 0;
  }

  /** Total number of junk pieces found. */
  get junkTotal(): number {
    let total = 0;
    for (const n of this.junk.values()) total += n;
    return total;
  }

  /** Plain data for saving. */
  toSave(): FindsSave {
    return {
      artifacts: this.artifacts.map((a) => ({ ...a })),
      collection: Object.fromEntries(this.collection),
      junk: Object.fromEntries(this.junk),
    };
  }

  /**
   * Restores from saved data. Missing, broken or unknown entries are ignored
   * and clamped, so an old or corrupted save can never break the game.
   */
  restore(data?: Partial<FindsSave>): void {
    this.reset();
    if (!data || typeof data !== 'object') return;

    const seen = new Set<string>();
    const artifacts: FindItem[] = [];
    if (Array.isArray(data.artifacts)) {
      for (const raw of data.artifacts) {
        if (!raw || typeof raw !== 'object') continue;
        const def = FIND_BY_ID[raw.defId];
        if (!def || def.category !== 'artifact') continue;
        const condition = isConditionId(raw.condition) ? raw.condition : 'good';
        const value = Number.isFinite(raw.value) ? Math.max(0, Math.min(999999, Math.floor(raw.value))) : 0;
        let id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : '';
        if (!id || seen.has(id)) id = `restored-${seen.size + 1}`;
        seen.add(id);
        artifacts.push({ id, defId: def.id, category: 'artifact', condition, value });
      }
    }
    this.artifacts.push(...artifacts);

    this.restoreCounts(this.collection, data.collection, 'collection');
    this.restoreCounts(this.junk, data.junk, 'junk');
  }

  /** Clears everything. */
  reset(): void {
    this.artifacts.length = 0;
    this.collection.clear();
    this.junk.clear();
  }

  private restoreCounts(target: Map<string, number>, source: unknown, category: FindCategory): void {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      const def = FIND_BY_ID[key];
      if (!def || def.category !== category) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) continue;
      target.set(key, Math.min(MAX_COUNT, Math.floor(n)));
    }
  }
}
