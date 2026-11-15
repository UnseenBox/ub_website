import { GAME_CONFIG } from '../config/GameConfig';
import { EXTERIORS } from '../data/exteriors';
import { EXTERIOR_HINT_CHANCE, MINERALS, type MineralDef } from '../data/minerals';
import { RARITIES, type RarityId } from '../data/rarities';
import { pick, range, weightedPick, type Rng } from '../core/Random';
import type { Rock } from '../core/types';

const mineralsByRarity = new Map<RarityId, MineralDef[]>();
for (const mineral of MINERALS) {
  const list = mineralsByRarity.get(mineral.rarity) ?? [];
  list.push(mineral);
  mineralsByRarity.set(mineral.rarity, list);
}

/** Position of each rarity inside RARITIES: the index used by layer weights. */
const rarityIndex = new Map<RarityId, number>(RARITIES.map((r, i) => [r.id, i]));

let nextId = 1;

/** True when the mineral may appear in the given layer. */
export function isAvailableAt(mineral: MineralDef, layerIndex: number): boolean {
  const min = mineral.minLayer ?? 0;
  if (layerIndex < min) return false;
  if (mineral.maxLayer !== undefined && layerIndex > mineral.maxLayer) return false;
  return true;
}

/**
 * Every mineral that can be found in a layer. Minerals gated to a deeper layer
 * are not listed; minerals whose window has closed are not listed either.
 */
export function mineralsForLayer(layerIndex: number): readonly MineralDef[] {
  return MINERALS.filter((m) => isAvailableAt(m, layerIndex));
}

/** Minerals of one rarity that qualify for the layer, with a sensible fallback. */
function poolFor(rarity: RarityId, layerIndex: number): MineralDef[] {
  const all = mineralsByRarity.get(rarity) ?? [];
  const exact = all.filter((m) => isAvailableAt(m, layerIndex));
  if (exact.length > 0) return exact;
  // Too deep for this rarity's window: ignore the upper bound before giving up.
  const deeper = all.filter((m) => (m.minLayer ?? 0) <= layerIndex);
  if (deeper.length > 0) return deeper;
  // Nothing reaches this layer: use the shallowest minerals of the rarity.
  const minLayer = all.reduce((lowest, m) => Math.min(lowest, m.minLayer ?? 0), Number.MAX_SAFE_INTEGER);
  return all.filter((m) => (m.minLayer ?? 0) === minLayer);
}

/**
 * Rolls a new rock. Rarity is rolled first (weighted), then a mineral of that
 * rarity that fits the layer. The exterior is picked independently, so the
 * outside never reliably reveals the inside; a mineral's own exteriors are
 * used as a weak hint. Sparkly exteriors are only a weak, rarity-skewed hint.
 */
export function generateRock(
  rng: Rng = Math.random,
  rarityWeights?: readonly number[],
  valueMult = 1,
  layerIndex = 0,
): Rock {
  // Layers can bend the odds; without overrides the global rarity weights apply.
  const rarity = weightedPick(rng, RARITIES, (r) => {
    const index = rarityIndex.get(r.id) ?? 0;
    return rarityWeights?.[index] ?? r.weight;
  });
  const pool = poolFor(rarity.id, layerIndex);
  if (pool.length === 0) throw new Error(`No minerals defined for rarity "${rarity.id}"`);
  const mineral = weightedPick(rng, pool, (m) => m.weight);

  // The mineral's own exteriors are only a hint, never a promise.
  const hints = (mineral.exteriors ?? [])
    .map((id) => EXTERIORS.find((e) => e.id === id))
    .filter((e): e is (typeof EXTERIORS)[number] => e !== undefined);
  const exterior = hints.length > 0 && rng() < EXTERIOR_HINT_CHANCE ? pick(rng, hints) : pick(rng, EXTERIORS);

  const { minSize, maxSize } = GAME_CONFIG.rock;
  const size = range(rng, minSize, maxSize);
  const sizeBonus = 0.85 + 0.3 * ((size - minSize) / (maxSize - minSize));
  const value = rarity.id === 'worthless'
    ? 0
    : Math.max(1, Math.round(range(rng, mineral.value[0], mineral.value[1]) * sizeBonus * valueMult));

  return {
    id: `rock${nextId++}`,
    seed: Math.floor(rng() * 2147483647),
    exterior,
    mineral,
    rarity,
    size,
    value,
    sparkly: rng() < rarity.sparkleChance,
    cut: false,
  };
}

export function sizeLabel(size: number): string {
  const { minSize, maxSize } = GAME_CONFIG.rock;
  const t = (size - minSize) / (maxSize - minSize);
  if (t < 0.33) return 'Small';
  if (t < 0.7) return 'Medium';
  return 'Large';
}
