import { GAME_CONFIG } from '../config/GameConfig';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Screen layout shared by every scene, recomputed on resize. */
export interface Layout {
  w: number;
  h: number;
  compact: boolean;
  topH: number;
  /** Area left for the dig field / workshop stage. */
  play: Rect;
  tray: Rect;
  stamina: Rect;
  bag: { x: number; y: number };
  tool: Rect;
  depth: Rect;
  slotSize: number;
  slotGap: number;
  slotX0: number;
  slotY: number;
  button: Rect;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Narrow screens (phones in portrait) stack the action button under the bag
 * and use bigger touch targets relative to the screen; wide screens put the
 * button beside the bag to leave more room for the play area.
 */
export function computeLayout(w: number, h: number): Layout {
  const n = GAME_CONFIG.inventory.slots;
  const compact = w < 720;
  const topH = Math.round(clamp(h * 0.085, 54, 74));
  const bottomPad = 14;
  const staminaH = compact ? 22 : 24;
  const toolH = compact ? 24 : 28;

  if (compact) {
    const gap = 8;
    const slot = Math.floor(clamp((w - 28 - gap * (n - 1)) / n, 34, 92));
    const rowW = slot * n + gap * (n - 1);
    const x0 = Math.round((w - rowW) / 2);
    const btnH = Math.round(clamp(slot * 0.78, 50, 62));
    const btnY = h - bottomPad - btnH;
    const slotY = btnY - 10 - slot;
    const staminaY = slotY - 12 - staminaH;
    const trayY = staminaY - 12;
    const toolX = x0;
    const toolY = staminaY + staminaH / 2;
    const toolW = 96;
    const depthW = compact ? 14 : 20;
    return {
      w, h, compact, topH,
      play: { x: 0, y: topH, w, h: trayY - topH },
      tray: { x: 6, y: trayY, w: w - 12, h: h - trayY + 30 },
      stamina: { x: x0 + toolW + 22, y: staminaY, w: rowW - toolW - 100, h: staminaH },
      bag: { x: x0 + rowW, y: staminaY + staminaH / 2 },
      tool: { x: toolX, y: toolY, w: toolW, h: toolH },
      depth: { x: w - depthW, y: topH, w: depthW, h: trayY - topH },
      slotSize: slot, slotGap: gap, slotX0: x0, slotY,
      button: { x: x0, y: btnY, w: rowW, h: btnH },
    };
  }

  const gap = 10;
  const slot = Math.floor(clamp(h * 0.115, 60, 88));
  const rowW = slot * n + gap * (n - 1);
  const btnW = Math.round(clamp(slot * 2.8, 200, 250));
  const btnH = Math.round(clamp(slot * 0.82, 52, 66));
  const total = rowW + 18 + btnW;
  const x0 = Math.round((w - total) / 2);
  const slotY = h - bottomPad - slot;
  const staminaY = slotY - 12 - staminaH;
  const trayY = staminaY - 12;
  const toolX = x0;
  const toolY = staminaY + staminaH / 2;
  const toolW = 112;
  const depthW = compact ? 14 : 20;
  return {
    w, h, compact, topH,
    play: { x: 0, y: topH, w, h: trayY - topH },
    tray: { x: x0 - 16, y: trayY, w: total + 32, h: h - trayY + 30 },
    stamina: { x: x0 + toolW + 22, y: staminaY, w: rowW - toolW - 106, h: staminaH },
    bag: { x: x0 + rowW, y: staminaY + staminaH / 2 },
    tool: { x: toolX, y: toolY, w: toolW, h: toolH },
    depth: { x: w - depthW, y: topH, w: depthW, h: trayY - topH },
    slotSize: slot, slotGap: gap, slotX0: x0, slotY,
    button: { x: x0 + rowW + 18, y: slotY + (slot - btnH) / 2 - 2, w: btnW, h: btnH },
  };
}

export function slotCenter(L: Layout, index: number): { x: number; y: number } {
  return {
    x: L.slotX0 + index * (L.slotSize + L.slotGap) + L.slotSize / 2,
    y: L.slotY + L.slotSize / 2,
  };
}
