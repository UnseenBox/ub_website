import { describe, expect, it } from 'vitest';
import { CLUB_START, ballIsOpen, clubProgress, gainXp, nextLockedBall, rewardFor, xpForScore, xpToNext } from './Club';

describe('XP from a goal', () => {
  it('is the Crazy Score over 50, and never less than 10', () => {
    expect(xpForScore(0)).toBe(10);
    expect(xpForScore(300)).toBe(10);
    expect(xpForScore(500)).toBe(10);
    expect(xpForScore(600)).toBe(12);
    expect(xpForScore(1200)).toBe(24);
    expect(xpForScore(6000)).toBe(120);
  });
});

describe('XP per level', () => {
  it('takes 100 XP to reach level 2, then 60 more for each step after', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(160);
    expect(xpToNext(3)).toBe(220);
  });

  it('shows how much of the current level is earned', () => {
    expect(clubProgress({ level: 1, xp: 0 })).toBe(0);
    expect(clubProgress({ level: 1, xp: 50 })).toBeCloseTo(0.5);
    expect(clubProgress({ level: 2, xp: 80 })).toBeCloseTo(0.5);
  });
});

describe('rewards per level', () => {
  it('pays 50 + 10 per level in coins', () => {
    expect(rewardFor(2).coins).toBe(70);
    expect(rewardFor(7).coins).toBe(120);
  });

  it('unlocks a ball on every fifth level', () => {
    expect(rewardFor(4).ball).toBe(false);
    expect(rewardFor(5).ball).toBe(true);
    expect(rewardFor(10).ball).toBe(true);
    expect(rewardFor(11).ball).toBe(false);
  });

  it('gives a free ability on levels 3, 6 and 9, and nothing else', () => {
    expect(rewardFor(3).ability).toBe('fire');
    expect(rewardFor(6).ability).toBe('magnet');
    expect(rewardFor(9).ability).toBe('rubber');
    expect(rewardFor(4).ability).toBeNull();
    expect(rewardFor(12).ability).toBeNull();
  });
});

describe('gaining XP', () => {
  it('a small goal stays in the level and reaches nothing', () => {
    const gain = gainXp(CLUB_START, 50);
    expect(gain.club).toEqual({ level: 1, xp: 50 });
    expect(gain.levels).toEqual([]);
  });

  it('exactly enough XP reaches the next level, with nothing left over', () => {
    const gain = gainXp(CLUB_START, 100);
    expect(gain.club).toEqual({ level: 2, xp: 0 });
    expect(gain.levels.map((l) => l.level)).toEqual([2]);
    expect(gain.levels[0].coins).toBe(70);
  });

  it('one big goal can take the player up several levels, and keeps the rest', () => {
    // 500 XP from level 1: 100 to reach 2, 160 to reach 3, 220 to reach 4 (480 in all), 20 left on level 4.
    const gain = gainXp(CLUB_START, 500);
    expect(gain.club).toEqual({ level: 4, xp: 20 });
    expect(gain.levels.map((l) => l.level)).toEqual([2, 3, 4]);
    expect(gain.levels.find((l) => l.level === 3)?.ability).toBe('fire');
    expect(gain.levels.find((l) => l.level === 4)?.coins).toBe(90);
  });

  it('carries progress from earlier goals into the next level', () => {
    const gain = gainXp({ level: 2, xp: 150 }, 20);
    expect(gain.club).toEqual({ level: 3, xp: 10 });
    expect(gain.levels.map((l) => l.level)).toEqual([3]);
  });
});

describe('free balls from club levels', () => {
  const skins = [
    { id: 'classic', need: 0 },
    { id: 'orange', need: 3 },
    { id: 'algiers', need: 6 },
    { id: 'mint', need: 10 },
  ];

  it('a ball is open by stars or by a club grant', () => {
    expect(ballIsOpen(skins[1], 3, [])).toBe(true);
    expect(ballIsOpen(skins[2], 3, [])).toBe(false);
    expect(ballIsOpen(skins[2], 3, ['algiers'])).toBe(true);
  });

  it('the next locked ball is the first one not open by stars or by a grant', () => {
    expect(nextLockedBall(skins, 5, [])?.id).toBe('algiers');
    expect(nextLockedBall(skins, 5, ['algiers'])?.id).toBe('mint');
    expect(nextLockedBall(skins, 10, [])).toBeNull();
  });
});
