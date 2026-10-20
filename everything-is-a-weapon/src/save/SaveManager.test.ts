import { describe, expect, it } from 'vitest';
import type { PortalStorage } from '../platform/Portal';
import { SAVE_VERSION, SaveManager, type SaveData } from './SaveManager';

class MemoryStorage implements PortalStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  removeItem(key: string): void { this.map.delete(key); }
}

const KEY = 'everything-is-a-weapon/save';

function loadRaw(raw: Record<string, unknown>): SaveData {
  const storage = new MemoryStorage();
  storage.setItem(KEY, JSON.stringify(raw));
  const manager = new SaveManager(storage);
  manager.load();
  return manager.data;
}

describe('SaveManager v5', () => {
  it('migrates a v4 save without losing progress', () => {
    const save = loadRaw({
      version: 4,
      unlockedRoom: 5,
      deepest: 6,
      scrap: 420,
      abilities: ['blast', 'freeze'],
      roomStars: { 'room-1': 3 },
      tutorial: 'done',
    });

    expect(SAVE_VERSION).toBe(5);
    expect(save.unlockedRoom).toBe(5);
    expect(save.deepest).toBe(6);
    expect(save.scrap).toBe(420);
    expect(save.abilities).toEqual(['blast', 'freeze']);
    expect(save.roomStars).toEqual({ 'room-1': 3 });
    expect(save.tutorial).toBe('done');
    expect(save.runActive).toBe(false);
    expect(save.runFloor).toBe(0);
    expect(save.runStreak).toBe(0);
    expect(save.runBoosts).toEqual([]);
    expect(save.runScore).toBe(0);
    expect(save.runInsuranceUsed).toBe(false);
    expect(save.starRewardsClaimed).toEqual([]);
    expect(save.tutorialSkipped).toBe(false);
    expect(save.dailyRareEdge).toBe(false);
    expect(save.enforcersBeaten).toBe(0);
  });

  it('starts a fresh save with v5 run defaults', () => {
    const save = new SaveManager(new MemoryStorage()).data;

    expect(save.runActive).toBe(false);
    expect(save.runFloor).toBe(0);
    expect(save.runStreak).toBe(0);
    expect(save.runBoosts).toEqual([]);
    expect(save.runScore).toBe(0);
    expect(save.runInsuranceUsed).toBe(false);
    expect(save.starRewardsClaimed).toEqual([]);
    expect(save.tutorialSkipped).toBe(false);
    expect(save.dailyRareEdge).toBe(false);
    expect(save.enforcersBeaten).toBe(0);
  });

  it('keeps duplicate run boosts because Edges stack', () => {
    const save = loadRaw({
      version: 5,
      runBoosts: ['heavy_hands', 'heavy_hands', 'quick_feet'],
    });

    expect(save.runBoosts).toEqual(['heavy_hands', 'heavy_hands', 'quick_feet']);
  });

  it('drops unknown ability ids and keeps known ids', () => {
    const save = loadRaw({ version: 5, abilities: ['blast', 'not_real'] });

    expect(save.abilities).toEqual(['blast']);
  });

  it('round-trips an active run', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager(storage);
    first.data.runActive = true;
    first.data.runFloor = 4;
    first.data.runStreak = 3;
    first.data.runBoosts = ['heavy_hands', 'heavy_hands'];
    first.data.runScore = 1234;
    first.data.runInsuranceUsed = true;
    first.write();

    const second = new SaveManager(storage);
    second.load();

    expect(second.data.runActive).toBe(true);
    expect(second.data.runFloor).toBe(4);
    expect(second.data.runStreak).toBe(3);
    expect(second.data.runBoosts).toEqual(['heavy_hands', 'heavy_hands']);
    expect(second.data.runScore).toBe(1234);
    expect(second.data.runInsuranceUsed).toBe(true);
  });

  it('sanitizes invalid numbers', () => {
    const save = loadRaw({ version: 5, runFloor: -3, runStreak: NaN, runScore: -10 });

    expect(save.runFloor).toBe(0);
    expect(save.runStreak).toBe(0);
    expect(save.runScore).toBe(0);
  });
});
