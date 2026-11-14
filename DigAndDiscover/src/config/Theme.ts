import type Phaser from 'phaser';

export const FONT_FAMILY = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';

/** Text is rendered at device resolution so it stays crisp on high-DPI screens. */
const TEXT_RESOLUTION = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

export const PALETTE = {
  ink: '#3b2616',
  inkHex: 0x3b2616,
  cream: 0xfff3dc,
  creamShade: 0xf1dcb8,
  tray: 0x2a1b12,
  gold: 0xffc83d,
  goldText: '#ffd34d',
  money: '#ffe07a',
  white: '#ffffff',
};

export const BUTTON_COLORS = {
  orange: { face: 0xff9f2e, lip: 0xc8661a, text: '#ffffff' },
  green: { face: 0x5fcf5c, lip: 0x2f9a3a, text: '#ffffff' },
  blue: { face: 0x4fb0ff, lip: 0x2a74c4, text: '#ffffff' },
  disabled: { face: 0x9b8f82, lip: 0x6f655b, text: '#efe8de' },
};

export type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export function textStyle(size: number, color = PALETTE.white, extra: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${Math.round(size)}px`,
    fontStyle: '700',
    color,
    resolution: TEXT_RESOLUTION,
    ...extra,
  };
}

/** Bold text with a dark outline, readable on top of busy artwork. */
export function outlinedStyle(size: number, color = PALETTE.white, extra: TextStyle = {}): TextStyle {
  return textStyle(size, color, {
    stroke: PALETTE.ink,
    strokeThickness: Math.max(3, Math.round(size * 0.18)),
    ...extra,
  });
}
