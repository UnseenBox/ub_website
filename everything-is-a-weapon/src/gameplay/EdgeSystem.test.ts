import { describe, expect, it } from 'vitest';
import { EdgeSystem, type EdgeRunState } from './EdgeSystem';

function state(boosts: string[], streak = 0): EdgeRunState {
  return { runBoosts: boosts, runStreak: streak, runInsuranceUsed: false };
}

describe('EdgeSystem', () => {
  it('no edges are neutral', () => {
    const edges = new EdgeSystem(state([]));
    expect(edges.impactDamageMultiplier(1)).toBe(1);
    expect(edges.impactDamageMultiplier(4)).toBe(1);
    expect(edges.hazardDamageMultiplier()).toBe(1);
    expect(edges.headlineDamageMultiplier(true)).toBe(1);
    expect(edges.moveSpeedMultiplier()).toBe(1);
    expect(edges.dashSpeedMultiplier()).toBe(1);
    expect(edges.scoreMultiplier()).toBe(1);
    expect(edges.scrapMultiplier()).toBe(1);
    expect(edges.armorAtFloorStart()).toBe(0);
    expect(edges.petFrenzyMultiplier()).toBe(1);
    expect(edges.consumeInsurance()).toBe(false);
    expect(edges.consumeGlassCannon()).toBe(false);
  });

  it('heavy_hands stacks additively', () => {
    const edges = new EdgeSystem(state(['heavy_hands', 'heavy_hands']));
    expect(edges.impactDamageMultiplier(1)).toBe(1.5);
    expect(edges.impactDamageMultiplier(3)).toBe(1.5);
    expect(edges.hazardDamageMultiplier()).toBe(1.5);
  });

  it('chain_reaction only applies from link 2', () => {
    const edges = new EdgeSystem(state(['chain_reaction']));
    expect(edges.impactDamageMultiplier(1)).toBe(1);
    expect(edges.impactDamageMultiplier(2)).toBe(1.35);
    expect(edges.impactDamageMultiplier(3)).toBe(1.35);
  });

  it('quick_feet and glass_cannon stack and cap movement at 1.45', () => {
    expect(new EdgeSystem(state(['quick_feet'])).moveSpeedMultiplier()).toBeCloseTo(1.12);
    expect(new EdgeSystem(state(['quick_feet'])).dashSpeedMultiplier()).toBeCloseTo(1.2);
    expect(new EdgeSystem(state(['quick_feet', 'glass_cannon'])).moveSpeedMultiplier()).toBeCloseTo(1.37);
    expect(new EdgeSystem(state(['quick_feet', 'quick_feet', 'quick_feet', 'glass_cannon'])).moveSpeedMultiplier()).toBe(1.45);
  });

  it('crowd_pleaser scales with streak and caps at 3', () => {
    const edges = new EdgeSystem(state(['crowd_pleaser', 'crowd_pleaser'], 2));
    expect(edges.scoreMultiplier()).toBeCloseTo(1 + 2 * (0.25 + 0.10 * 2));
    expect(edges.scoreMultiplier(0)).toBeCloseTo(1.5);
    const capped = new EdgeSystem(state([
      'crowd_pleaser', 'crowd_pleaser', 'crowd_pleaser', 'crowd_pleaser',
    ], 2));
    expect(capped.scoreMultiplier(99)).toBe(3);
  });

  it('scrap_luck and magnate multiply scrap and reduce score', () => {
    const edges = new EdgeSystem(state(['scrap_luck', 'magnate']));
    expect(edges.scrapMultiplier()).toBeCloseTo(1.2 * 1.4);
    expect(edges.scoreMultiplier()).toBeCloseTo(0.9);
  });

  it('second_wind grants one armour per stack at floor start', () => {
    expect(new EdgeSystem(state(['second_wind', 'second_wind'])).armorAtFloorStart()).toBe(2);
  });

  it('fine_print is once per run', () => {
    const edges = new EdgeSystem(state(['fine_print']));
    expect(edges.consumeInsurance()).toBe(true);
    expect(edges.consumeInsurance()).toBe(false);
  });

  it('headline_act applies once per floor', () => {
    const edges = new EdgeSystem(state(['headline_act']));
    expect(edges.headlineDamageMultiplier(true)).toBeCloseTo(1.3);
    expect(edges.headlineDamageMultiplier(false)).toBe(1);
    edges.markHeadlineHit();
    expect(edges.headlineDamageMultiplier(true)).toBe(1);
    edges.beginFloor();
    expect(edges.headlineDamageMultiplier(true)).toBeCloseTo(1.3);
  });

  it('glass_cannon doubles exactly the next hit', () => {
    const edges = new EdgeSystem(state(['glass_cannon']));
    expect(edges.consumeGlassCannon()).toBe(true);
    expect(edges.consumeGlassCannon()).toBe(false);
    edges.beginFloor();
    expect(edges.consumeGlassCannon()).toBe(true);
  });

  it('inactive EdgeSystem ignores daily cards', () => {
    const run = state(['heavy_hands', 'second_wind', 'fine_print', 'quick_feet']);
    const edges = new EdgeSystem(run);
    edges.setActive(false);

    expect(edges.stacks('heavy_hands')).toBe(0);
    expect(edges.impactDamageMultiplier(2)).toBe(1);
    expect(edges.moveSpeedMultiplier()).toBe(1);
    expect(edges.armorAtFloorStart()).toBe(0);
    expect(edges.consumeInsurance()).toBe(false);
    expect(edges.consumeGlassCannon()).toBe(false);

    edges.setActive(true);
    expect(edges.stacks('heavy_hands')).toBe(1);
    expect(edges.impactDamageMultiplier(2)).toBe(1.25);
    expect(edges.moveSpeedMultiplier()).toBeCloseTo(1.12);
    expect(edges.armorAtFloorStart()).toBe(1);
    expect(edges.consumeInsurance()).toBe(true);
  });
});
