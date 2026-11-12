import { expect, it, vi } from 'vitest';
import { AdaptiveQuality, MAX_QUALITY_STEP } from './AdaptiveQuality';

/** Feeds `seconds` of frames at a fixed frame time. */
function feed(q: AdaptiveQuality, ms: number, seconds: number): void {
  for (let t = 0; t < seconds; t += ms / 1000) q.frame(ms);
}

it('a device that holds 60 fps never changes quality', () => {
  const onStep = vi.fn();
  const q = new AdaptiveQuality(onStep);
  feed(q, 16.7, 120);
  expect(q.step).toBe(0);
  expect(onStep).not.toHaveBeenCalled();
});

it('10 s of slow frames costs one step; the next 10 s another; it stops at the maximum', () => {
  const steps: number[] = [];
  const q = new AdaptiveQuality((s) => steps.push(s));
  feed(q, 40, 9);
  expect(q.step, 'not before two slow windows').toBe(0);
  feed(q, 40, 3);
  expect(steps).toEqual([1]);
  feed(q, 40, 60);
  expect(steps).toEqual([1, 2, 3]);
  expect(q.step).toBe(MAX_QUALITY_STEP);
});

it('one hitch is not a slow window, and a good window resets the count', () => {
  const q = new AdaptiveQuality(() => {});
  // a window of 60 fps with a handful of 100 ms frames (under 5%)
  for (let i = 0; i < 280; i++) q.frame(i % 70 === 0 ? 100 : 16);
  expect(q.step).toBe(0);
  feed(q, 40, 5.2); // one slow window
  feed(q, 16, 5.2); // a good one resets it
  feed(q, 40, 5.2); // one slow window again, not two in a row
  expect(q.step).toBe(0);
});

it('never steps back up: a recovered device keeps its lowered quality', () => {
  const q = new AdaptiveQuality(() => {});
  feed(q, 40, 11);
  expect(q.step).toBe(1);
  feed(q, 16, 60);
  expect(q.step).toBe(1);
});
