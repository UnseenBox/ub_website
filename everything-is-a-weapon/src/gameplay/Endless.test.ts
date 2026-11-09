import { expect, it } from 'vitest';
import { BOSS_EVERY, endlessBoss, endlessIndex, endlessRoom, healAfter, isBossFloor, newEndlessRun } from './Endless';

it('every fifth floor has a boss and the roster cycles', () => {
  expect(endlessBoss(1)).toBeNull();
  expect(endlessBoss(4)).toBeNull();
  expect(endlessBoss(BOSS_EVERY)).toBe('chairman');
  expect(endlessBoss(10)).toBe('flusher');
  expect(isBossFloor(15)).toBe(true);
  expect(isBossFloor(16)).toBe(false);
  expect(endlessBoss(5 * 21)).toBe('chairman'); // 20 bosses, then round again
  expect(healAfter(5)).toBeGreaterThan(healAfter(4));
  expect(healAfter(4)).toBeGreaterThan(healAfter(8)); // gentler while you are learning
  expect(healAfter(10)).toBeGreaterThan(healAfter(9));
});

it('floors map to generated depths and stop getting harder at the cap', () => {
  expect(endlessIndex(1)).toBe(8);
  expect(endlessIndex(2)).toBe(9);
  expect(endlessIndex(400)).toBe(endlessIndex(41));
});

it('the same run makes the same room; different runs differ', () => {
  const a = newEndlessRun(12345, 5);
  const b = newEndlessRun(12345, 5);
  const c = newEndlessRun(54321, 5);
  expect(endlessRoom(a).seed).toBe(endlessRoom(b).seed);
  expect(endlessRoom(a).seed).not.toBe(endlessRoom(c).seed);
  expect(endlessRoom(a).id).toBe(`endless-12345-1`);
  const next = { ...a, floor: 2 };
  expect(endlessRoom(next).seed).not.toBe(endlessRoom(a).seed);
});

it('later floors bring bigger crews', () => {
  const crew = (floor: number) => endlessRoom({ ...newEndlessRun(777, 5), floor }).enemies.length;
  const early = [1, 2, 3].reduce((n, f) => n + crew(f), 0);
  const late = [28, 29, 30].reduce((n, f) => n + crew(f), 0);
  expect(late).toBeGreaterThan(early);
});

it('no generated crew stacks more of one dangerous kind than the cap allows', async () => {
  const { crewCap } = await import('./RoomGenerator');
  for (const floor of [3, 8, 15, 30, 40]) {
    for (let seed = 1; seed <= 40; seed++) {
      const crew = endlessRoom({ ...newEndlessRun(seed * 7919, 5), floor }).enemies;
      const depth = Math.min(40, floor);
      const counts = new Map<string, number>();
      for (const e of crew) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      // The "always one heavyweight" top-up may add a single kaboom/hurler/helmet beyond a cap.
      for (const [type, n] of counts) expect(n).toBeLessThanOrEqual(crewCap(type as never, depth) + 1);
    }
  }
});
