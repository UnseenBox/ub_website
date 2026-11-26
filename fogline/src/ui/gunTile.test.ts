import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../data/weapons';
import { weaponUnlockMission } from '../systems/Campaign';
import { ShopItem, gunShelf } from '../systems/Shop';
import { WAVE, flickerAt, gunCrop, toGrey, waveAt } from './gunTileMath';

describe('gun tiles', () => {
  it('frames every gun with a square that stays inside its picture', () => {
    for (const w of WEAPONS) {
      for (const [width, height] of [[1280, 720], [1280, 853], [1280, 714]]) {
        const c = gunCrop(w.id, width, height);
        expect(c.side).toBe(height);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.side).toBeLessThanOrEqual(width);
        expect(c.y).toBe(0);
      }
    }
  });

  it('drains the colour from a locked gun and keeps its outline', () => {
    const px = new Uint8ClampedArray([200, 40, 20, 255, 10, 220, 250, 128]);
    toGrey(px);
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[4]).toBe(px[6]);
    expect([px[3], px[7]]).toEqual([255, 128]);
  });

  it('rolls a wave from above the tile to below it, with a rest between', () => {
    const size = 150;
    expect(waveAt(0, 0, size)).toBeCloseTo(-size * WAVE.height);
    expect(waveAt(WAVE.travel * 0.999, 0, size)!).toBeGreaterThan(size * 0.99);
    expect(waveAt(WAVE.travel + 0.1, 0, size)).toBeNull();
    expect(waveAt(WAVE.period, 0, size)).toBeCloseTo(-size * WAVE.height);
    // neighbours are out of step
    expect(waveAt(0.5, 0, size)).not.toBe(waveAt(0.5, 1, size));
  });

  it('flickers only now and then', () => {
    let on = 0;
    for (let t = 0; t < 37; t += 0.01) if (flickerAt(t, 2)) on++;
    expect(on).toBeGreaterThan(0);
    expect(on / 3700).toBeLessThan(0.05);
  });

  it('gives each gun one square that sells the gun, then its rounds', () => {
    const item = (id: string, category: ShopItem['category']) => ({ id, category }) as ShopItem;
    const shelf = gunShelf([
      item('weapon:m4', 'weapons'), item('ammo:m4', 'weapons'), item('ammo:m82', 'weapons'), item('mod:ap', 'mods'),
    ]);
    expect(shelf.map((g) => g.id)).toEqual(['m4', 'm82']);
    expect(shelf[0].pick(false).id).toBe('weapon:m4');
    expect(shelf[0].pick(true).id).toBe('ammo:m4');
    // a gun carried into the mission only ever sells rounds
    expect(shelf[1].pick(false).id).toBe('ammo:m82');
  });

  it('can say which mission unlocks every gun that starts locked', () => {
    for (const w of WEAPONS.filter((g) => g.price > 0)) {
      expect(weaponUnlockMission(w.id)?.firstClear.weapons, w.id).toContain(w.id);
    }
    expect(weaponUnlockMission('service')).toBeUndefined();
  });
});
