import { describe, expect, it } from 'vitest';
import { FINAL_ROOM_INDEX } from './Campaign';
import { EDGE_STACK_CAP, EDGES } from './Edges';
import {
  SHIFT_DOORS,
  SHIFT_PICKS,
  buildDoor,
  buildDoors,
  nextDoorIndices,
  shiftPicks,
  shiftSchedule,
  shiftTier,
} from './NightShift';
import type { RoomDefinition } from './Room';

/** A minimal real-shaped room; risks and names come from these fields. */
function room(index: number): RoomDefinition {
  return {
    id: `room-${index + 1}`,
    name: index === FINAL_ROOM_INDEX ? 'THE LAST DOOR' : `ROOM ${index + 1}`,
    theme: 'living',
    width: 900,
    height: 520,
    objects: [],
    zones: [],
    enemies: [],
    boss: index === FINAL_ROOM_INDEX ? 'cardboard' : undefined,
    entrance: { side: 'top', pos: 450 },
    exit: { side: 'left', pos: 260 },
    playerStart: { x: 450, y: 300 },
    seed: 100 + index,
  };
}

const lookup = (index: number): RoomDefinition => room(index);

describe('Night Shift', () => {
  it('treats each act as a difficulty tier', () => {
    expect(shiftTier(0)).toBe(0);
    expect(shiftTier(9)).toBe(0);
    expect(shiftTier(10)).toBe(1);
    expect(shiftTier(29)).toBe(2);
    expect(shiftTier(49)).toBe(4);
  });

  it('a full shift tours every act and ends with the top tier', () => {
    const schedule = shiftSchedule(0);
    expect(schedule).toHaveLength(SHIFT_PICKS);
    expect(schedule[0]).toBe(0);
    expect(schedule[schedule.length - 1]).toBe(4);
    expect(new Set(schedule)).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('starts deep in the building only for the rooms that are left', () => {
    expect(shiftPicks(0)).toBe(SHIFT_PICKS);
    expect(shiftPicks(40)).toBe(8);
    expect(shiftPicks(48)).toBe(8);
    expect(shiftSchedule(40).every((tier) => tier === 4)).toBe(true);
  });

  it('never repeats a visited room and keeps the finale for last', () => {
    let visited = [0];
    for (let step = 0; step < SHIFT_PICKS; step++) {
      const doors = nextDoorIndices(step, 0, visited, FINAL_ROOM_INDEX, 1234);
      expect(doors).toHaveLength(SHIFT_DOORS);
      for (const index of doors) {
        expect(visited).not.toContain(index);
        expect(index).not.toBe(FINAL_ROOM_INDEX);
      }
      visited = [...visited, doors[0]!];
    }
    // The schedule is spent: the only door left is the King of Cardboard.
    expect(nextDoorIndices(SHIFT_PICKS, 0, visited, FINAL_ROOM_INDEX, 1234)).toEqual([FINAL_ROOM_INDEX]);
    expect(nextDoorIndices(SHIFT_PICKS + 4, 0, visited, FINAL_ROOM_INDEX, 1234)).toEqual([FINAL_ROOM_INDEX]);
  });

  it('rebuilds the same doors for the same seed and step', () => {
    const first = nextDoorIndices(3, 0, [0, 4, 5], FINAL_ROOM_INDEX, 777);
    const second = nextDoorIndices(3, 0, [0, 4, 5], FINAL_ROOM_INDEX, 777);
    expect(second).toEqual(first);

    const one = buildDoors([1, 7, 14], 9876, 2, lookup);
    const two = buildDoors([1, 7, 14], 9876, 2, lookup);
    expect(two).toEqual(one);
    expect(buildDoor(7, room(7), shiftTier(7), 9876, 'scrap')).toEqual(
      buildDoor(7, room(7), shiftTier(7), 9876, 'scrap'),
    );
  });

  it('three doors always carry three distinct reward kinds', () => {
    const doors = buildDoors([2, 11, 25], 42, 4, lookup);
    expect(doors.map((door) => door.number)).toEqual([3, 12, 26]);
    expect(new Set(doors.map((door) => door.reward.kind)).size).toBe(3);
    for (const door of doors) {
      expect(door.name.length).toBeGreaterThan(0);
      expect(door.risk.label.length).toBeGreaterThan(0);
      expect(door.risk.detail.length).toBeGreaterThan(0);
      expect(door.reward.label.length).toBeGreaterThan(0);
    }
  });

  it('never offers an Edge that is already at its stack cap', () => {
    // Every Edge is maxed except one, so the Edge door has to be that one.
    const owned = EDGES.filter((edge) => edge.id !== 'heavy_hands')
      .flatMap((edge) => Array<string>(EDGE_STACK_CAP).fill(edge.id));
    const doors = buildDoors([1, 2, 3], 5, 0, lookup, owned);
    const edgeDoor = doors.find((door) => door.reward.kind === 'edge');
    expect(edgeDoor?.reward.edge).toBe('heavy_hands');
  });

  it('reads boss, clock and hazard risks from the room itself', () => {
    const boss = buildDoor(FINAL_ROOM_INDEX, room(FINAL_ROOM_INDEX), 4, 1, 'scrap');
    expect(boss.risk).toEqual({ label: 'BOSS', detail: 'the King of Cardboard' });
    expect(boss.name).toBe('THE LAST DOOR');

    const headliner = buildDoor(3, { ...room(3), boss: 'chairman' }, 0, 1, 'scrap');
    expect(headliner.risk).toEqual({ label: 'BOSS', detail: 'Chairman is waiting' });

    const clock = buildDoor(3, { ...room(3), objective: { kind: 'survive', seconds: 30 } }, 0, 1, 'scrap');
    expect(clock.risk).toEqual({ label: 'CLOCK', detail: 'survive 30s' });

    const hazard = buildDoor(4, { ...room(4), theme: 'bathroom' }, 0, 1, 'scrap');
    expect(hazard.risk).toEqual({ label: 'HAZARD', detail: 'water + electricity' });
  });

  it('names the last door and pays the lease, not a normal reward', () => {
    const door = buildDoor(FINAL_ROOM_INDEX, room(FINAL_ROOM_INDEX), 4, 1, 'edge');
    expect(door.number).toBe(50);
    expect(door.reward.kind).toBe('scrap');
    expect(door.reward.label).toBe('THE LEASE');
    expect(door.reward.scrap).toBe(0);
  });
});
