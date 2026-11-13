/**
 * Permanent upgrades, bought with coins between rooms. Coins come from every gnome you knock
 * out, and a lost room still pays what you knocked out, so a room that beats you is never a
 * waste: you come back stronger. Ids are stored in saves: never rename one, only append.
 * ('door' is the hearts track and 'scrap' the coin track: kept for old saves.)
 */
export type UpgradeId = 'door' | 'damage' | 'speed' | 'power' | 'cooldown' | 'scrap' | 'pet' | 'score';

export interface UpgradeState {
  scrap: number;
  upgrades: Record<string, number>;
}

/** Kit icon key; the store maps it to an imported image. */
export type UpgradeIcon = 'heart' | 'pan' | 'slipper' | 'bolt' | 'key' | 'coin' | 'dash' | 'trophy' | 'pet';

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly name: string;
  /** One line under the name: what it is for. */
  readonly blurb: string;
  readonly maxLevel: number;
  readonly costs: readonly number[];
  readonly icon: UpgradeIcon;
}

const DEFS: readonly UpgradeDefinition[] = [
  { id: 'door', name: 'EXTRA HEART', blurb: 'take one more hit', maxLevel: 5, costs: [180, 450, 900, 1600, 2800], icon: 'heart' },
  { id: 'damage', name: 'HEAVY ARM', blurb: 'everything you throw hits harder', maxLevel: 8, costs: [100, 220, 400, 650, 1000, 1500, 2200, 3200], icon: 'pan' },
  { id: 'speed', name: 'FAST FEET', blurb: 'run and dodge faster', maxLevel: 5, costs: [120, 300, 600, 1000, 1600], icon: 'slipper' },
  { id: 'power', name: 'BIGGER BOOM', blurb: 'your Powers hit harder and wider', maxLevel: 5, costs: [150, 380, 750, 1300, 2100], icon: 'bolt' },
  { id: 'cooldown', name: 'LIGHT FINGERS', blurb: 'Powers come back sooner', maxLevel: 4, costs: [250, 750, 1800, 4000], icon: 'dash' },
  { id: 'scrap', name: 'COIN MAGNET', blurb: 'more coins from every gnome', maxLevel: 4, costs: [200, 600, 1500, 3500], icon: 'coin' },
  { id: 'pet', name: 'PET TRAINING', blurb: 'your pet bites harder', maxLevel: 4, costs: [240, 700, 1600, 3800], icon: 'pet' },
  { id: 'score', name: 'CROWD WORK', blurb: 'more score from everything', maxLevel: 4, costs: [220, 650, 1500, 3500], icon: 'trophy' },
];

export const UPGRADES: readonly UpgradeDefinition[] = DEFS;

export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDefinition> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDefinition>;

/** Per level. */
const DAMAGE_STEP = 0.12;
const SPEED_STEP = 0.06;
const POWER_STEP = 0.2;
const POWER_RADIUS_STEP = 0.08;

/** Stored level for a track, floored, clamped and never negative. */
export function upgradeLevel(save: UpgradeState, id: UpgradeId): number {
  const def: UpgradeDefinition | undefined = UPGRADE_BY_ID[id];
  if (!def) return 0;
  const raw = save.upgrades?.[id];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.min(Math.max(0, Math.floor(raw)), def.maxLevel);
}

export function isUpgradeMaxed(save: UpgradeState, id: UpgradeId): boolean {
  const def: UpgradeDefinition | undefined = UPGRADE_BY_ID[id];
  if (!def) return false;
  return upgradeLevel(save, id) >= def.maxLevel;
}

export function nextUpgradeCost(save: UpgradeState, id: UpgradeId): number | null {
  const def: UpgradeDefinition | undefined = UPGRADE_BY_ID[id];
  if (!def) return null;
  const level = upgradeLevel(save, id);
  if (level >= def.maxLevel) return null;
  return def.costs[level] ?? null;
}

/** The cheapest upgrade that is not maxed, or null when everything is bought. */
export function cheapestUpgrade(save: UpgradeState): { id: UpgradeId; cost: number } | null {
  let best: { id: UpgradeId; cost: number } | null = null;
  for (const def of UPGRADES) {
    const cost = nextUpgradeCost(save, def.id);
    if (cost !== null && (!best || cost < best.cost)) best = { id: def.id, cost };
  }
  return best;
}

