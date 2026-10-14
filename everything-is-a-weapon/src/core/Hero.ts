/** Who you play as. Each of them brings a pet (entities/Pets.ts). */
export type HeroId = 'tenant' | 'flatmate' | 'gran' | 'kid';

export interface HeroInfo {
  readonly id: HeroId;
  readonly name: string;
  /** Pencilled under the name on the menu: the pet, and what it wants. */
  readonly note: string;
}

export const HEROES: readonly HeroInfo[] = [
  { id: 'tenant', name: 'the tenant', note: '+ waffle, who wants a bone' },
  { id: 'flatmate', name: 'the flatmate', note: '+ biscuit, who wants tuna' },
  { id: 'gran', name: 'gran', note: '+ captain, who wants a cracker' },
  { id: 'kid', name: 'the kid', note: '+ nugget, who wants seeds' },
];

export function isHeroId(value: unknown): value is HeroId {
  return HEROES.some((hero) => hero.id === value);
}
