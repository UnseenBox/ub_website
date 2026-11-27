// The squad: survivors who join the line in Act 2 and fight from the side
// firing positions of the bunker. They are always weaker than the player:
// they cover a weak side, they never play the game for you.

export type RecruitId = 'dot' | 'mara' | 'brick' | 'kestrel' | 'rook' | 'vesna';
export type RecruitRole = 'engineer' | 'sniper' | 'gunner' | 'pilot' | 'grenadier' | 'mortar';

export interface RecruitDef {
  id: RecruitId;
  name: string;
  role: RecruitRole;
  /** One line for the Barracks card. */
  description: string;
  /** Damage per shot (sniper, gunner) or bunker health repaired per second (engineer), at level 1. */
  power: number;
  /** Seconds between shots (sniper, gunner). */
  interval: number;
  /** How far out they engage, in metres. */
  range: number;
  /** Said over the radio when a wave starts and they are in position, so you know they are ready. */
  ready: string;
  /** Radio lines, picked at random now and then. */
  lines: string[];
}

export const RECRUITS: RecruitDef[] = [
  {
    id: 'dot',
    name: 'Dot Okafor',
    role: 'engineer',
    description: 'Engineer. Patches the bunker while the waves are on.',
    power: 6,
    interval: 0,
    range: 0,
    ready: 'On the left wall, patching as we go.',
    lines: ['Holding it together, Warden.', 'Patching the left wall!', 'Sandbags up. Keep shooting.'],
  },
  {
    id: 'mara',
    name: 'Mara Ilic',
    role: 'sniper',
    description: 'Sniper. Slow, deadly shots at the farthest threat. Spitters and Screamers first.',
    power: 170,
    interval: 2.6,
    range: 75,
    ready: 'In position at the left window, covering the far field.',
    lines: ['Got the screamer.', 'Long one down.', 'Watching the far field.'],
  },
  {
    id: 'brick',
    name: 'Brick Mensah',
    role: 'gunner',
    description: 'Gunner. Sprays anything that gets close to the wire.',
    power: 22,
    interval: 0.16,
    range: 16,
    ready: 'On the right window. Nothing gets to the wire.',
    lines: ['Too close! Too close!', 'Nothing gets over this wall.', 'Reloading. Cover me!'],
  },
  {
    id: 'kestrel',
    name: 'Kestrel Hart',
    role: 'pilot',
    description: 'Pilot. Calls her gunship in to strafe the thickest lane.',
    power: 70,
    interval: 38,
    range: 70,
    ready: 'Gunship on standby. Circling the lane.',
    lines: ['Coming in hot. Keep your heads down!', 'Rolling in on the lane.', 'Kestrel, off target. Going round again.'],
  },
  {
    id: 'rook',
    name: 'Rook Adeyemi',
    role: 'grenadier',
    description: 'Grenadier. Lobs grenades into the biggest crowd.',
    power: 120,
    interval: 7,
    range: 45,
    ready: 'Grenades ready. Waiting for a crowd.',
    lines: ['Frag out!', 'That bunched them nicely.', 'Grenade! Down range!'],
  },
  {
    id: 'vesna',
    name: 'Vesna Kral',
    role: 'mortar',
    description: 'Mortar crew. Shells the farthest group before it reaches you.',
    power: 260,
    interval: 12,
    range: 90,
    ready: 'Mortar laid on the far field. Ready when you are.',
    lines: ['Shot out! Splash in five.', 'Adjusting fire.', 'Target the far field? Gladly.'],
  },
];

export const SQUAD_SLOTS = 2;
export const MAX_RECRUIT_LEVEL = 5;

export function recruitById(id: string): RecruitDef | undefined {
  return RECRUITS.find((r) => r.id === id);
}

/** Supplies to train a recruit from `level` to the next one, or null at the max. */
export function recruitCost(level: number): number | null {
  if (level >= MAX_RECRUIT_LEVEL) return null;
  return Math.round(90 * 1.5 ** (level - 1));
}

/** A recruit's power at a level: +15% per level above 1 (and engineers repair faster). */
export function recruitPower(def: RecruitDef, level: number): number {
  return def.power * (1 + 0.15 * (Math.max(1, level) - 1));
}

/** Seconds between shots at a level: 5% quicker per level above 1. */
export function recruitInterval(def: RecruitDef, level: number): number {
  return def.interval * (1 - 0.05 * (Math.max(1, level) - 1));
}
