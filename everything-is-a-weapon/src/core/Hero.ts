/** Who you play as. Each of them brings a pet (entities/Pets.ts). */
export type HeroId = 'tenant' | 'flatmate' | 'gran' | 'kid';

export interface HeroInfo {
  readonly id: HeroId;
  readonly name: string;
  /** Pencilled under the name on the menu: the pet, and what it wants. */
  readonly note: string;
}

export const HEROES: readonly HeroInfo[] = [
  { id: 'tenant', name: 'the homeowner', note: '+ waffle, who wants a bone' },
  { id: 'flatmate', name: 'the teen', note: '+ biscuit, who wants tuna' },
  { id: 'gran', name: 'grandma', note: '+ captain, who wants a cracker' },
  { id: 'kid', name: 'the kid', note: '+ nugget, who wants seeds' },
];

export function isHeroId(value: unknown): value is HeroId {
  return HEROES.some((hero) => hero.id === value);
}

/** What each hero is good at. Small and honest: it changes how you play, not whether you can win. */
export interface HeroPerk {
  /** One line for the roster card. */
  readonly text: string;
  readonly extraHearts: number;
  readonly speed: number;
  readonly charge: number;
}

const NO_PERK: HeroPerk = { text: 'all-rounder', extraHearts: 0, speed: 1, charge: 1 };

export const HERO_PERKS: Readonly<Record<HeroId, HeroPerk>> = {
  tenant: NO_PERK,
  flatmate: { text: 'quick feet: +10% speed', extraHearts: 0, speed: 1.1, charge: 1 },
  gran: { text: 'tough as old boots: +1 heart', extraHearts: 1, speed: 1, charge: 1 },
  kid: { text: 'wind-up arm: throws charge 20% faster', extraHearts: 0, speed: 1, charge: 1.2 },
};

export function heroPerk(id: HeroId): HeroPerk {
  return HERO_PERKS[id] ?? NO_PERK;
}
