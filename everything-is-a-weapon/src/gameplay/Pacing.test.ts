import { expect, it } from 'vitest';
import { EASE_UNTIL, FULL, bossSoften, depthHpScale, earlyEase } from './Pacing';

it('the tutorial and everything from the end of the ramp is full strength', () => {
  expect(earlyEase(1)).toEqual(FULL);
  expect(earlyEase(EASE_UNTIL)).toEqual(FULL);
  expect(earlyEase(40)).toEqual(FULL);
  expect(earlyEase(Infinity)).toEqual(FULL);
});

it('the first real room is the softest and each step is a little harder', () => {
  let last = earlyEase(2);
  expect(last.hp).toBeLessThan(0.6);
  expect(last.damage).toBeLessThan(0.8);
  for (let step = 3; step < EASE_UNTIL; step++) {
    const now = earlyEase(step);
    expect(now.hp).toBeGreaterThan(last.hp);
    expect(now.speed).toBeGreaterThanOrEqual(last.speed);
    expect(now.damage).toBeGreaterThan(last.damage);
    last = now;
  }
  expect(last.hp).toBeLessThan(1);
});

it('only the early campaign copies of the outlier bosses are softened', () => {
  expect(bossSoften('mom', 8)).toBeLessThan(1);
  expect(bossSoften('mom', 35)).toBe(1);
  expect(bossSoften('chairman', 2)).toBe(1);
  expect(bossSoften('cables', 25)).toBeLessThan(1);
});

it('crew toughness keeps rising with depth up to a cap', () => {
  expect(depthHpScale(0)).toBe(1);
  expect(depthHpScale(9)).toBeLessThan(depthHpScale(20));
  expect(depthHpScale(20)).toBeGreaterThan(1.8);
  expect(depthHpScale(35)).toBeGreaterThan(depthHpScale(20));
  expect(depthHpScale(80)).toBe(2.3);
});
