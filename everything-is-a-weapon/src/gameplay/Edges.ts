import type { Rng } from '../core/Random';
import { FINAL_ROOM_INDEX } from './Campaign';

export type EdgeCategory = 'heavy' | 'slick' | 'greed';
export type EdgeRarity = 'common' | 'rare' | 'legendary';
export type EdgeId =
  | 'heavy_hands' | 'chain_reaction' | 'headline_act'
  | 'quick_feet' | 'second_wind' | 'glass_cannon'
  | 'scrap_luck' | 'crowd_pleaser' | 'magnate'
  | 'cat_frenzy' | 'fine_print';

export interface EdgeDefinition {
  readonly id: EdgeId;
  readonly category: EdgeCategory;
  readonly rarity: EdgeRarity;
  readonly name: string;
  readonly effect: string;
  readonly flavor: string;
}

export const EDGES: readonly EdgeDefinition[] = [
  {
    id: 'heavy_hands', category: 'heavy', rarity: 'common',
    name: 'HEAVY HANDS',
    effect: '+25% impact and hazard damage.',
    flavor: '“Swing like the deposit is refundable.”',
  },
  {
    id: 'chain_reaction', category: 'heavy', rarity: 'rare',
    name: 'CHAIN REACTION',
    effect: '+35% damage from the second chain link onward.',
    flavor: '“One thing. Then another.”',
  },
  {
    id: 'headline_act', category: 'heavy', rarity: 'legendary',
    name: 'HEADLINE ACT',
    effect: 'Your next Headliner takes 30% more damage. Once per floor.',
    flavor: '“They came for the finale. Give them one.”',
  },
  {
    id: 'quick_feet', category: 'slick', rarity: 'common',
    name: 'QUICK FEET',
    effect: '+12% move speed and +20% dash speed.',
    flavor: '“The floor is lava. Keep moving.”',
  },
  {
    id: 'second_wind', category: 'slick', rarity: 'rare',
    name: 'SECOND WIND',
    effect: 'Start every floor with 1 bubble-wrap armour.',
    flavor: '“You get one free mistake.”',
  },
  {
    id: 'glass_cannon', category: 'slick', rarity: 'legendary',
    name: 'GLASS CANNON',
    effect: '+25% move speed, but the next hit you take deals double damage.',
    flavor: '“Nothing behind you matters.”',
  },
  {
    id: 'scrap_luck', category: 'greed', rarity: 'common',
    name: 'SCRAP LUCK',
    effect: '+20% scrap from everything.',
    flavor: '“Everything is worth something.”',
  },
  {
    id: 'crowd_pleaser', category: 'greed', rarity: 'rare',
    name: 'CROWD PLEASER',
    effect: 'Score multiplier grows with your run streak.',
    flavor: '“The crowd remembers a streak.”',
  },
  {
    id: 'magnate', category: 'greed', rarity: 'legendary',
    name: 'MAGNATE',
    effect: '+40% scrap, but -10% score.',
    flavor: '“You can’t spend applause.”',
  },
  {
    id: 'cat_frenzy', category: 'greed', rarity: 'rare',
    name: 'PET FRENZY',
    effect: 'Your pet hits 50% harder.',
    flavor: '“The cat has opinions.”',
  },
  {
    id: 'fine_print', category: 'greed', rarity: 'common',
    name: 'FINE PRINT',
    effect: 'Your next fatal hit leaves you at 1 HP. Once per run.',
    flavor: '“There is always a clause.”',
  },
];

export const EDGE_IDS: EdgeId[] = EDGES.map((edge) => edge.id);

export const EDGE_BY_ID: Record<EdgeId, EdgeDefinition> = Object.fromEntries(
  EDGES.map((edge) => [edge.id, edge]),
) as Record<EdgeId, EdgeDefinition>;

export function isEdgeId(value: string): value is EdgeId {
  return Object.prototype.hasOwnProperty.call(EDGE_BY_ID, value);
}

const CATEGORIES: readonly EdgeCategory[] = ['heavy', 'slick', 'greed'];

/** No Edge may be taken more than this many times in one run. */
export const EDGE_STACK_CAP = 3;

/** Room 1, every 0-based even index after it, every boss before the final. */
export function shouldOfferEdge(index: number, boss: boolean): boolean {
  if (index < 0 || index >= FINAL_ROOM_INDEX) return false;
  return index === 0 || boss || index % 2 === 0;
}

/**
 * One card from each category that still has an eligible card, so every choice
 * is a real trade. A boss premium upgrades a random eligible category, and a
 * forced daily legendary takes its own category first so the two never collide.
 */
export function offerEdges(
  rng: Rng,
  forceRare: boolean,
  forceLegendary: boolean,
  owned: readonly string[],
): EdgeDefinition[] {
  const pools = new Map<EdgeCategory, EdgeDefinition[]>();
  for (const category of CATEGORIES) {
    const pool = EDGES.filter(
      (edge) => edge.category === category && edgeStacks(owned, edge.id) < EDGE_STACK_CAP,
    );
    if (pool.length > 0) pools.set(category, pool);
  }

  const categories = [...pools.keys()];
  if (categories.length === 0) return [];

  const picks = new Map<EdgeCategory, EdgeDefinition>();
  const pickFrom = (pool: readonly EdgeDefinition[]): EdgeDefinition =>
    pool[rng.int(0, pool.length - 1)] as EdgeDefinition;
  const randomCategory = (eligible: readonly EdgeCategory[]): EdgeCategory =>
    eligible[rng.int(0, eligible.length - 1)] as EdgeCategory;

  let legendaryCategory: EdgeCategory | undefined;
  if (forceLegendary) {
    const eligible = categories.filter((category) =>
      pools.get(category)!.some((edge) => edge.rarity === 'legendary'),
    );
    if (eligible.length > 0) {
      const category = randomCategory(eligible);
      legendaryCategory = category;
      picks.set(
        category,
        pickFrom(pools.get(category)!.filter((edge) => edge.rarity === 'legendary')),
      );
    }
  }

  if (forceRare) {
    const eligible = categories.filter((category) => category !== legendaryCategory);
    if (eligible.length > 0) {
      const category = randomCategory(eligible);
      const pool = pools.get(category)!;
      const premium = pool.filter((edge) => edge.rarity !== 'common');
      const rares = premium.filter((edge) => edge.rarity === 'rare');
      picks.set(category, pickFrom(rares.length > 0 ? rares : premium.length > 0 ? premium : pool));
    }
  }

  for (const category of categories) {
    if (picks.has(category)) continue;
    picks.set(category, pickFrom(pools.get(category)!));
  }

  return categories.map((category) => picks.get(category)!);
}

export function startingEdge(rng: Rng, rarity: EdgeRarity): EdgeDefinition {
  let pool = EDGES.filter((edge) => edge.rarity === rarity);
  if (pool.length === 0) pool = EDGES.filter((edge) => edge.rarity === 'common');
  return pool[rng.int(0, pool.length - 1)] as EdgeDefinition;
}

export function edgeStacks(boosts: readonly string[], id: EdgeId): number {
  let count = 0;
  for (const boost of boosts) {
    if (boost === id) count++;
  }
  return count;
}
