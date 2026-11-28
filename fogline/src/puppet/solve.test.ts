import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { CREATURES } from './index';
import { keys, pointOn, skeletonOrder, solve } from './solve';
import type { ActionState } from './types';

const still: ActionState = { time: 0, walk: 0, moving: 0, attack: -1, channel: -1, release: -1, hit: 0, hitDir: 1, death: -1, deathDir: 1 };

/** Every action a creature can be asked for, sampled along its length. */
function states(): ActionState[] {
  const out: ActionState[] = [];
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    out.push({ ...still, time: f * 7 });
    out.push({ ...still, time: f * 3, moving: 1, walk: f * Math.PI * 2 });
    out.push({ ...still, time: f, attack: f });
    out.push({ ...still, time: f, channel: f });
    out.push({ ...still, time: f, release: f });
    out.push({ ...still, time: f, hit: 1 - f, hitDir: -1 });
    out.push({ ...still, time: f, death: f, deathDir: -1 });
  }
  return out;
}

describe('keyframes', () => {
  it('holds the ends and passes through each key', () => {
    const track: [number, number][] = [[0.2, 1], [0.5, 4], [0.8, 2]];
    expect(keys(0, track)).toBe(1);
    expect(keys(0.5, track)).toBeCloseTo(4);
    expect(keys(1, track)).toBe(2);
  });
});

describe('the skeleton', () => {
  it('leaves every part where it was drawn when nothing moves', () => {
    for (const creature of Object.values(CREATURES)) {
      const placed = solve(creature.rig, { pose: {} });
      for (const part of creature.rig.parts) {
        const p = placed.get(part.name)!;
        expect(p.x, `${creature.rig.name} ${part.name}`).toBeCloseTo(part.pivot[0], 5);
        expect(p.y, `${creature.rig.name} ${part.name}`).toBeCloseTo(part.pivot[1], 5);
        expect(p.r).toBe(0);
      }
    }
  });

  it('keeps planted feet on their targets while the hips move', () => {
    const crimson = CREATURES.crimson;
    const foot = crimson.rig.parts.find((p) => p.name === 'footL')!;
    const target = [foot.pivot[0], foot.pivot[1]];
    const placed = solve(crimson.rig, {
      pose: { hips: { x: 20, y: 45 } },
      ik: [{ upper: 'thighL', lower: 'shinL', tip: 'footL', target }],
    });
    const p = placed.get('footL')!;
    expect(p.x).toBeCloseTo(target[0], 0);
    expect(p.y).toBeCloseTo(target[1], 0);
    expect(p.r).toBe(0);
  });

  it('puts the end of a bare claw leg on its target', () => {
    const rig = CREATURES.stalker.rig;
    const shin = rig.parts.find((p) => p.name === 'shinL')!;
    const rest = [532 - rig.origin[0], 935 - rig.origin[1]];
    const target = [rest[0] - 30, rest[1] - 90];
    const placed = solve(rig, { pose: {}, ik: [{ upper: 'thighL', lower: 'shinL', endAt: rest, target }] });
    const [x, y] = pointOn(shin, placed.get('shinL')!, rest);
    expect(x).toBeCloseTo(target[0], 0);
    expect(y).toBeCloseTo(target[1], 0);
  });

  it('orders parents before children', () => {
    for (const creature of Object.values(CREATURES)) {
      const seen = new Set<string>();
      for (const part of skeletonOrder(creature.rig)) {
        if (part.parent) expect(seen.has(part.parent)).toBe(true);
        seen.add(part.name);
      }
    }
  });
});

describe('creatures', () => {
  it('draws every enemy that asks for a puppet look', () => {
    for (const look of ['gorger', 'wraith', 'stalker', 'crimson', 'brood', 'hound', 'screamer', 'brute']) {
      expect(CREATURES[look], look).toBeDefined();
      expect(Object.values(ENEMIES).some((e) => e.look === look), look).toBe(true);
    }
  });

  it('names only parts it has, with the seven hit shapes a zombie expects', () => {
    for (const creature of Object.values(CREATURES)) {
      const parts = new Set(creature.rig.parts.map((p) => p.name));
      expect(creature.hits).toHaveLength(7);
      for (const hit of creature.hits) expect(parts.has(hit.part), `${creature.rig.name} ${hit.part}`).toBe(true);
      for (const spot of [creature.head, ...Object.values(creature.anchors), ...(creature.glows ?? [])]) {
        expect(parts.has(spot.part), `${creature.rig.name} ${spot.part}`).toBe(true);
      }
      for (const s of states()) {
        const anim = creature.animate(s);
        for (const name of Object.keys(anim.pose)) expect(parts.has(name), `${creature.rig.name} poses ${name}`).toBe(true);
      }
    }
  });

  it('gives finite, sensible placements in every action', () => {
    for (const creature of Object.values(CREATURES)) {
      for (const s of states()) {
        for (const [name, p] of solve(creature.rig, creature.animate(s))) {
          const values = [p.x, p.y, p.r, p.k, p.sx, p.sy, p.a];
          expect(values.every(Number.isFinite), `${creature.rig.name} ${name}`).toBe(true);
          expect(p.k).toBeGreaterThan(0.3);
          expect(p.k).toBeLessThan(3.5);
        }
      }
    }
  });

  it('gives each creature its own walk and its own attack', () => {
    const sample = (look: string, s: ActionState): string => {
      const c = CREATURES[look];
      return [...solve(c.rig, c.animate(s)).values()].map((p) => `${p.x - 0},${p.r.toFixed(3)}`).join('|');
    };
    for (const look of Object.keys(CREATURES)) {
      const idle = sample(look, { ...still, time: 1 });
      expect(sample(look, { ...still, time: 1, moving: 1, walk: 1.2 })).not.toBe(idle);
      expect(sample(look, { ...still, time: 1, attack: 0.68 })).not.toBe(idle);
    }
  });
});
