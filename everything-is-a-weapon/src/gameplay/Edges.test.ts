import { describe, expect, it } from 'vitest';
import { Rng } from '../core/Random';
import {
  EDGE_BY_ID,
  EDGE_IDS,
  edgeStacks,
  isEdgeId,
  offerEdges,
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

  it('offers exactly one heavy, one slick, one greed, with no duplicates', () => {
    for (let seed = 0; seed < 50; seed++) {
      const offer = offerEdges(new Rng(seed), false);
      expect(offer).toHaveLength(3);
      expect(offer.map((edge) => edge.category).sort()).toEqual(['greed', 'heavy', 'slick']);
      expect(new Set(offer.map((edge) => edge.id)).size).toBe(3);
    }
  });

  it('forceRare puts at least one rare or legendary in the offer', () => {
    for (let seed = 0; seed < 50; seed++) {
      const offer = offerEdges(new Rng(seed), true);
      expect(offer.some((edge) => edge.rarity !== 'common')).toBe(true);
      expect(new Set(offer.map((edge) => edge.category)).size).toBe(3);
    }
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
