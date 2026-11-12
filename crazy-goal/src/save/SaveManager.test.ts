import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, parseSave } from './SaveManager';

const v1 = {
  version: 1,
  muted: true,
  sound: 0.5,
  music: 0.1,
  skin: 'orange',
  coins: 137,
  levels: {
    'houma-01': { best: 2600, attempts: 7, goals: 3, stars: 3 },
    'houma-02': { best: 1180, attempts: 2, goals: 1, stars: 1 },
  },
};

describe('parseSave', () => {
  it('migrates a v1 save: keeps levels, coins and skin, adds the new defaults', () => {
    const s = parseSave(JSON.stringify(v1));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.coins).toBe(137);
    expect(s.skin).toBe('orange');
    expect(s.muted).toBe(true);
    expect(s.sound).toBe(0.5);
    expect(s.music).toBe(0.1);
    expect(s.levels['houma-01']).toMatchObject({ best: 2600, attempts: 7, goals: 3, stars: 3 });
    expect(s.levels['houma-02']).toMatchObject({ best: 1180, goals: 1, stars: 1 });
    expect(s.tips).toEqual([]);
    expect(s.boostIntro).toBe(false);
    expect(s.freeBoosts).toEqual({});
    expect(s.fk).toEqual({ coinsPaid: {} });
    expect(s.daily).toEqual({ lastDate: '', streak: 0, results: {} });
  });

  it('pays nobody twice: v1 stars become paidStars', () => {
    const s = parseSave(JSON.stringify(v1));
    expect(s.levels['houma-01'].paidStars).toBe(3);
    expect(s.levels['houma-02'].paidStars).toBe(1);
    expect(s.levels['houma-01'].coin).toBe(false);
  });

  it('does not announce balls a v1 player already owns', () => {
    const s = parseSave(JSON.stringify(v1)); // 4 stars: classic (0) and orange (3)
    expect(s.seenSkins).toEqual(['classic', 'orange']);
  });

  it('round-trips a v2 save', () => {
    const first = parseSave(JSON.stringify(v1));
    first.tips = ['bank'];
    first.boostIntro = true;
    first.freeBoosts = { magnet: 1 };
    first.fk.coinsPaid = { 'stage-1': 40 };
    first.daily = { lastDate: '2026-11-12', streak: 3, results: { '2026-11-12': 'OOXOO' } };
    first.levels['houma-01'].coin = true;
    first.seenSkins = ['classic'];
    const again = parseSave(JSON.stringify(first));
    expect(again).toEqual(first);
  });

  it('keeps the known fields of a version from the future instead of wiping', () => {
    const s = parseSave(JSON.stringify({ ...v1, version: 99, tips: ['bank'], extra: { a: 1 } }));
    expect(s.coins).toBe(137);
    expect(s.levels['houma-01'].stars).toBe(3);
    expect(s.tips).toEqual(['bank']);
  });

  it('gives a fresh save for garbage', () => {
    expect(() => parseSave('{not json')).toThrow(); // the SaveManager constructor catches this and starts clean
    expect(parseSave(null).coins).toBe(0);
    expect(parseSave('42').levels).toEqual({});
    expect(parseSave('[]').levels).toEqual({});
    expect(parseSave('{"coins":50}').coins).toBe(0); // no version: not ours
  });

  it('drops malformed fields without losing the rest', () => {
    const s = parseSave(JSON.stringify({ ...v1, coins: -5, tips: ['bank', 3, null], freeBoosts: { magnet: 2, fire: -1, junk: 4 }, levels: { 'houma-01': 'x', 'houma-02': { goals: 1, stars: 9 } } }));
    expect(s.coins).toBe(0);
    expect(s.tips).toEqual(['bank']);
    expect(s.freeBoosts).toEqual({ magnet: 2 });
    expect(s.levels['houma-01']).toBeUndefined();
    expect(s.levels['houma-02'].stars).toBe(3);
  });
});
