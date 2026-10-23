import { describe, expect, it } from 'vitest';
import { HEROES } from '../core/Hero';
import { HERO_LOOKS } from './heroLooks';

const heroIds = HEROES.map((hero) => hero.id);

describe('HERO_LOOKS', () => {
  it('covers every playable hero', () => {
    expect(Object.keys(HERO_LOOKS).sort()).toEqual([...heroIds].sort());
  });

  it('gives every hero a distinct outfit, hair, and foot silhouette', () => {
    expect(new Set(heroIds.map((id) => HERO_LOOKS[id].outfit)).size).toBe(heroIds.length);
    expect(new Set(heroIds.map((id) => HERO_LOOKS[id].hairStyle)).size).toBe(heroIds.length);
    expect(new Set(heroIds.map((id) => HERO_LOOKS[id].feet)).size).toBe(heroIds.length);
  });

  it('locks the tenant to the approved full-coverage look', () => {
    const look = HERO_LOOKS.tenant;
    expect(look.outfit).toBe('openRobePajamas');
    expect(look.hairStyle).toBe('bun');
    expect(look.feet).toBe('bunny');
    expect(look.maskStyle).toBe('forehead');
    expect(look.coverage).toBe('full');
  });

  it('keeps every hero fully covered', () => {
    for (const id of heroIds) {
      expect(HERO_LOOKS[id].coverage).toBe('full');
      expect(HERO_LOOKS[id].scale).toBeGreaterThan(0);
    }
  });
});
