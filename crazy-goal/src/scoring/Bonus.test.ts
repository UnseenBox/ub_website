import { describe, expect, it } from 'vitest';
import { BONUS_COINS, BONUS_IDS, BONUS_OBJECTIVES, bonusMet } from './Bonus';
import type { ShotResult } from './ShotAnalyzer';

/** A plain scoring shot: a straight ground shot with no bounces and no street tricks. Override what the test needs. */
const shot = (p: Partial<ShotResult> = {}): ShotResult => ({
  goal: true,
  bounces: 0,
  touched: {},
  did: new Set(),
  keeper: false,
  distance: 500,
  time: 1,
  power: 0.7,
  entrySpeed: 300,
  entryOffset: 0.5,
  boomerang: false,
  minGoalDist: 0,
  maxHeight: 0,
  turned: 0,
  ...p,
});

describe('bonus objectives', () => {
  it('a miss never meets an objective', () => {
    for (const id of BONUS_IDS) expect(bonusMet(id, shot({ goal: false, bounces: 9, maxHeight: 99, turned: 9 }))).toBe(false);
  });

  it('two bounces, an air shot and a bend are each met by their own fact', () => {
    expect(bonusMet('two-bounces', shot({ bounces: 1 }))).toBe(false);
    expect(bonusMet('two-bounces', shot({ bounces: 2 }))).toBe(true);
    expect(bonusMet('air-shot', shot({ maxHeight: 20 }))).toBe(false);
    expect(bonusMet('air-shot', shot({ maxHeight: 40 }))).toBe(true);
    expect(bonusMet('bend-in', shot({ turned: 0.2 }))).toBe(false);
    expect(bonusMet('bend-in', shot({ turned: 0.5 }))).toBe(true);
  });

  it('a street objective is met by touching that thing, or by the mechanic doing its work', () => {
    expect(bonusMet('post', shot({ touched: { post: 1 } }))).toBe(true);
    expect(bonusMet('post', shot())).toBe(false);
    expect(bonusMet('taxi', shot({ touched: { car: 2 } }))).toBe(true);
    expect(bonusMet('bumper', shot({ did: new Set(['bumper']) }))).toBe(true);
    expect(bonusMet('tyre', shot({ did: new Set(['boing']) }))).toBe(true);
    expect(bonusMet('wind', shot({ did: new Set(['bumper']) }))).toBe(false);
  });

  it('a rocket is a goal scored above the rocket speed', () => {
    expect(bonusMet('rocket', shot({ entrySpeed: 900 }))).toBe(false);
    expect(bonusMet('rocket', shot({ entrySpeed: 1100 }))).toBe(true);
  });

  it('every objective has a label, and no two share one', () => {
    const labels = BONUS_IDS.map((id) => BONUS_OBJECTIVES[id].label);
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('a bonus pays 25 coins', () => {
    expect(BONUS_COINS).toBe(25);
  });
});
