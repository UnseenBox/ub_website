import { BOOST_COSTS, type Boost } from '../abilities/Cards';

/**
 * The store's shot upgrades. Each has three levels bought with Kora Coins. They apply to the player's
 * own shots in the campaign; the tutorial lessons, the duels and the level tests always use plain shots,
 * so every match stays solvable without them and a lesson's demonstrated shot still lands.
 */
export type UpgradeId = 'power' | 'curl' | 'aim';

export const UPGRADE_MAX = 3;

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What one level does, in a few words. */
  hint: string;
  /** Price of levels 1, 2 and 3. */
  prices: readonly [number, number, number];
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'power', name: 'POWER', hint: 'SHOTS FLY FASTER', prices: [60, 140, 260] },
  { id: 'curl', name: 'CURL', hint: 'BEND IT FURTHER', prices: [60, 140, 260] },
  { id: 'aim', name: 'AIM GUIDE', hint: 'A LONGER AIM LINE', prices: [40, 100, 200] },
];

export type UpgradeLevels = Record<UpgradeId, number>;

export const noUpgrades = (): UpgradeLevels => ({ power: 0, curl: 0, aim: 0 });

const level = (n: number): number => Math.max(0, Math.min(UPGRADE_MAX, Math.floor(n)));

/** Shot speed multiplier: +4% a level, so a full POWER shot is 12% quicker. */
export const powerScale = (n: number): number => 1 + 0.04 * level(n);
/** Bend strength multiplier: +15% a level. */
export const curlScale = (n: number): number => 1 + 0.15 * level(n);
/** How much further the aim line reaches: +35% a level. */
export const aimScale = (n: number): number => 1 + 0.35 * level(n);

/** The price of the next level, or null once it is maxed. */
export function nextPrice(id: UpgradeId, current: number): number | null {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || current >= UPGRADE_MAX) return null;
  return def.prices[level(current)];
}

/** Abilities come singly at the shop price, or in a pack of five for the price of four. */
export const PACK_SIZE = 5;
export const abilityPrice = (id: Boost, count: number): number => (count >= PACK_SIZE ? BOOST_COSTS[id] * (PACK_SIZE - 1) : BOOST_COSTS[id] * count);
