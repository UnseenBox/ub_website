import { describe, expect, it } from 'vitest';
import {
  UPGRADES, UPGRADE_BY_ID, affordableUpgrades, buyUpgrade, cheapestUpgrade, isUpgradeMaxed, maxHealthBonus,
  nextUpgradeCost, nextUpgradeEffect, upgradeCooldownMultiplier, upgradeDamageMultiplier, upgradeEffect,
  upgradeLevel, upgradePetMultiplier, upgradePowerMultiplier, upgradePowerRadiusMultiplier,
  upgradeScoreMultiplier, upgradeScrapMultiplier, upgradeSpeedMultiplier,
  type UpgradeState,
} from './Upgrades';

function state(overrides: Partial<UpgradeState> = {}): UpgradeState {
  return { scrap: 10000, upgrades: {}, ...overrides };
}

describe('Upgrades', () => {
  it('leads with the four that change a fight: hearts, damage, speed, power', () => {
    expect(UPGRADES.map((u) => u.id)).toEqual(['door', 'damage', 'speed', 'power', 'cooldown', 'scrap', 'pet', 'score']);
    expect(UPGRADES.map((u) => u.name).slice(0, 4)).toEqual(['EXTRA HEART', 'HEAVY ARM', 'FAST FEET', 'BIGGER BOOM']);
    for (const u of UPGRADES) {
      expect(u.costs, u.id).toHaveLength(u.maxLevel);
      // every next level costs more than the last
      for (let i = 1; i < u.costs.length; i++) expect(u.costs[i]!, u.id).toBeGreaterThan(u.costs[i - 1]!);
      expect(u.blurb.length, u.id).toBeGreaterThan(0);
    }
    expect(UPGRADE_BY_ID.pet.icon).toBe('pet');
  });

  it('the first upgrade costs about one room of coins', () => {
    const cheapest = cheapestUpgrade(state({ scrap: 0 }));
    expect(cheapest).toEqual({ id: 'damage', cost: 100 });
  });

  it('clamps levels and reports the next cost/effect', () => {
    const save = state({ upgrades: { door: 1, scrap: 4, damage: 99 } });
    expect(upgradeLevel(save, 'door')).toBe(1);
    expect(upgradeLevel(save, 'damage')).toBe(8);
    expect(isUpgradeMaxed(save, 'door')).toBe(false);
    expect(nextUpgradeCost(save, 'door')).toBe(450);
    expect(isUpgradeMaxed(save, 'scrap')).toBe(true);
    expect(nextUpgradeCost(save, 'scrap')).toBeNull();
    expect(upgradeEffect(save, 'door')).toBe('+1 MAX HEART');
    expect(nextUpgradeEffect(save, 'door')).toBe('+1 MAX HEART');
    expect(upgradeEffect(save, 'scrap')).toBe('+40% COINS');
    expect(upgradeEffect(save, 'damage')).toBe('+96% THROW DAMAGE');
  });

  it('buys once, deducts coins, and refuses without mutating', () => {
    const save = state({ scrap: 300 });
    expect(buyUpgrade(save, 'door')).toBe('');
    expect(save.scrap).toBe(120);
    expect(save.upgrades.door).toBe(1);
    expect(buyUpgrade(save, 'door')).toBe('NEEDS 450 COINS');
    expect(save.scrap).toBe(120);
    expect(save.upgrades.door).toBe(1);
  });

  it('never takes coins below zero and reports maxed/unknown', () => {
    const save = state({ scrap: 0, upgrades: { door: 5 } });
    expect(buyUpgrade(save, 'door')).toBe('MAXED');
    expect(save.scrap).toBe(0);
    expect(buyUpgrade(save, 'nope' as never)).toBe('UNKNOWN UPGRADE');
    expect(save.scrap).toBe(0);
  });

  it('counts how many upgrades the purse can buy now', () => {
    expect(affordableUpgrades(state({ scrap: 0 }))).toBe(0);
    expect(affordableUpgrades(state({ scrap: 100 }))).toBe(1);
    expect(affordableUpgrades(state({ scrap: 180 }))).toBe(4);
  });

  it('applies the exact multipliers and max-heart bonus', () => {
    const save = state({ upgrades: { door: 2, damage: 3, speed: 2, power: 1, scrap: 4, cooldown: 4, score: 4, pet: 4 } });
    expect(maxHealthBonus(save)).toBe(2);
    expect(upgradeDamageMultiplier(save)).toBeCloseTo(1.36, 10);
    expect(upgradeSpeedMultiplier(save)).toBeCloseTo(1.12, 10);
    expect(upgradePowerMultiplier(save)).toBeCloseTo(1.2, 10);
    expect(upgradePowerRadiusMultiplier(save)).toBeCloseTo(1.08, 10);
    expect(upgradeScrapMultiplier(save)).toBeCloseTo(1.4, 10);
    expect(upgradeCooldownMultiplier(save)).toBeCloseTo(0.93 ** 4, 10);
    expect(upgradeScoreMultiplier(save)).toBeCloseTo(1.2, 10);
    expect(upgradePetMultiplier(save)).toBeCloseTo(1.48, 10);
  });

  it('an old save with the two-level door track keeps its hearts', () => {
    expect(maxHealthBonus(state({ upgrades: { door: 2 } }))).toBe(2);
  });
});
