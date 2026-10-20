import { describe, expect, it } from 'vitest';
import {
  chooseEdge,
  endRun,
  recordClear,
  recordFail,
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

  it('recordFail keeps the run and Edges for a campaign room', () => {
    const save = state({ runActive: true, runFloor: 3, runStreak: 4, runBoosts: ['quick_feet'], runScore: 1200 });
    const result = recordFail(save, 3, 700, 9);
    expect(result.ended).toBe(false);
    expect(save.runActive).toBe(true);
    expect(save.runBoosts).toEqual(['quick_feet']);
    expect(save.runStreak).toBe(0);
    expect(save.runScore).toBe(700);
  });

  it('recordFail marks a Depths room as ended but does not clear state', () => {
    const save = state({ runActive: true, runFloor: 10, runStreak: 5, runBoosts: ['heavy_hands'], runScore: 1500 });
    const result = recordFail(save, 10, 800, 9);
    expect(result.ended).toBe(true);
    expect(save.runActive).toBe(true);
    expect(save.runBoosts).toEqual(['heavy_hands']);
    expect(save.runFloor).toBe(10);
    expect(save.runScore).toBe(800);
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
