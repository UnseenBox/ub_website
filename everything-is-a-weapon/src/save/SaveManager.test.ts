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

describe('SaveManager v7', () => {
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

    expect(SAVE_VERSION).toBe(7);
    expect(save.upgrades).toEqual({});
    expect(save.runOffer).toEqual([]);
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

  it('starts a fresh save with v6 run and progression defaults', () => {
    const save = new SaveManager(new MemoryStorage()).data;

    expect(save.upgrades).toEqual({});
    expect(save.runOffer).toEqual([]);
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

  it('migrates a v5 save and resets only the cumulative room bests', () => {
    const save = loadRaw({
      version: 5,
      scrap: 900, highScore: 5000, discoveries: ['blunt_force'],
      roomStars: { 'room-1': 3 }, roomBests: { 'room-1': { score: 4200, chain: 6 } },
      runActive: true, runFloor: 4, runStreak: 2, runScore: 4200,
      runBoosts: ['quick_feet'], runOffer: ['heavy_hands'],
    });
    expect(SAVE_VERSION).toBe(7);
    expect(save.upgrades).toEqual({});
    expect(save.runOffer).toEqual([]);
    expect(save.roomBests).toEqual({});
    expect(save.roomStars).toEqual({ 'room-1': 3 });
    expect(save.scrap).toBe(900);
    expect(save.highScore).toBe(5000);
    expect(save.runBoosts).toEqual(['quick_feet']);
    expect(save.runActive).toBe(true);
  });

  it('round-trips v6 upgrade levels and a pending offer', () => {
    const save = loadRaw({
      version: 6, upgrades: { door: 2, scrap: 3 }, runActive: true,
      runOffer: ['heavy_hands', 'quick_feet'],
    });
    expect(save.upgrades).toEqual({ door: 2, scrap: 3 });
    expect(save.runOffer).toEqual(['heavy_hands', 'quick_feet']);
  });

  it('clamps/drops upgrade values and stores only positive known levels', () => {
    const save = loadRaw({
      version: 6,
      upgrades: { door: 99, scrap: -2, cooldown: 2.9, score: '3', pet: 4, nope: 2 },
    });
    expect(save.upgrades).toEqual({ door: 2, cooldown: 2, pet: 4 });
  });

  it('caps duplicate run Edges and drops unknown ids', () => {
    const save = loadRaw({
      version: 6, runActive: true,
      runBoosts: ['quick_feet', 'nope', 'quick_feet', 'quick_feet', 'quick_feet', 'heavy_hands'],
    });
    expect(save.runBoosts).toEqual(['quick_feet', 'quick_feet', 'quick_feet', 'heavy_hands']);
  });

  it('sanitizes runOffer to three known unique ids and clears it without a run', () => {
    const active = loadRaw({
      version: 6, runActive: true,
      runOffer: ['heavy_hands', 'heavy_hands', 'nope', 'quick_feet', 'scrap_luck', 'magnate'],
    });
    expect(active.runOffer).toEqual(['heavy_hands', 'quick_feet', 'scrap_luck']);
    const idle = loadRaw({ version: 6, runActive: false, runOffer: ['heavy_hands'] });
    expect(idle.runOffer).toEqual([]);
  });

  it('defaults to Normal and falls back from unknown difficulties', () => {
    const fresh = new SaveManager(new MemoryStorage()).data;
    expect(fresh.difficulty).toBe('normal');
    const weird = loadRaw({ version: 7, difficulty: 'nightmare' });
    expect(weird.difficulty).toBe('normal');
    const easy = loadRaw({ version: 7, difficulty: 'easy' });
    expect(easy.difficulty).toBe('easy');
    const hard = loadRaw({ version: 7, difficulty: 'hard' });
    expect(hard.difficulty).toBe('hard');
  });

  it('keeps an old save on Normal, the difficulty it was born on', () => {
    const legacy = loadRaw({ version: 5, unlockedRoom: 9 });
    expect(legacy.difficulty).toBe('normal');
    expect(legacy.version).toBe(7);
  });

  it('round-trips difficulty and writes it back', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager(storage);
    first.data.difficulty = 'hard';
    first.write();

    const second = new SaveManager(storage);
    second.load();
    expect(second.data.difficulty).toBe('hard');
  });
});
