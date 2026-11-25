import { describe, expect, it } from 'vitest';
import { SKINS, STARTER_SKIN, skinOf } from './Skins';

describe('the balls', () => {
  it('are all pictures, and the starter one is free', () => {
    expect(SKINS.length).toBe(8);
    expect(SKINS.every((s) => s.texture !== undefined)).toBe(true);
    expect(skinOf(STARTER_SKIN).need).toBe(0);
  });

  it('a ball that no longer exists, such as an old drawn one, falls back to the starter', () => {
    expect(skinOf('classic').id).toBe(STARTER_SKIN);
    expect(skinOf('orange').id).toBe(STARTER_SKIN);
  });

  it('unlock in order of stars, starting from the free ball', () => {
    const needs = SKINS.map((s) => s.need);
    expect(needs).toEqual([...needs].sort((a, b) => a - b));
  });
});
