import { Rng, hashString } from '../core/Random';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { actFor, FINAL_ROOM_INDEX } from './Campaign';
import { EDGES, EDGE_STACK_CAP, edgeStacks, type EdgeId } from './Edges';
import { campaignBossType } from './RoomManager';
import type { RoomDefinition, RoomTheme } from './Room';

/**
 * NIGHT SHIFT: a short branching run through the whole building.
 *
 * The 50 campaign rooms stay exactly where they are. A shift draws its route from
 * them act by act: a couple from each act, with the last picked room in the top act
 * and the last door always the King of Cardboard. Every clear opens three doors;
 * each door is a room, one reward, and one honest risk. Nothing here touches the
 * simulation — it only chooses indices and describes them, so it is cheap to test
 * and safe to resume from a save.
 */

export type DoorRewardKind = 'scrap' | 'edge' | 'armor';

export interface DoorReward {
  kind: DoorRewardKind;
  /** Big line on the card, e.g. "+70 SCRAP" or an Edge name. */
  label: string;
  /** Small supporting line. */
  detail: string;
  scrap?: number;
  edge?: EdgeId;
}

export interface DoorRisk {
  /** Short chip: BOSS, HAZARD, CLOCK, OBJECTIVE, CREW. */
  label: string;
  detail: string;
}

export interface Door {
  /** Campaign room index, 0-based. */
  index: number;
  /** Room number shown on the card, 1-based. */
  number: number;
  name: string;
  actName: string;
  actTagline: string;
  reward: DoorReward;
  risk: DoorRisk;
}

/** How many rooms a full shift picks before the finale door. */
export const SHIFT_PICKS = 8;
/** Doors offered after a clear. */
export const SHIFT_DOORS = 3;
const TIER_SIZE = 10;
const FINAL_TIER = 4;

const HAZARDS: Partial<Record<RoomTheme, string>> = {
  bathroom: 'water + electricity',
  pool: 'deep water',
  kitchen: 'fire + grease',
  garage: 'oil + sparks',
  basement: 'boiler + bad wiring',
  garden: 'pond + bugs',
};

/** The five ten-room acts are the shift's difficulty tiers. */
export function shiftTier(index: number): number {
  if (index >= FINAL_ROOM_INDEX) return FINAL_TIER;
  return Math.min(FINAL_TIER, Math.max(0, Math.floor(index / TIER_SIZE)));
}

/** Indices a tier can draw from, never including the finale. */
function tierRooms(tier: number): number[] {
  const from = tier * TIER_SIZE;
  const to = Math.min(FINAL_ROOM_INDEX - 1, from + TIER_SIZE - 1);
  const rooms: number[] = [];
  for (let index = from; index <= to; index++) rooms.push(index);
  return rooms;
}

/**
 * How many doors this shift will open before the finale. Starting deep in the
 * building means a shorter night: there are only so many rooms left above the
 * last door.
 */
export function shiftPicks(startIndex: number): number {
  const startTier = shiftTier(startIndex);
  let available = 0;
  for (let tier = startTier; tier <= FINAL_TIER; tier++) available += tierRooms(tier).length;
  // The starting room is in that pool, but it is not a door.
  return Math.min(SHIFT_PICKS, Math.max(0, available - 1));
}

/**
 * The act each step of the shift should draw from. It starts at the starting
 * room's act and reaches the top act by the final pick, so a run always tours the
 * building instead of looping in one floor.
 */
export function shiftSchedule(startIndex: number): number[] {
  const startTier = shiftTier(startIndex);
  const span = FINAL_TIER + 1 - startTier;
  return Array.from({ length: shiftPicks(startIndex) }, (_, step) =>
    Math.min(FINAL_TIER, startTier + Math.floor((step * span) / SHIFT_PICKS)),
  );
}

