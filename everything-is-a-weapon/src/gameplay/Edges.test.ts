import { describe, expect, it } from 'vitest';
import { Rng } from '../core/Random';
import {
  EDGE_BY_ID,
  EDGE_IDS,
  EDGE_STACK_CAP,
  EDGES,
  edgeStacks,
  isEdgeId,
  offerEdges,
  shouldOfferEdge,
  startingEdge,
} from './Edges';

describe('Edges', () => {
  it('has 11 unique edges and covers every category/rarity pairing used above', () => {
    expect(EDGE_IDS).toHaveLength(11);
    expect(new Set(EDGE_IDS).size).toBe(11);

    const pairings = new Set(EDGE_IDS.map((id) => {
      const edge = EDGE_BY_ID[id];
      return `${edge.category}:${edge.rarity}`;
    }));
    expect(pairings).toEqual(new Set([
      'heavy:common', 'heavy:rare', 'heavy:legendary',
      'slick:common', 'slick:rare', 'slick:legendary',
      'greed:common', 'greed:rare', 'greed:legendary',
    ]));
  });

  it('caps stacks at three', () => {
    expect(EDGE_STACK_CAP).toBe(3);
  });

  it.each([
    [0, false, true], [1, true, true], [2, false, true], [3, false, false],
    [9, false, false], [11, true, true], [48, false, true], [49, true, false],
  ])('shouldOfferEdge(%i, boss=%s) is %s', (index, boss, expected) => {
    expect(shouldOfferEdge(index, boss)).toBe(expected);
  });

  it('excludes a maxed category and omits it from the offer', () => {
    const owned = ['heavy_hands', 'heavy_hands', 'heavy_hands',
      'chain_reaction', 'chain_reaction', 'chain_reaction',
      'headline_act', 'headline_act', 'headline_act'];
    const offer = offerEdges(new Rng(7), false, false, owned);
    expect(offer).toHaveLength(2);
    expect(offer.every((edge) => edge.category !== 'heavy')).toBe(true);
  });

  it('returns no offer when every Edge is maxed', () => {
    const owned = EDGES.flatMap((edge) => [edge.id, edge.id, edge.id]);
    expect(offerEdges(new Rng(7), false, false, owned)).toEqual([]);
  });

  it('gives a boss premium card a category that varies with the seed', () => {
    const categories = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const offer = offerEdges(new Rng(seed), true, false, []);
      const premium = offer.find((edge) => edge.rarity !== 'common');
      expect(premium).toBeDefined();
      categories.add(premium!.category);
    }
    expect(categories.size).toBeGreaterThan(1);
  });

  it('keeps a boss rare and a daily legendary in different categories', () => {
    const offer = offerEdges(new Rng(3), true, true, []);
    const rare = offer.filter((edge) => edge.rarity === 'rare');
    const legendary = offer.filter((edge) => edge.rarity === 'legendary');
    expect(rare.length).toBeGreaterThanOrEqual(1);
    expect(legendary.length).toBeGreaterThanOrEqual(1);
    expect(rare[0]!.category).not.toBe(legendary[0]!.category);
  });

  it('renames cat_frenzy to PET FRENZY without changing its id', () => {
    const edge = EDGES.find((e) => e.id === 'cat_frenzy')!;
    expect(edge.name).toBe('PET FRENZY');
    expect(edge.effect).toBe('Your pet hits 50% harder.');
  });

  it('startingEdge returns the requested rarity', () => {
    expect(startingEdge(new Rng(1), 'common').rarity).toBe('common');
    expect(startingEdge(new Rng(1), 'rare').rarity).toBe('rare');
    expect(startingEdge(new Rng(1), 'legendary').rarity).toBe('legendary');
  });

  it('edgeStacks counts duplicates', () => {
    expect(edgeStacks(['heavy_hands', 'heavy_hands', 'quick_feet'], 'heavy_hands')).toBe(2);
    expect(edgeStacks([], 'heavy_hands')).toBe(0);
    expect(isEdgeId('fine_print')).toBe(true);
    expect(isEdgeId('not_an_edge')).toBe(false);
  });
});
