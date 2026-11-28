// Special tools and keepsakes, won only from side quests. Tools are used in battle (a few
// charges a mission, one more for each wave cleared); keepsakes work on their own, for good.
// Each tool answers one kind of monster.

export type ToolId = 'uv' | 'shock' | 'flash' | 'breach';
export type RelicId = 'plating' | 'satchel' | 'coin' | 'sight';

export interface ToolDef {
  id: ToolId;
  key: 'Z' | 'X' | 'C' | 'V';
  name: string;
  /** One word for buttons and cards. */
  short: string;
  color: number;
  description: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'uv', key: 'Z', name: 'Violet Lamp', short: 'LAMP', color: 0xa888ff, description: 'Ten seconds of violet light: hidden things show, and spells and darkness break.' },
  { id: 'shock', key: 'X', name: 'Shock Wire', short: 'SHOCK', color: 0x80d8ff, description: 'Charges the wire: everything within 18 metres is burned and stunned.' },
  { id: 'flash', key: 'C', name: 'Flashbang', short: 'FLASH', color: 0xfff0c0, description: 'Stuns the whole field for three seconds, cutting off every roar, scream, spell and rush.' },
  { id: 'breach', key: 'V', name: 'Breaching Charge', short: 'BREACH', color: 0xffa040, description: 'Blows the armour off the biggest threat, hurting it badly and opening its soft spot.' },
];

export interface RelicDef {
  id: RelicId;
  name: string;
  short: string;
  description: string;
}

export const RELICS: RelicDef[] = [
  { id: 'sight', name: "Marksman's Sight", short: '+HEAD', description: 'Headshots do a fifth more damage.' },
  { id: 'satchel', name: 'Ammo Satchel', short: '+AMMO', description: 'Every mission starts with one extra charge of each special ammunition you own.' },
  { id: 'coin', name: 'Lucky Coin', short: '+CASH', description: 'Kills pay a fifth more.' },
  { id: 'plating', name: 'Old Plating', short: '+WALL', description: 'The bunker takes 300 more damage before it falls.' },
];

export const RELIC_EFFECTS = { headshot: 1.2, cash: 1.2, bunker: 300, charges: 1 } as const;

export const TOOL_EFFECTS = {
  /** Charges at the start of a mission, the most held, and seconds between uses. */
  start: 1,
  max: 2,
  cooldown: 5,
  lamp: 10,
  shockReach: 18,
  shockDamage: 160,
  shockStun: 3,
  flashStun: 3,
  breachDamage: 900,
  breachBossDamage: 600,
  breachOpen: 4,
} as const;

export const toolById = (id: string): ToolDef | undefined => TOOLS.find((t) => t.id === id);
export const relicById = (id: string): RelicDef | undefined => RELICS.find((r) => r.id === id);
