import { powerMult } from '../data/deposits';
import { UPGRADE_EFFECTS, type ToolDef } from '../data/tools';

/**
 * The one place where store upgrades turn into digging numbers. GameState uses these for the
 * live game, and the dev simulations import the same functions, so the two cannot drift apart.
 */

/** Upgrade level by store id. */
export type LevelOf = (upgradeId: string) => number;

export interface StaminaUpgrades {
  maxBonus: number;
  regenBonus: number;
  costMult: number;
}

export function staminaUpgrades(levelOf: LevelOf): StaminaUpgrades {
  return {
    maxBonus: levelOf('up-stamina-tank') * UPGRADE_EFFECTS.staminaPerLevel,
    regenBonus: levelOf('up-stamina-regen') * UPGRADE_EFFECTS.regenPerLevel,
    costMult: 1 - levelOf('up-stamina-efficiency') * UPGRADE_EFFECTS.costReductionPerLevel,
  };
}

/** The base tool with the digging upgrades (Digging Damage, Swing Speed, Master Digger) and the deposit's power applied. */
export function toolWithUpgrades(base: ToolDef, levelOf: LevelOf, deposit: number): ToolDef {
  const experience = powerMult(deposit) * (1 + UPGRADE_EFFECTS.masteryPerLevel * levelOf('up-mastery'));
  return {
    ...base,
    power: base.power * experience,
    digDepth: base.digDepth * (1 + UPGRADE_EFFECTS.digDepthPerLevel * levelOf('up-dig-damage')),
    swingCooldownMs: base.swingCooldownMs * (1 - UPGRADE_EFFECTS.cooldownReductionPerLevel * levelOf('up-dig-speed')),
  };
}
