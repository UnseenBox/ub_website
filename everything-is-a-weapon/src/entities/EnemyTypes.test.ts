import { describe, expect, it } from 'vitest';
import { ENEMY_TYPES, type EnemyType } from './EnemyTypes';

const bosses: EnemyType[] = Object.values(ENEMY_TYPES).filter((type) => type.boss);

describe('the boss roster', () => {
  it('has twenty distinct headliners with their own stamps', () => {
    expect(bosses).toHaveLength(20);
    for (const key of ['bossBanner', 'bossTitle', 'bossDiscovery'] as const) {
      const values = bosses.map((boss) => boss[key]);
      expect(values.every(Boolean)).toBe(true);
      expect(new Set(values).size).toBe(bosses.length);
    }
  });

  it('gives every boss at least one escalation', () => {
    for (const boss of bosses) {
      expect(boss.phases?.length, boss.name).toBeGreaterThan(0);
      expect(
        boss.phases?.some((phase) => phase.enrage || phase.summon || phase.shockwave),
        boss.name,
      ).toBe(true);
      expect(boss.phases?.some((phase) => phase.announce), boss.name).toBe(true);
    }
  });

  it('gives every boss a unique signature attack', () => {
    const sigs = bosses.map((b) => b.signature?.name).filter(Boolean);
    expect(sigs.length).toBe(20);
    expect(new Set(sigs).size).toBe(20);
  });

  it('makes Piano Spider play piano', () => {
    expect(ENEMY_TYPES.piano.signature?.sound).toBe('piano');
    expect(ENEMY_TYPES.piano.signature?.name).toContain('PIANO');
  });

  it('keeps the roster heavier than the old line-up', () => {
    expect(Math.min(...bosses.map((boss) => boss.hp))).toBeGreaterThanOrEqual(480);
    expect(ENEMY_TYPES.cardboard.hp).toBeGreaterThanOrEqual(750);
    expect(ENEMY_TYPES.mom.hp).toBeGreaterThan(ENEMY_TYPES.house.hp);
  });

  it('gives shield-bearers a front board with visible durability', () => {
    const bailiff = ENEMY_TYPES.shield;
    const bulwark = ENEMY_TYPES.bulwark;
    expect(bailiff.shield).toBe(true);
    expect(bulwark.shield).toBe(true);
    expect((bailiff.shieldHp ?? 0)).toBeGreaterThan(0);
    expect((bulwark.shieldHp ?? 0)).toBeGreaterThan(0);
    // Movers without a board have no durability to show.
    expect(ENEMY_TYPES.basic.shieldHp).toBeUndefined();
    expect(ENEMY_TYPES.fast.shieldHp).toBeUndefined();
  });
});
