// The retention layer (Phase 3): reasons to come back tomorrow. Daily supply drop,
// daily contracts, the Fog Surge daily challenge, the Supply Depot, Last Stand
// (endless), Field Notes (the enemy codex) and weapon mastery skins.
//
// Everything here is plain data; the rules live in systems/Retention.ts.

/** Missions whose first win opens each part of the HQ. */
export const HQ_UNLOCK = 'a1m5';
export const SURGE_UNLOCK = 'a1m7';
export const ENDLESS_UNLOCK = 'a1m9';

// ------------------------------------------------------------------ daily supply drop

export interface LoginReward {
  supplies: number;
  /** Day 7 also paints a weapon in the Crimson skin. */
  skin?: boolean;
}

/** A seven-day calendar. Missing one day keeps the streak; missing two starts it over. */
export const LOGIN_REWARDS: LoginReward[] = [
  { supplies: 40 },
  { supplies: 60 },
  { supplies: 80 },
  { supplies: 100 },
  { supplies: 120 },
  { supplies: 150 },
  { supplies: 200, skin: true },
];
/** Supplies instead of the skin once every weapon already has it. */
export const LOGIN_SKIN_FALLBACK = 100;

// ------------------------------------------------------------------ daily contracts

export type ContractKind =
  | 'kills' | 'headshots' | 'enemy' | 'weapon' | 'wins' | 'objective' | 'stars' | 'supports' | 'streak' | 'surge' | 'endless';

export const CONTRACTS_PER_DAY = 3;
/** Paid once all of today's contracts are done. */
export const CONTRACT_SET_BONUS = 100;

/** Targets and pay per contract kind. `enemy` targets depend on the enemy. */
export const CONTRACT_RULES: Record<ContractKind, { target: number; reward: number }> = {
  kills: { target: 150, reward: 70 },
  headshots: { target: 50, reward: 80 },
  enemy: { target: 0, reward: 70 },
  weapon: { target: 80, reward: 70 },
  wins: { target: 2, reward: 80 },
  objective: { target: 1, reward: 70 },
  stars: { target: 6, reward: 80 },
  supports: { target: 4, reward: 60 },
  streak: { target: 25, reward: 90 },
  surge: { target: 1, reward: 100 },
  endless: { target: 8, reward: 100 },
};

/** How many of each enemy an "enemy" contract asks for. */
export const ENEMY_CONTRACT_TARGET: Record<string, number> = {
  shambler: 100, brute: 8, spitter: 10, lurker: 20, ravager: 4,
  hollow_hound: 25, wraith: 12, stalker: 12, carrion_screamer: 6, pumpkin_brood: 6, crimson_brute: 4,
};

// ------------------------------------------------------------------ supply depot

export interface DepotLevel {
  /** Supplies produced per hour. */
  rate: number;
  /** Hours of production it can hold before it stops. */
  capHours: number;
}

export const DEPOT_LEVELS: DepotLevel[] = [
  { rate: 15, capHours: 8 },
  { rate: 20, capHours: 9 },
  { rate: 26, capHours: 10 },
  { rate: 32, capHours: 11 },
  { rate: 40, capHours: 12 },
];

/** Supplies to raise the depot from level `level` (1-based) to the next. */
export const DEPOT_UPGRADE_COST = [200, 350, 600, 900];

// ------------------------------------------------------------------ fog surge

export type SurgeModifierId = 'night' | 'drops' | 'horde' | 'fast' | 'armoured' | 'bounty' | 'glass';

export const SURGE_MODIFIERS: Record<SurgeModifierId, { name: string; text: string }> = {
  night: { name: 'NIGHT', text: 'Darkness; flares on Q' },
  drops: { name: 'SUPPLY DROPS', text: 'Crates parachute in' },
  horde: { name: 'HORDE', text: '35% more of the dead' },
  fast: { name: 'QUICKENED', text: 'Everything moves faster' },
  armoured: { name: 'HARDENED', text: 'The dead take 30% more to drop' },
  bounty: { name: 'BOUNTY', text: 'Kills pay 50% more cash' },
  glass: { name: 'THIN WALLS', text: 'The bunker starts at 65% health' },
};

/** Supplies for the first Fog Surge win of the day, and for any other finish. */
export const SURGE_FIRST_WIN = 250;
export const SURGE_REPLAY = 30;

export const SURGE_NAMES_A = ['Grey', 'Black', 'Long', 'Cold', 'Red', 'Silent', 'Hollow', 'Iron', 'Low', 'Pale'];
export const SURGE_NAMES_B = ['Tide', 'Rain', 'Night', 'Harvest', 'Mile', 'Chorus', 'Hour', 'Front', 'March', 'Wake'];

// ------------------------------------------------------------------ last stand (endless)

export const ENDLESS_WAVES = 60;
export const ENDLESS_CASH = 600;
/** Supplies per wave survived, paid on every run. */
export const ENDLESS_PER_WAVE = 8;
/** One-time rewards for reaching a wave in Last Stand. */
export const ENDLESS_MILESTONES: { wave: number; supplies: number }[] = [
  { wave: 5, supplies: 60 },
  { wave: 10, supplies: 120 },
  { wave: 15, supplies: 200 },
  { wave: 20, supplies: 320 },
  { wave: 25, supplies: 480 },
  { wave: 30, supplies: 700 },
];

// ------------------------------------------------------------------ field notes (codex)

