import { GAME_CONFIG } from '../config/GameConfig';
import { EXTERIORS } from '../data/exteriors';
import { MINERALS, type MineralDef } from '../data/minerals';
import { RARITIES, type RarityId } from '../data/rarities';
import { pick, range, weightedPick, type Rng } from '../core/Random';
import type { Rock } from '../core/types';

const mineralsByRarity = new Map<RarityId, MineralDef[]>();
for (const mineral of MINERALS) {
  const list = mineralsByRarity.get(mineral.rarity) ?? [];
  list.push(mineral);
  mineralsByRarity.set(mineral.rarity, list);
}

let nextId = 1;

/**
 * Rolls a new rock. Rarity is rolled first (weighted), then a mineral of that
 * rarity. The exterior is picked independently, so the outside never reliably
 * reveals the inside. Sparkly exteriors are only a weak, rarity-skewed hint.
 */
export function generateRock(rng: Rng = Math.random, rarityWeights?: readonly number[]): Rock {
  // Layers can bend the odds; without overrides the global rarity weights apply.
  const rarity = weightedPick(rng, RARITIES, (r) => rarityWeights?.[r.tier] ?? r.weight);
  const pool = mineralsByRarity.get(rarity.id);
  if (!pool || pool.length === 0) throw new Error(`No minerals defined for rarity "${rarity.id}"`);
  const mineral = weightedPick(rng, pool, (m) => m.weight);
  const exterior = pick(rng, EXTERIORS);

  const { minSize, maxSize } = GAME_CONFIG.rock;
  const size = range(rng, minSize, maxSize);
  const sizeBonus = 0.85 + 0.3 * ((size - minSize) / (maxSize - minSize));
  const value = Math.max(1, Math.round(range(rng, mineral.value[0], mineral.value[1]) * sizeBonus));

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
