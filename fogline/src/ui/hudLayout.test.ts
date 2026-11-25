import { describe, expect, it } from 'vitest';
import { HUD_AREA, layoutSlots } from './hudLayout';

describe('the battle HUD layout', () => {
  it('shows only what the mission offers, in large slots when there is little', () => {
    const l = layoutSlots({ weapons: 1, mods: 0, support: 0, defense: 1 });
    expect(l.weapons).toHaveLength(1);
    expect(l.mods).toHaveLength(0);
    expect(l.defense).toHaveLength(1);
    expect(l.weapons[0].w).toBe(78);
    expect(l.defense[0].x).toBeGreaterThan(l.weapons[0].x + l.weapons[0].w);
  });

  it('fits every slot beside the health bar when everything is offered', () => {
    const l = layoutSlots({ weapons: 4, mods: 4, support: 3, defense: 2 });
    const all = [...l.weapons, ...l.mods, ...l.support, ...l.defense];
    expect(all).toHaveLength(13);
    for (let i = 1; i < all.length; i++) expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].w);
    const last = all[all.length - 1];
    expect(last.x + last.w).toBeLessThanOrEqual(HUD_AREA.slotsRight);
    expect(all[0].w).toBeGreaterThanOrEqual(54);
  });
});
