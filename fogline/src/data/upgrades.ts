// Consumables and upgrades sold in the shop: ammo mods (keys 5-8), support
// strikes (A/S/D), bunker defences (W/E) and permanent bunker upgrades.

export type ModId = 'double' | 'ap' | 'fire' | 'cryo';
export type SupportId = 'gunship' | 'orbital' | 'nuke';
export type DefenseId = 'repair' | 'wall';

export interface ModDef {
  id: ModId;
  key: '5' | '6' | '7' | '8';
  name: string;
  short: string;
  price: number;
  /** Seconds the mod stays active once triggered. */
  duration: number;
  maxCharges: number;
  color: number;
  icon: string;
  description: string;
}

export const MODS: ModDef[] = [
  {
    id: 'double', key: '5', name: 'Overpressure Rounds', short: '2× DMG', price: 350, duration: 20, maxCharges: 5,
    color: 0xe0a040, icon: 'icon_mod_double', description: 'Hot-loaded ammo. Doubles all firearm and grenade damage for 20 s.',
  },
  {
    id: 'ap', key: '6', name: 'Armour-Piercing', short: 'AP', price: 300, duration: 25, maxCharges: 5,
    color: 0x9fb4c8, icon: 'icon_mod_ap', description: 'Tungsten-core rounds ignore armour for 25 s. Bone plate and thick hide fold.',
  },
  {
    id: 'fire', key: '7', name: 'Incendiary', short: 'FIRE', price: 300, duration: 20, maxCharges: 5,
    color: 0xff6a2a, icon: 'icon_mod_fire', description: 'Hits set targets alight: 18 damage/s for 3 s, refreshed on every hit. 20 s.',
  },
  {
    id: 'cryo', key: '8', name: 'Cryo Rounds', short: 'CRYO', price: 250, duration: 20, maxCharges: 5,
    color: 0x7fd6ff, icon: 'icon_mod_cryo', description: 'Liquid-nitrogen tips slow targets by 55% for 4 s. 20 s.',
  },
];

export interface SupportDef {
  id: SupportId;
  key: 'A' | 'S' | 'D';
  name: string;
  price: number;
  cooldown: number;
  maxCharges: number;
  icon: string;
  description: string;
}

export const SUPPORT: SupportDef[] = [
  {
    id: 'gunship', key: 'A', name: 'Gunship Run', price: 800, cooldown: 30, maxCharges: 3, icon: 'icon_gunship',
    description: 'An attack helicopter sweeps the field for 14 s, chain-gunning anything that moves.',
  },
  {
    id: 'orbital', key: 'S', name: 'Orbital Lance', price: 650, cooldown: 18, maxCharges: 3, icon: 'icon_orbital',
    description: 'Kinetic strike on the ground under your sights. 8 m blast after a 0.8 s lock.',
  },
  {
    id: 'nuke', key: 'D', name: 'Tactical Nuke', price: 3200, cooldown: 60, maxCharges: 1, icon: 'icon_nuke',
    description: 'Low-yield warhead on the far field. Erases everything currently on the battlefield.',
  },
];

export interface DefenseDef {
  id: DefenseId;
  key: 'W' | 'E';
  name: string;
  price: number;
  cooldown: number;
  maxCharges: number;
  icon: string;
  description: string;
}

export const DEFENSES: DefenseDef[] = [
  {
    id: 'repair', key: 'W', name: 'Repair Crew', price: 400, cooldown: 4, maxCharges: 5, icon: 'icon_repair',
    description: 'Engineers patch the bunker: restores 300 health instantly.',
  },
  {
    id: 'wall', key: 'E', name: 'Blast Shutters', price: 500, cooldown: 20, maxCharges: 3, icon: 'icon_wall',
    description: 'Steel shutters slam up for 12 s. The bunker takes no damage while they hold.',
  },
];

export const REPAIR_AMOUNT = 300;
export const WALL_DURATION = 12;

export const MOD_EFFECTS = {
  doubleMultiplier: 2,
  burnDps: 18,
  burnDuration: 3,
  cryoSlow: 0.55,
  cryoDuration: 4,
} as const;

export const SUPPORT_EFFECTS = {
  gunshipDuration: 14,
  gunshipFireInterval: 0.09,
  gunshipDamage: 34,
  orbitalDelay: 0.8,
  orbitalRadius: 8,
  orbitalDamage: 650,
  nukeDelay: 2.2,
  nukeDamage: 9999,
} as const;

export interface BunkerUpgrade {
  id: string;
  name: string;
  levels: { price: number; maxHealth: number }[];
  icon: string;
  description: string;
}

export const BUNKER_UPGRADE: BunkerUpgrade = {
  id: 'reinforce',
  name: 'Reinforced Bunker',
  icon: 'icon_reinforce',
  levels: [
    { price: 700, maxHealth: 1250 },
    { price: 1100, maxHealth: 1500 },
    { price: 1600, maxHealth: 1800 },
  ],
  description: 'Concrete, rebar and more sandbags. Raises maximum bunker health (and adds the difference).',
};
