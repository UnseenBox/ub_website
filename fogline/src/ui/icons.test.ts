import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { WEAPONS } from '../data/weapons';
import { ICONS, ITEM_ICON, WEAPON_ICON } from './iconPaths';
import { tagStyle, threatTags } from './messages';

describe('the icon set', () => {
  it('has well-formed path data for every icon', () => {
    for (const [name, def] of Object.entries(ICONS)) {
      expect(def.d.startsWith('M'), name).toBe(true);
      expect(def.d, name).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/);
    }
  });

  it('covers every weapon', () => {
    for (const w of WEAPONS) expect(WEAPON_ICON[w.id], w.id).toBeDefined();
  });

  it('covers every mod, support strike and defence', () => {
    for (const item of [...MODS, ...SUPPORT, ...DEFENSES]) expect(ITEM_ICON[item.id], item.id).toBeDefined();
  });

  it('gives every threat tag an icon that exists', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const tag of threatTags(e)) expect(ICONS[tagStyle(tag).icon], tag).toBeDefined();
    }
  });
});