/** Kill counts that unlock each page of an enemy's notes, and what each one pays. */
export const CODEX_TIERS: { kills: number; supplies: number }[] = [
  { kills: 10, supplies: 15 },
  { kills: 100, supplies: 50 },
  { kills: 500, supplies: 150 },
];

/** Dr. Varga's notes: page 1 is the enemy's intel line, page 2 a tactic, page 3 what she knows. */
export const FIELD_NOTES: Record<string, { tactic: string; lore: string }> = {
  shambler: {
    tactic: 'Slow, but they never stop. A clean headshot is cheaper than a magazine in the chest.',
    lore: 'Most of them still wear what they died in. The fog keeps the body, not the person.',
  },

  brute: {
    tactic: 'Too heavy to stagger. Grenades, the .50 and armour-piercing rounds do the work.',
    lore: 'Fog builds on fog: a Brute has more than one body inside it. I stopped counting at four.',
  },

  colossus: {
    tactic: 'Leg and head damage both count. When it roars, the next swing is coming: shutters up.',
    lore: 'Built from the farm line\'s own dead. The fog remembers where we fought.',
  },
  spitter: {
    tactic: 'It stops out of reach and spits at the sandbags. Mara takes them first; so should you.',
    lore: 'The acid is concentrated fog. It eats concrete the way the fog eats the valley.',
  },

  lurker: {
    tactic: 'They come up between twenty and thirty metres out. Keep a gun on the near field, not just the fog.',
    lore: 'The tide carried spores into the mud. The dead have been lying in it, waiting, for weeks.',
  },

  bloom: {
    tactic: 'Burst the four pods first; while one lives the Bloom shrugs off four fifths of every hit. It regrows them once.',
    lore: "The Heart's last seed. If it had flowered, the spores would have reached the sea lanes.",
  },
  crimson_brute: {
    tactic: 'Bone covers the body. Shoot the head while it winds up, or load armour-piercing rounds.',
    lore: 'It was a soldier on the coast road. The veins are the red of what it fed on.',
  },
  pumpkin_brood: {
    tactic: 'It stops at range to spit. Shoot it while the belly is still, before the glob flies.',
    lore: 'The spores grew a head on it, and the head grew a mouth. It has not stopped growing.',
  },
  hollow_hound: {
    tactic: 'Fast and low. Lead it with the shotgun near the wire; a head shot drops it from a gallop.',
    lore: 'Something that used to be a dog. It runs for the sound of the wire.',
  },
  carrion_screamer: {
    tactic: 'Its shriek calls the dead to speed up. Take it out first, before it starts the call.',
    lore: 'It sings the way the fog does, a note that carries under the wind.',
  },
  wraith: {
    tactic: 'Its smoke hides it until it is close. Shoot early, while it still glides in the open.',
    lore: 'The fog took a shape and kept it. Wind goes through it, but it does not.',
  },
  stalker: {
    tactic: 'Fast and long-armed. Take it in the head before it reaches the wire; the lunge is the danger.',
    lore: 'It ran for the coast the night the spores came in, and never stopped running.',
  },
  gorger: {
    tactic: 'It stays out in the yard and slams the ground. Shoot the head while it winds up; the belly takes little.',
    lore: 'It was a man once. Then it ate the valley, and it still has not stopped.',
  },

  ravager: {
    tactic: 'The M82 or the M32, far out. If it bursts at the wire, the Stalkers are already on you.',
    lore: 'It is not one body. It is a nursery. The fog is carrying its young to the line.',
  },
  heart: {
    tactic: 'It never moves. Kill what it calls, then put everything into the head while it winds up to spit.',
    lore: 'Our first culture, grown in tank three. I named it. I am not going to write the name here.',
  },
  choir: {
    tactic: 'Its screams speed up the whole field. Use Focus when it starts to sing.',
    lore: 'Hundreds of voices in one throat. Some of them are calling names. I know one of them.',
  },
};

// ------------------------------------------------------------------ weapon mastery and skins

export type SkinId = 'desert' | 'winter' | 'fogline' | 'gold' | 'crimson' | 'obsidian';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** Main colour, and the second colour of the camo pattern (if any). */
  color: string;
  camo?: string;
  /** How strongly the paint covers the gun's own colour (0–1). */
  strength: number;
}

export const SKINS: Record<SkinId, SkinDef> = {
  desert: { id: 'desert', name: 'Desert', color: '#c8a46a', camo: '#8a6c40', strength: 0.75 },
  winter: { id: 'winter', name: 'Winter', color: '#d8e0e8', camo: '#8a96a4', strength: 0.75 },
  fogline: { id: 'fogline', name: 'Fogline', color: '#7a8a7a', camo: '#3c4640', strength: 0.8 },
  gold: { id: 'gold', name: 'Gold', color: '#f0c040', strength: 0.9 },
  crimson: { id: 'crimson', name: 'Crimson', color: '#b02a24', camo: '#5a1410', strength: 0.75 },
  obsidian: { id: 'obsidian', name: 'Obsidian', color: '#2a2630', camo: '#4a3a5a', strength: 0.85 },
};

/** Veteran medals that unlock the Obsidian skin for every weapon. */
export const OBSIDIAN_MEDALS = 9;

/** Kills with a weapon that unlock each mastery skin. */
export const MASTERY_TIERS: { kills: number; skin: SkinId }[] = [
  { kills: 100, skin: 'desert' },
  { kills: 300, skin: 'winter' },
  { kills: 800, skin: 'fogline' },
  { kills: 2000, skin: 'gold' },
];
