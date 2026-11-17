import { COMBAT, SLIME, UPGRADE_MAX_LEVEL } from '../config';

export type UpgradeId = 'power' | 'splat' | 'duration';

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  detail: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', title: 'POWER', detail: 'Launch speed +16%' },
  { id: 'splat', title: 'SPLAT SIZE', detail: 'Impact radius +30%' },
  { id: 'duration', title: 'DURATION', detail: 'Slime and puddles last +40%' },
];

/** Wave, score and upgrade state. Gameplay values are derived from upgrade levels. */
export class Progression {
  readonly levels: Record<UpgradeId, number> = { power: 0, splat: 0, duration: 0 };
  wave = 1;
  score = 0;
  kills = 0;

  get launchMultiplier(): number {
    return 1 + SLIME.powerPerLevel * this.levels.power;
  }

  get splatRadius(): number {
    return SLIME.splatBase * (1 + SLIME.splatPerLevel * this.levels.splat);
  }

  get coatDuration(): number {
    return SLIME.coatBase * (1 + SLIME.durationPerLevel * this.levels.duration);
  }

  get puddleLife(): number {
    return SLIME.puddleBase * (1 + SLIME.durationPerLevel * this.levels.duration);
  }

  /** Enemies in a wave: one, then ramping to three. */
  enemyCount(): number {
    return Math.min(1 + Math.floor((this.wave - 1) / 2), 3);
  }

  enemyHp(): number {
    return COMBAT.enemyBaseHp + COMBAT.enemyHpPerWave * (this.wave - 1);
  }

  killReward(): number {
    return 100 + 20 * this.wave;
  }

  canUpgrade(id: UpgradeId): boolean {
    return this.levels[id] < UPGRADE_MAX_LEVEL;
  }

  upgrade(id: UpgradeId): void {
    if (this.canUpgrade(id)) this.levels[id]++;
  }

  reset(): void {
    this.levels.power = 0;
    this.levels.splat = 0;
    this.levels.duration = 0;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
  }
}
