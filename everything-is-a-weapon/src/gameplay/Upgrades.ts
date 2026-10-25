export type UpgradeId = 'door' | 'scrap' | 'cooldown' | 'score' | 'pet';

export interface UpgradeState {
  scrap: number;
  upgrades: Record<string, number>;
}

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly name: string;
  readonly maxLevel: number;
  readonly costs: readonly number[];
  /** Existing kit icon key; the store maps it to an imported image. */
  readonly icon: 'key' | 'coin' | 'dash' | 'trophy' | 'pet';
}

const DEFS: readonly UpgradeDefinition[] = [
  { id: 'door', name: 'REINFORCED DOOR', maxLevel: 2, costs: [400, 1600], icon: 'key' },
  { id: 'scrap', name: 'SCRAP SENSE', maxLevel: 4, costs: [200, 600, 1500, 3500], icon: 'coin' },
  { id: 'cooldown', name: 'LIGHT FINGERS', maxLevel: 4, costs: [250, 750, 1800, 4000], icon: 'dash' },
  { id: 'score', name: 'CROWD WORK', maxLevel: 4, costs: [220, 650, 1500, 3500], icon: 'trophy' },
  { id: 'pet', name: 'PET TRAINING', maxLevel: 4, costs: [240, 700, 1600, 3800], icon: 'pet' },
];

export const UPGRADES: readonly UpgradeDefinition[] = DEFS;

export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDefinition> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDefinition>;

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

export function upgradeEffect(save: UpgradeState, id: UpgradeId): string {
  const level = upgradeLevel(save, id);
  switch (id) {
    case 'door':
      return `${5 + level} MAX HEARTS`;
    case 'scrap':
      return `+${10 * level}% SCRAP FROM INTRUDERS`;
    case 'cooldown':
      return `-${Math.round((1 - 0.93 ** level) * 100)}% ABILITY COOLDOWNS`;
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
    case 'scrap':
      return '+10% SCRAP';
    case 'cooldown':
      return '-7% ABILITY COOLDOWNS';
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
  // Negated comparison also rejects a NaN scrap total, so scrap can never go below zero.
  if (!(save.scrap >= cost)) return `NEEDS ${cost} SCRAP`;
  save.scrap -= cost;
  // A save parsed from an older build may lack the record entirely.
  save.upgrades ??= {};
  save.upgrades[id] = level + 1;
  return '';
}

export function maxHealthBonus(save: UpgradeState): number {
  return upgradeLevel(save, 'door');
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
