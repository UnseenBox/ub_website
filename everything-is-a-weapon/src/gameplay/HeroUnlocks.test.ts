import { expect, it } from 'vitest';
import { heroMet, newlyUnlocked, ownedHeroes, unlockRule } from './HeroUnlocks';
import { HEROES, heroPerk } from '../core/Hero';

const none = { deepest: 0, endlessBestFloor: 0, discoveries: 0 };

it('the tenant is free and every other hero has a rule', () => {
  expect(unlockRule('tenant')).toBeNull();
  expect(heroMet('tenant', none)).toBe(true);
  for (const hero of HEROES) if (hero.id !== 'tenant') expect(unlockRule(hero.id)).not.toBeNull();
});

it('each rule unlocks exactly at its target', () => {
  expect(heroMet('flatmate', { ...none, deepest: 2 })).toBe(false);
  expect(heroMet('flatmate', { ...none, deepest: 3 })).toBe(true);
  expect(heroMet('gran', { ...none, endlessBestFloor: 4 })).toBe(false);
  expect(heroMet('gran', { ...none, endlessBestFloor: 5 })).toBe(true);
  expect(heroMet('kid', { ...none, discoveries: 29 })).toBe(false);
  expect(heroMet('kid', { ...none, discoveries: 30 })).toBe(true);
});

it('newlyUnlocked reports only heroes not already owned', () => {
  const rich = { deepest: 5, endlessBestFloor: 9, discoveries: 40 };
  expect(newlyUnlocked(['tenant'], rich).sort()).toEqual(['flatmate', 'gran', 'kid']);
  expect(newlyUnlocked(['tenant', 'kid'], rich).sort()).toEqual(['flatmate', 'gran']);
  expect(newlyUnlocked(['tenant'], none)).toEqual([]);
});

it('ownedHeroes always keeps the tenant and drops junk', () => {
  expect(ownedHeroes([])).toEqual(['tenant']);
  expect(ownedHeroes(['gran', 'gran', 'wizard'])).toEqual(['tenant', 'gran']);
});

it('perks are small and real', () => {
  expect(heroPerk('tenant').extraHearts).toBe(0);
  expect(heroPerk('gran').extraHearts).toBe(1);
  expect(heroPerk('flatmate').speed).toBeGreaterThan(1);
  expect(heroPerk('kid').charge).toBeGreaterThan(1);
});
