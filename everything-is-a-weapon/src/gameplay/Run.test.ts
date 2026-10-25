import { describe, expect, it } from 'vitest';
import { EDGE_STACK_CAP } from './Edges';
import {
  chooseEdge,
  endRun,
  recordClear,
  recordFail,
  runSnapshot,
  sanitizeRun,
  startRun,
  type RunState,
} from './Run';

function state(overrides: Partial<RunState> = {}): RunState {
  return {
    runActive: false,
    runFloor: 0,
    runStreak: 0,
    runBoosts: [],
    runScore: 0,
    runInsuranceUsed: false,
    runOffer: [],
    ...overrides,
  };
}

describe('Run', () => {
  it('startRun resets the run and keeps Edges out', () => {
    const save = state({
      runActive: true,
      runFloor: 4,
      runStreak: 3,
      runBoosts: ['heavy_hands'],
      runScore: 900,
      runInsuranceUsed: true,
    });
    startRun(save, 2);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(2);
    expect(save.runStreak).toBe(0);
    expect(save.runBoosts).toEqual([]);
    expect(save.runScore).toBe(0);
    expect(save.runInsuranceUsed).toBe(false);
  });

  it('clearing room 1 advances the floor and streak and stores the score', () => {
    const save = state({ runActive: true, runFloor: 0 });
    recordClear(save, 0, 500);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(1);
    expect(save.runStreak).toBe(1);
    expect(save.runScore).toBe(500);
  });

  it('keeps the run and build on failure, resetting only streak and score', () => {
    const save = state({
      runActive: true, runFloor: 5, runStreak: 4,
      runBoosts: ['quick_feet', 'quick_feet'], runScore: 1200,
    });
    recordFail(save, 900);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(5);
    expect(save.runStreak).toBe(0);
    expect(save.runScore).toBe(900);
    expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet']);
  });

  it('starts and ends a run with no pending offer', () => {
    const save = state({ runOffer: ['heavy_hands'], runActive: true });
    startRun(save, 4);
    expect(save.runOffer).toEqual([]);
    save.runOffer = ['heavy_hands'];
    endRun(save);
    expect(save.runOffer).toEqual([]);
  });

  it('caps a chosen Edge at three stacks', () => {
    const save = state({ runActive: true, runBoosts: ['quick_feet', 'quick_feet'] });
    expect(chooseEdge(save, 'quick_feet')).toBe(true);
    expect(chooseEdge(save, 'quick_feet')).toBe(false);
    expect(save.runBoosts.filter((id) => id === 'quick_feet')).toHaveLength(EDGE_STACK_CAP);
  });

  it('sanitizes unknown ids and caps duplicates', () => {
    const save = state({
      runBoosts: ['quick_feet', 'nope', 'quick_feet', 'quick_feet', 'quick_feet'],
    });
    sanitizeRun(save, 50, 10, 50);
    expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet', 'quick_feet']);
  });

  it('summarizes types, stacks and the 1-based floor for the UI', () => {
    const snap = runSnapshot(state({
      runActive: true, runFloor: 11, runStreak: 4, runScore: 12400,
      runBoosts: ['quick_feet', 'quick_feet', 'heavy_hands'],
    }));
    expect(snap).toEqual({
      floor: 12, streak: 4, score: 12400, types: 2, stacks: 3,
      boosts: ['quick_feet', 'quick_feet', 'heavy_hands'],
    });
  });

  it('drops a pending offer when sanitizing ends the run', () => {
    const save = state({ runActive: true, runFloor: 99, runOffer: ['heavy_hands'] });
    sanitizeRun(save, 0, 0, 1);
    expect(save.runActive).toBe(false);
    expect(save.runOffer).toEqual([]);
  });

  it('chooseEdge allows duplicates', () => {
    const save = state({ runActive: true });
    chooseEdge(save, 'heavy_hands');
    chooseEdge(save, 'heavy_hands');
    expect(save.runBoosts).toEqual(['heavy_hands', 'heavy_hands']);
  });

  it('endRun clears everything', () => {
    const save = state({
      runActive: true,
      runFloor: 5,
      runStreak: 6,
      runBoosts: ['magnate'],
      runScore: 4000,
      runInsuranceUsed: true,
    });
    endRun(save);
    expect(save.runActive).toBe(false);
    expect(save.runBoosts).toEqual([]);
    expect(save.runScore).toBe(0);
    expect(save.runStreak).toBe(0);
    expect(save.runInsuranceUsed).toBe(false);
  });

  it('sanitizeRun drops unknown Edges but keeps duplicate known ones', () => {
    const save = state({ runActive: true, runFloor: 2, runBoosts: ['heavy_hands', 'not_real', 'heavy_hands'] });
    sanitizeRun(save, 2, 2);
    expect(save.runBoosts).toEqual(['heavy_hands', 'heavy_hands']);
    expect(save.runActive).toBe(true);
  });

  it('sanitizeRun accepts the first Depths floor', () => {
    const save = state({ runActive: true, runFloor: 9, runBoosts: ['quick_feet'] });
    sanitizeRun(save, 9, 9);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(9);
  });

  it('sanitizeRun accepts a failed Room 10 floor', () => {
    const save = state({ runActive: true, runFloor: 10, runBoosts: ['quick_feet'] });
    sanitizeRun(save, 9, 9);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(10);
  });

  it('sanitizeRun accepts a Master Key floor 19', () => {
    const save = state({ runActive: true, runFloor: 18, runBoosts: ['quick_feet'] });
    sanitizeRun(save, 9, 9, 18);
    expect(save.runActive).toBe(true);
    expect(save.runFloor).toBe(18);
  });

  it('sanitizeRun rejects a jump past the next floor', () => {
    const save = state({ runActive: true, runFloor: 11, runBoosts: ['quick_feet'] });
    sanitizeRun(save, 9, 9);
    expect(save.runActive).toBe(false);
    expect(save.runFloor).toBe(11);
  });
});
