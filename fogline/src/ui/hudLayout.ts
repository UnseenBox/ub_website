// Where the battle HUD's slots sit. Only the items a mission offers get a slot, so the bar
// starts nearly empty and fills as the campaign unlocks things. Pure, so it is unit-tested.

import { VIEW } from '../game/config';

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudCounts {
  weapons: number;
  mods: number;
  support: number;
  defense: number;
}

export type HudSlots = Record<keyof HudCounts, SlotRect[]>;

export const HUD_AREA = {
  top: VIEW.hudTop,
  height: VIEW.height - VIEW.hudTop,
  /** Left edge of the first slot and the furthest right a slot may reach. */
  slotsLeft: 19,
  slotsRight: 850,
  slotH: 84,
  maxSlotW: 78,
  gap: 6,
  /** Extra space between two groups. */
  groupGap: 12,
  /** The health shield, meter and cash. */
  status: { x: 866, w: 395 },
} as const;

export function layoutSlots(counts: HudCounts): HudSlots {
  const A = HUD_AREA;
  const order = ['weapons', 'mods', 'support', 'defense'] as const;
  const total = order.reduce((s, k) => s + counts[k], 0);
  const groups = order.filter((k) => counts[k] > 0).length;
  const spacing = A.gap * Math.max(0, total - 1) + A.groupGap * Math.max(0, groups - 1);
  const w = Math.min(A.maxSlotW, Math.floor((A.slotsRight - A.slotsLeft - spacing) / Math.max(1, total)));
  const y = A.top + Math.round((A.height - A.slotH) / 2);
  const out: HudSlots = { weapons: [], mods: [], support: [], defense: [] };
  let x: number = A.slotsLeft;
  for (const k of order) {
    if (!counts[k]) continue;
    for (let i = 0; i < counts[k]; i++) {
      out[k].push({ x, y, w, h: A.slotH });
      x += w + A.gap;
    }
    x += A.groupGap;
  }
  return out;
}