/** How many upgrades the current coins would buy right now (one level each). */
export function affordableUpgrades(save: UpgradeState): number {
  let n = 0;
  for (const def of UPGRADES) {
    const cost = nextUpgradeCost(save, def.id);
    if (cost !== null && save.scrap >= cost) n++;
  }
  return n;
}

export function upgradeEffect(save: UpgradeState, id: UpgradeId): string {
  const level = upgradeLevel(save, id);
  switch (id) {
    case 'door':
      return level === 0 ? 'NO EXTRA HEARTS YET' : `+${level} MAX HEART${level === 1 ? '' : 'S'}`;
    case 'damage':
      return `+${Math.round(DAMAGE_STEP * 100 * level)}% THROW DAMAGE`;
    case 'speed':
      return `+${Math.round(SPEED_STEP * 100 * level)}% MOVE SPEED`;
    case 'power':
      return `+${Math.round(POWER_STEP * 100 * level)}% POWER DAMAGE`;
    case 'scrap':
      return `+${10 * level}% COINS`;
    case 'cooldown':
      return `-${Math.round((1 - 0.93 ** level) * 100)}% POWER COOLDOWN`;
    case 'score':
      return `+${5 * level}% SCORE`;
    case 'pet':
      return `+${12 * level}% PET DAMAGE`;
    default:
      return '';
  }
}

export function nextUpgradeEffect(save: UpgradeState, id: UpgradeId): string {
  if (isUpgradeMaxed(save, id)) return 'MAXED';
  switch (id) {
    case 'door':
      return '+1 MAX HEART';
    case 'damage':
      return `+${Math.round(DAMAGE_STEP * 100)}% THROW DAMAGE`;
    case 'speed':
      return `+${Math.round(SPEED_STEP * 100)}% MOVE SPEED`;
    case 'power':
      return `+${Math.round(POWER_STEP * 100)}% POWER DAMAGE, WIDER`;
    case 'scrap':
      return '+10% COINS';
    case 'cooldown':
      return '-7% POWER COOLDOWN';
    case 'score':
      return '+5% SCORE';
    case 'pet':
      return '+12% PET DAMAGE';
    default:
      return '';
  }
}

/** '' on success, otherwise a short reason the UI can show. */
export function buyUpgrade(save: UpgradeState, id: UpgradeId): string {
  const def: UpgradeDefinition | undefined = UPGRADE_BY_ID[id];
  if (!def) return 'UNKNOWN UPGRADE';
  const level = upgradeLevel(save, id);
  if (level >= def.maxLevel) return 'MAXED';
  const cost = def.costs[level];
  if (cost === undefined) return 'MAXED';
  // Negated comparison also rejects a NaN coin total, so coins can never go below zero.
  if (!(save.scrap >= cost)) return `NEEDS ${cost} COINS`;
  save.scrap -= cost;
  // A save parsed from an older build may lack the record entirely.
  save.upgrades ??= {};
  save.upgrades[id] = level + 1;
  return '';
}

export function maxHealthBonus(save: UpgradeState): number {
  return upgradeLevel(save, 'door');
}

export function upgradeDamageMultiplier(save: UpgradeState): number {
  return 1 + DAMAGE_STEP * upgradeLevel(save, 'damage');
}

export function upgradeSpeedMultiplier(save: UpgradeState): number {
  return 1 + SPEED_STEP * upgradeLevel(save, 'speed');
}

export function upgradePowerMultiplier(save: UpgradeState): number {
  return 1 + POWER_STEP * upgradeLevel(save, 'power');
}

export function upgradePowerRadiusMultiplier(save: UpgradeState): number {
  return 1 + POWER_RADIUS_STEP * upgradeLevel(save, 'power');
}

export function upgradeScrapMultiplier(save: UpgradeState): number {
  return 1 + 0.1 * upgradeLevel(save, 'scrap');
}

export function upgradeCooldownMultiplier(save: UpgradeState): number {
  return 0.93 ** upgradeLevel(save, 'cooldown');
}

export function upgradeScoreMultiplier(save: UpgradeState): number {
  return 1 + 0.05 * upgradeLevel(save, 'score');
}

export function upgradePetMultiplier(save: UpgradeState): number {
  return 1 + 0.12 * upgradeLevel(save, 'pet');
}
