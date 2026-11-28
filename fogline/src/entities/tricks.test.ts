import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { FIELD } from '../game/config';
import { TELL, breakTricks, newTrick, runTricks, startTricks } from './tricks';
import type { Zombie } from './Zombie';

const FRAME = 1 / 60;
const half = (): number => 0.5;

/** Just enough of a monster for its tricks to run on. */
function monster(id: string, z: number) {
  const def = ENEMIES[id];
  const m = {
    def, state: 'walk', z, x: 0, laneX: 0, spawnX: 0, targetX: 0, stopZ: FIELD.attackZ, goal: null as unknown,
    hp: def.health, maxHp: def.health, channelLeft: 0, staggerLeft: 0, slowLeft: 0, revealLeft: 0,
    hidden: false, veil: 1, lift: 0, squash: 0, pop: 0, swerve: 0, action: null as string | null,
    trick: newTrick(), moves: [] as string[], bites: 0, surfaced: 0,
    windUp(kind: string) { this.moves.push(kind); this.channelLeft = 1; },
    bite() { this.state = 'attack'; this.bites++; },
    moveLane(x: number) { this.x = this.laneX = x; },
    surface() { this.surfaced++; this.state = 'walk'; },
  };
  startTricks(m as unknown as Zombie, half);
  return m;
}

type Monster = ReturnType<typeof monster>;
/** Runs `seconds` of tricks, walking it in meanwhile, and calls `see` after each frame. */
function run(m: Monster, seconds: number, speed = 0, see: (t: number) => void = () => {}): void {
  for (let t = 0; t < seconds; t += FRAME) {
    const busy = runTricks(m as unknown as Zombie, FRAME, half);
    if (!busy && m.state === 'walk' && m.channelLeft <= 0) m.z = Math.max(m.stopZ, m.z - speed * FRAME);
    if (m.channelLeft > 0) m.channelLeft = Math.max(0, m.channelLeft - FRAME);
    see(t);
  }
}

describe('the Hollow Hound', () => {
  it('springs from one side to the other on its way in', () => {
    const m = monster('hollow_hound', 40);
    let left = 0, right = 0, highest = 0;
    run(m, 7, 2, () => {
      left = Math.min(left, m.swerve);
      right = Math.max(right, m.swerve);
      highest = Math.max(highest, m.lift);
    });
    expect(right - left).toBeGreaterThan(2);
    expect(highest).toBeGreaterThan(0.5);
  });

  it('crouches before it pounces, then bites at the wire', () => {
    const m = monster('hollow_hound', 8.5);
    let crouched = false, flew = false;
    run(m, 1.2, 0, () => {
      if (m.squash > 0.5 && m.lift === 0 && m.z > 8) crouched = true;
      if (m.lift > 0.8) flew = true;
    });
    expect(crouched).toBe(true);
    expect(flew).toBe(true);
    expect(m.bites).toBe(1);
    expect(m.z).toBeCloseTo(m.stopZ);
  });

  it('cannot leap while slowed by cryo rounds', () => {
    const m = monster('hollow_hound', 30);
    m.slowLeft = 60;
    run(m, 6, 1, () => expect(m.lift).toBe(0));
  });
});

describe('the Stalker', () => {
  const gone = ENEMIES.stalker.special!.vanish!;

  it('flickers, is unseen for a while, and comes back close', () => {
    const m = monster('stalker', 32);
    let hiddenFrom = -1, backAt = -1, flickered = false;
    run(m, 9, 3.6, (t) => {
      if (!m.hidden && m.veil < 0.8 && m.trick.phase === 'flicker') flickered = true;
      if (m.hidden && hiddenFrom < 0) hiddenFrom = t;
      if (!m.hidden && hiddenFrom >= 0 && backAt < 0) {
        backAt = t;
        expect(m.z).toBeGreaterThanOrEqual(gone.back[0] - 0.01);
        expect(m.z).toBeLessThanOrEqual(gone.back[1] + 0.01);
        expect(m.action).toBe('ambush');
      }
    });
    expect(flickered).toBe(true);
    expect(backAt - hiddenFrom).toBeGreaterThan(gone.gone - 0.1);
    expect(m.hidden).toBe(false);
  });

  it('stands a moment after appearing, so it can be shot', () => {
    const m = monster('stalker', m0());
    run(m, TELL.flicker + gone.gone + 0.1, 3.6);
    const at = m.z;
    run(m, TELL.appear - 0.2, 3.6);
    expect(m.z).toBeCloseTo(at);
  });

  it('only does it as often as its data says, and never under the lamp', () => {
    const lit = monster('stalker', 32);
    lit.revealLeft = 60;
    run(lit, 6, 3.6, () => expect(lit.hidden).toBe(false));
    const m = monster('stalker', 32);
    let times = 0, was = false;
    run(m, 20, 1.5, () => {
      if (m.hidden && !was) times++;
      was = m.hidden;
    });
    expect(times).toBe(gone.times);
  });

  function m0(): number {
    return monster('stalker', 90).trick.at;
  }
});

describe('the Brute, the Wraith, the Crimson Brute and the Lurker', () => {
  it('the Brute roars again and again once it is near enough', () => {
    const m = monster('brute', 40);
    run(m, 20);
    expect(m.moves.filter((k) => k === 'roar').length).toBeGreaterThanOrEqual(2);
    const far = monster('brute', 80);
    run(far, 20);
    expect(far.moves).toEqual([]);
  });

  it('the Wraith works its spell only close in, and only so many times', () => {
    const gloom = ENEMIES.wraith.special!.gloom!;
    const far = monster('wraith', gloom.castAt + 6);
    run(far, 5);
    expect(far.moves).toEqual([]);
    const near = monster('wraith', gloom.castAt - 2);
    run(near, 60);
    expect(near.moves).toEqual(Array(gloom.casts).fill('veil'));
  });

  it('the Crimson Brute winds up a rush once', () => {
    const m = monster('crimson_brute', ENEMIES.crimson_brute.special!.rush!.from - 1);
    run(m, 8);
    expect(m.moves).toEqual(['rush']);
  });

  it('the Lurker dives once when hurt and comes up closer', () => {
    const m = monster('lurker', 24);
    run(m, 2);
    expect(m.hidden).toBe(false);
    m.hp = m.maxHp * 0.4;
    let went = false;
    run(m, 3, 0, () => { went ||= m.hidden; });
    expect(went).toBe(true);
    expect(m.surfaced).toBe(1);
    expect(m.z).toBeLessThan(20);
  });

  it('a trick broken off leaves the monster in plain sight on the ground', () => {
    const m = monster('stalker', 32);
    run(m, 4, 3.6);
    expect(m.trick.phase).not.toBe('');
    breakTricks(m as unknown as Zombie);
    expect([m.hidden, m.veil, m.lift]).toEqual([false, 1, 0]);
  });
});
