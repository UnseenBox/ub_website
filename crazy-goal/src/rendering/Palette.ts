/**
 * The houma at noon. Ochre paving and whitewash carry the scene; Algiers blue is the working
 * colour for anything the player acts on or reads; terracotta is the second accent; sun
 * yellow is kept for reward. Shadows are a cool blue, never black.
 */
export const C = {
  /** Behind everything, and the page itself. */
  bg: '#e6dccb',
  ground: '#e2b96a',
  groundAlt: '#d4a94f',
  paver: '#8a6a3c',
  chalk: '#fffaf0',
  white: '#fbf7ee',
  whiteShade: '#d5cedd',
  whiteDeep: '#b3adc9',
  blue: '#1f5fa8',
  blueDark: '#174a85',
  blueLite: '#6aa5dc',
  terra: '#cf5c36',
  terraDark: '#a04426',
  sun: '#ffc83a',
  sunDark: '#e0a41c',
  navy: '#1b2540',
  shadow: '#2c3470',
  wood: '#c58a4c',
  woodDark: '#99652f',
  orange: '#f08a24',
  green: '#5d8f4a',
  /** The menu's arcade greens — glossy button green down to its dark panel green. */
  greenHi: '#4ce16c',
  greenGame: '#1fc24c',
  greenDeep: '#0e7a30',
  greenNight: '#0b4d1f',
  red: '#cd3a24',
  rubber: '#3a3d4a',
  rubberLite: '#5b5f70',
  stone: '#bcae98',
  stoneDark: '#96886f',
  recess: '#6f5f52',
  sand: '#f0d99a',
  water: '#8fd0ee',
  cat: '#e58a2e',
  catDark: '#b9661a',
  brass: '#f3b532',
  /** Kept as aliases so shared drawing code reads naturally. */
  ink: '#1b2540',
  bone: '#fbf7ee',
} as const;

/** Opacity of a cast shadow. */
export const SHADOW_ALPHA = 0.27;

export const FONT = "'Lilita One', 'Baloo Bhaijaan 2', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif";

export const rgba = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};
