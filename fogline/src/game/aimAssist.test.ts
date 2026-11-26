import { describe, expect, it } from 'vitest';
import { AIM, AimAssist, type AimPoint } from './aimAssist';

const FRAME = 1 / 60;
const zombie = {};
const other = {};

/** A head at (x, y) on a body standing 100 px below it. */
function head(x: number, y: number, owner: object = zombie): AimPoint {
  return { owner, part: 'head', x, y, baseX: x, baseY: y + 100 };
}

/** Runs the assist for `frames` frames and returns where the crosshair was on each. */
function run(
  assist: AimAssist, frames: number, finger: (i: number) => { x: number; y: number }, points: (i: number) => AimPoint[], dt = FRAME,
): { x: number; y: number }[] {
  return Array.from({ length: frames }, (_, i) => assist.step(finger(i), points(i), dt));
}

/** The longest distance the crosshair moved between two neighbouring frames. */
const biggestJump = (path: { x: number; y: number }[]): number =>
  Math.max(...path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y)));

describe('phone aim assist', () => {
  it('leaves the crosshair under the finger when nothing is near', () => {
    const assist = new AimAssist();
    expect(assist.step({ x: 640, y: 300 }, [], FRAME)).toEqual({ x: 640, y: 300 });
    expect(assist.step({ x: 640, y: 300 }, [head(640 + AIM.reach + 5, 300)], FRAME)).toEqual({ x: 640, y: 300 });
  });

  it('settles on a nearby target and then holds perfectly still', () => {
    const path = run(new AimAssist(), 90, () => ({ x: 640, y: 300 }), () => [head(700, 270)]);
    const settled = path.slice(30);
    expect(biggestJump(settled)).toBeLessThan(0.05);
    expect(Math.hypot(settled[0].x - 700, settled[0].y - 270)).toBeLessThan(0.5);
  });

  it('glides onto the target instead of jumping there', () => {
    const path = run(new AimAssist(), 30, () => ({ x: 640, y: 300 }), () => [head(710, 300)]);
    expect(biggestJump([{ x: 640, y: 300 }, ...path])).toBeLessThan(70 * 0.35);
    for (let i = 1; i < path.length; i++) expect(path[i].x).toBeGreaterThanOrEqual(path[i - 1].x);
  });

  it('stays on a walking target without trailing behind it', () => {
    const at = (i: number): number => 660 + i * 2;
    const path = run(new AimAssist(), 40, (i) => ({ x: at(i) - 30, y: 300 }), (i) => [head(at(i), 300)]);
    for (let i = 20; i < 40; i++) expect(Math.abs(path[i].x - at(i))).toBeLessThan(1);
  });

  it('smooths out the bob and flinch of a body that stays put', () => {
    // The head jerks 8 px up and down, four times a second.
    const bob = (i: number): number => 270 + (Math.floor(i / 8) % 2 ? 8 : 0);
    const points = (i: number): AimPoint[] => [{ owner: zombie, part: 'head', x: 690, y: bob(i), baseX: 690, baseY: 370 }];
    const path = run(new AimAssist(), 120, () => ({ x: 650, y: 290 }), points).slice(60);
    const heights = path.map((p) => p.y);
    expect(biggestJump(path)).toBeLessThan(1.5);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(5);
  });

  it('holds still on a locked target while the finger shifts a little', () => {
    const assist = new AimAssist();
    run(assist, 40, () => ({ x: 650, y: 300 }), () => [head(690, 290)]);
    const path = run(assist, 20, (i) => ({ x: 650 + (i % 2) * 6, y: 300 }), () => [head(690, 290)]);
    expect(biggestJump(path)).toBeLessThan(0.5);
  });

  it('does not flip between two targets the finger is half way between', () => {
    const left = head(600, 300), right = head(680, 300, other);
    const path = run(new AimAssist(), 90, (i) => ({ x: 640 + (i % 2 ? 6 : -6), y: 300 }), () => [left, right]).slice(30);
    expect(biggestJump(path)).toBeLessThan(0.5);
  });

  it('moves across to another target once the finger is clearly nearer to it', () => {
    const left = head(600, 300), right = head(700, 300, other);
    const assist = new AimAssist();
    run(assist, 40, () => ({ x: 615, y: 300 }), () => [left, right]);
    const path = run(assist, 60, () => ({ x: 690, y: 300 }), () => [left, right]);
    expect(path[path.length - 1].x).toBeCloseTo(700, 0);
  });

  it('lets go smoothly when the finger leaves, and when the target dies', () => {
    const assist = new AimAssist();
    run(assist, 40, () => ({ x: 640, y: 300 }), () => [head(690, 300)]);
    const away = run(assist, 60, () => ({ x: 640, y: 300 }), () => []);
    expect(biggestJump([{ x: 690, y: 300 }, ...away])).toBeLessThan(50 * 0.35);
    expect(away[away.length - 1].x).toBeCloseTo(640, 1);
  });

  it('lets a sweeping finger carry the crosshair past targets without clinging or hopping', () => {
    const targets = [head(500, 300), head(660, 300, other)];
    // 10 px a frame: a quick swipe across both.
    const path = run(new AimAssist(), 60, (i) => ({ x: 300 + i * 10, y: 320 }), () => targets);
    expect(biggestJump(path)).toBeLessThan(22);
    for (let i = 1; i < path.length; i++) expect(path[i].x).toBeGreaterThan(path[i - 1].x - 2);
  });

  it('takes hold again once the swipe stops by a target', () => {
    const assist = new AimAssist();
    run(assist, 30, (i) => ({ x: 340 + i * 10, y: 300 }), () => [head(660, 300)]);
    const path = run(assist, 60, () => ({ x: 630, y: 300 }), () => [head(660, 300)]);
    expect(path[path.length - 1].x).toBeCloseTo(660, 0);
  });

  it('eases off between the lock and the edge of its reach', () => {
    const edge = (AIM.lock + AIM.reach) / 2;
    const path = run(new AimAssist(), 90, () => ({ x: 400, y: 300 }), () => [head(400 + edge, 300)]);
    const pulled = path[path.length - 1].x - 400;
    expect(pulled).toBeGreaterThan(edge * 0.2);
    expect(pulled).toBeLessThan(edge * 0.8);
  });

  it('feels the same at 30 and 60 frames a second', () => {
    const at60 = run(new AimAssist(), 12, () => ({ x: 640, y: 300 }), () => [head(710, 300)], 1 / 60);
    const at30 = run(new AimAssist(), 6, () => ({ x: 640, y: 300 }), () => [head(710, 300)], 1 / 30);
    expect(at30[5].x).toBeCloseTo(at60[11].x, 0);
  });

  it('does not drag the crosshair across the screen when a pooled body respawns elsewhere', () => {
    const assist = new AimAssist();
    run(assist, 40, () => ({ x: 640, y: 300 }), () => [head(680, 300)]);
    const next = assist.step({ x: 640, y: 300 }, [head(1100, 300)], FRAME);
    expect(next.x).toBeLessThanOrEqual(680);
    expect(next.x).toBeGreaterThanOrEqual(640);
  });

  it('starts fresh after a reset', () => {
    const assist = new AimAssist();
    run(assist, 40, () => ({ x: 640, y: 300 }), () => [head(690, 300)]);
    assist.reset();
    expect(assist.step({ x: 100, y: 100 }, [], FRAME)).toEqual({ x: 100, y: 100 });
  });
});
