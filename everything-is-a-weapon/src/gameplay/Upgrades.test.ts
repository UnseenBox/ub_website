import { describe, expect, it } from 'vitest';
import { ABILITIES } from './Abilities';
import {
  UPGRADES, UPGRADE_BY_ID, buyUpgrade, isUpgradeMaxed, maxHealthBonus,
  nextUpgradeCost, nextUpgradeEffect, upgradeCooldownMultiplier, upgradeEffect,
  upgradeLevel, upgradePetMultiplier, upgradeScrapMultiplier, upgradeScoreMultiplier,
  type UpgradeState,
} from './Upgrades';

function state(overrides: Partial<UpgradeState> = {}): UpgradeState {
  return { scrap: 10000, upgrades: {}, ...overrides };
}

describe('Upgrades', () => {
  it('defines five tracks with the exact names, caps and costs', () => {
    expect(UPGRADES.map((u) => [u.id, u.name, u.maxLevel, u.costs])).toEqual([
      ['door', 'REINFORCED DOOR', 2, [400, 1600]],
      ['scrap', 'SCRAP SENSE', 4, [200, 600, 1500, 3500]],
      ['cooldown', 'LIGHT FINGERS', 4, [250, 750, 1800, 4000]],
      ['score', 'CROWD WORK', 4, [220, 650, 1500, 3500]],
      ['pet', 'PET TRAINING', 4, [240, 700, 1600, 3800]],
    ]);
    expect(UPGRADE_BY_ID.pet.icon).toBe('pet');
  });

  it('the whole catalog plus the three powers costs 27,200 scrap', () => {
    const upgrades = UPGRADES.flatMap((u) => u.costs).reduce((a, b) => a + b, 0);
    const powers = ABILITIES.map((a) => a.cost).reduce((a, b) => a + b, 0);
    expect(upgrades).toBe(26810);
    expect(upgrades + powers).toBe(27200);
  });

  it('clamps levels and reports the next cost/effect', () => {
    const save = state({ upgrades: { door: 1, scrap: 4 } });
    expect(upgradeLevel(save, 'door')).toBe(1);
    expect(upgradeLevel(save, 'scrap')).toBe(4);
    expect(isUpgradeMaxed(save, 'door')).toBe(false);
    expect(nextUpgradeCost(save, 'door')).toBe(1600);
    expect(isUpgradeMaxed(save, 'scrap')).toBe(true);
    expect(nextUpgradeCost(save, 'scrap')).toBeNull();
    expect(upgradeEffect(save, 'door')).toBe('6 MAX HEARTS');
    expect(nextUpgradeEffect(save, 'door')).toBe('+1 MAX HEART');
    expect(upgradeEffect(save, 'scrap')).toBe('+40% SCRAP FROM INTRUDERS');
  });

  it('buys once, deducts scrap, and refuses without mutating', () => {
    const save = state({ scrap: 500 });
    expect(buyUpgrade(save, 'door')).toBe('');
    expect(save.scrap).toBe(100);
    expect(save.upgrades.door).toBe(1);
    expect(buyUpgrade(save, 'door')).toBe('NEEDS 1600 SCRAP');
    expect(save.scrap).toBe(100);
    expect(save.upgrades.door).toBe(1);
  });

  it('never takes scrap below zero and reports maxed/unknown', () => {
    const save = state({ scrap: 0, upgrades: { door: 2 } });
    expect(buyUpgrade(save, 'door')).toBe('MAXED');
    expect(save.scrap).toBe(0);
    expect(buyUpgrade(save, 'nope' as never)).toBe('UNKNOWN UPGRADE');
    expect(save.scrap).toBe(0);
  });

  it('applies the exact multipliers and max-heart bonus', () => {
    const save = state({ upgrades: { door: 2, scrap: 4, cooldown: 4, score: 4, pet: 4 } });
    expect(upgradeScrapMultiplier(save)).toBeCloseTo(1.4, 10);
    expect(upgradeCooldownMultiplier(save)).toBeCloseTo(0.93 ** 4, 10);
    expect(upgradeScoreMultiplier(save)).toBeCloseTo(1.2, 10);
    expect(upgradePetMultiplier(save)).toBeCloseTo(1.48, 10);
    expect(maxHealthBonus(save)).toBe(2);
  });
});
