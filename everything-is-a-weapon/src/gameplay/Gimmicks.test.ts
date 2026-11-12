import { expect, it } from 'vitest';
import { doorPosition } from './Room';
import { generateRoom } from './RoomGenerator';

const GIMMICKS = ['music', 'glass', 'foam', 'magnet'];
const seedOf = (i: number): number => 1000 + i * 7;

const gimmickZones = (i: number) => generateRoom(i, seedOf(i)).zones.filter((z) => GIMMICKS.includes(z.kind));

it('about half of the rooms without a boss or objective have one gimmick, never more, and it has a teaser', () => {
  let eligible = 0;
  let withGimmick = 0;
  const kinds = new Set<string>();
  for (let i = 8; i < 308; i++) {
    const room = generateRoom(i, seedOf(i));
    const zones = room.zones.filter((z) => GIMMICKS.includes(z.kind));
    expect(zones.length, `room ${i}`).toBeLessThanOrEqual(1);
    if ((i + 1) % 3 === 0 || room.objective) {
      expect(zones, `room ${i} has a boss or an objective`).toHaveLength(0);
      continue;
    }
    eligible++;
    if (zones.length === 1) {
      withGimmick++;
      kinds.add(zones[0]!.kind);
      expect(room.teaser, `room ${i} names its twist`).toBeTruthy();
    } else {
      expect(room.teaser).toBeUndefined();
    }
  }
  expect(withGimmick / eligible).toBeGreaterThan(0.4);
  expect(withGimmick / eligible).toBeLessThan(0.75);
  expect([...kinds].sort()).toEqual(['foam', 'glass', 'magnet', 'music']);
});

it('a gimmick zone never covers the hero start or a door, and stays inside the room', () => {
  for (let i = 8; i < 308; i++) {
    const room = generateRoom(i, seedOf(i));
    const [zone] = gimmickZones(i);
    if (!zone) continue;
    const start = room.playerStart;
    expect(Math.hypot(zone.x - start.x, zone.y - start.y), `room ${i} start`).toBeGreaterThan(zone.r + 60);
    for (const door of [room.entrance, room.exit]) {
      const d = doorPosition(room, door, 20);
      expect(Math.hypot(zone.x - d.x, zone.y - d.y), `room ${i} door`).toBeGreaterThan(zone.r + 60);
    }
    expect(zone.x - zone.r).toBeGreaterThan(0);
    expect(zone.x + zone.r).toBeLessThan(room.width);
    expect(zone.y - zone.r).toBeGreaterThan(0);
    expect(zone.y + zone.r).toBeLessThan(room.height);
  }
});

it('the same seed gives the same gimmick', () => {
  for (let i = 8; i < 60; i++) expect(generateRoom(i, seedOf(i))).toEqual(generateRoom(i, seedOf(i)));
});
