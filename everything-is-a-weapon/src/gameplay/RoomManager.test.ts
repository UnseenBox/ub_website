import { describe, expect, it } from 'vitest';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { CAMPAIGN_ROOMS, FINAL_ROOM_INDEX } from './Campaign';
import { bossSpecFor, campaignBossSlots, RoomManager } from './RoomManager';

const ALL_BOSSES: readonly EnemyTypeId[] = [
  'chairman',
  'flusher',
  'kraken',
  'fridgezilla',
  'piano',
  'mower',
  'mom',
  'house',
  'vacuumasaurus',
  'hydra',
  'fan',
  'popcorn',
  'cables',
  'cooker',
  'train',
  'junk',
  'clock',
  'toybox',
  'dishwasher',
  'cardboard',
];

describe('the 50-room campaign', () => {
  it('has fifty stable room definitions and a final door', () => {
    const rooms = new RoomManager();
    expect(CAMPAIGN_ROOMS).toBe(50);
    expect(FINAL_ROOM_INDEX).toBe(49);
    expect(rooms.roomCount).toBe(50);

    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    expect(new Set(defs.map((def) => def.id)).size).toBe(CAMPAIGN_ROOMS);
    expect(defs[FINAL_ROOM_INDEX]).toMatchObject({
      id: 'final-49',
      name: 'THE LAST DOOR',
      boss: 'cardboard',
    });
  });

  it('generates the same campaign layouts in every session', () => {
    const first = new RoomManager();
    const second = new RoomManager();
    for (const index of [9, 10, 15, 27, 42]) {
      const a = first.definition(index);
      const b = second.definition(index);
      expect(a.id).toBe(b.id);
      expect(a.seed).toBe(b.seed);
      expect(a.name).toBe(b.name);
    }
  });

  it('schedules all twenty bosses exactly once', () => {
    const rooms = new RoomManager();
    const scheduled = campaignBossSlots();
    expect(scheduled).toHaveLength(ALL_BOSSES.length);
    expect(new Set(scheduled.map((slot) => slot.type))).toEqual(new Set(ALL_BOSSES));

    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    const specs = defs
      .map((def, index) => bossSpecFor(index, false, def))
      .filter((spec): spec is NonNullable<typeof spec> => spec !== null);
    expect(specs).toHaveLength(ALL_BOSSES.length);
    expect(new Set(specs.map((spec) => spec.type))).toEqual(new Set(ALL_BOSSES));
  });

  it('puts the King of Cardboard in room 50', () => {
    const rooms = new RoomManager();
    const final = rooms.definition(FINAL_ROOM_INDEX);
    expect(bossSpecFor(FINAL_ROOM_INDEX, false, final)?.type).toBe('cardboard');
  });
});