function shuffle(rng: Rng, items: number[]): number[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/**
 * Distinct rooms for the next choice, excluding everywhere the shift has already
 * been. `step` is 0-based (the first choice after the starting room is 0). When
 * the act is nearly exhausted the pool widens upwards; when nothing is left, the
 * only door is the finale.
 */
export function nextDoorIndices(
  step: number,
  startIndex: number,
  visited: readonly number[],
  finale: number,
  seed: number,
): number[] {
  const seen = new Set(visited);
  if (seen.has(finale)) return [];
  const schedule = shiftSchedule(startIndex);
  if (step >= schedule.length) return [finale];

  const visitedSet = new Set(visited);
  const tier = schedule[step]!;
  let pool = tierRooms(tier).filter((index) => !visitedSet.has(index));
  if (pool.length < 2) {
    pool = [];
    for (let t = shiftTier(startIndex); t <= FINAL_TIER; t++) {
      for (const index of tierRooms(t)) if (!visitedSet.has(index)) pool.push(index);
    }
  }

  const rng = new Rng(hashString(`${seed}:doors:${step}`));
  const picked = shuffle(rng, pool).slice(0, SHIFT_DOORS).sort((a, b) => a - b);
  return picked.length > 0 ? picked : [finale];
}

function riskFor(index: number, def: RoomDefinition): DoorRisk {
  const boss = campaignBossType(index, def);
  if (boss) {
    return index === FINAL_ROOM_INDEX
      ? { label: 'BOSS', detail: 'the King of Cardboard' }
      : { label: 'BOSS', detail: `${ENEMY_TYPES[boss].name} is waiting` };
  }
  if (def.objective?.kind === 'survive') {
    return { label: 'CLOCK', detail: `survive ${def.objective.seconds}s` };
  }
  if (def.challenge) {
    return { label: 'OBJECTIVE', detail: 'a bonus objective is inside' };
  }
  const hazard = def.theme ? HAZARDS[def.theme] : undefined;
  if (hazard) return { label: 'HAZARD', detail: hazard };
  return { label: 'CREW', detail: 'a full room of movers' };
}

function rewardFor(
  index: number,
  seed: number,
  tier: number,
  kind: DoorRewardKind,
  owned: readonly string[],
): DoorReward {
  if (index === FINAL_ROOM_INDEX) {
    return {
      kind: 'scrap',
      label: 'THE LEASE',
      detail: 'the last door. the king is behind it.',
      scrap: 0,
    };
  }
  if (kind === 'scrap') {
    const rng = new Rng(hashString(`${seed}:${index}:scrap`));
    const scrap = 40 + tier * 25 + rng.int(0, 30);
    return { kind: 'scrap', label: `+${scrap} SCRAP`, detail: 'straight to the purse', scrap };
  }
  if (kind === 'armor') {
    return { kind: 'armor', label: '+1 BUBBLE WRAP', detail: 'start the next room armoured' };
  }
  const rng = new Rng(hashString(`${seed}:${index}:edge`));
  const eligible = EDGES.filter((edge) => edgeStacks(owned, edge.id) < EDGE_STACK_CAP);
  if (eligible.length === 0) {
    // Every Edge is maxed: pay scrap rather than promise something unusable.
    const fallback = new Rng(hashString(`${seed}:${index}:scrap`));
    const scrap = 40 + tier * 25 + fallback.int(0, 30);
    return { kind: 'scrap', label: `+${scrap} SCRAP`, detail: 'straight to the purse', scrap };
  }
  const edge = eligible[rng.int(0, eligible.length - 1)]!;
  return { kind: 'edge', label: edge.name, detail: edge.effect, edge: edge.id };
}

export function buildDoor(
  index: number,
  def: RoomDefinition,
  tier: number,
  seed: number,
  kind: DoorRewardKind,
  owned: readonly string[] = [],
): Door {
  const act = actFor(index);
  return {
    index,
    number: index + 1,
    name: index === FINAL_ROOM_INDEX ? 'THE LAST DOOR' : def.name,
    actName: act.name,
    actTagline: act.tagline,
    reward: rewardFor(index, seed, tier, kind, owned),
    risk: riskFor(index, def),
  };
}

const REWARD_KINDS: readonly DoorRewardKind[] = ['scrap', 'edge', 'armor'];

/**
 * Builds the clickable cards for a set of stored indices. The reward kind is
 * assigned by sorted position, so a save that only stores indices still shows
 * exactly the same rewards when the player comes back.
 */
export function buildDoors(
  indices: readonly number[],
  seed: number,
  step: number,
  lookup: (index: number) => RoomDefinition,
  owned: readonly string[] = [],
): Door[] {
  const rotate = hashString(`${seed}:kinds:${step}`) % REWARD_KINDS.length;
  const ordered = [...new Set(indices)].sort((a, b) => a - b);
  return ordered.map((index, position) => {
    const kind = index === FINAL_ROOM_INDEX
      ? 'scrap'
      : REWARD_KINDS[(position + rotate) % REWARD_KINDS.length]!;
    return buildDoor(index, lookup(index), shiftTier(index), seed, kind, owned);
  });
}
