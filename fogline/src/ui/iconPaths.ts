// The icon set, as SVG path data. Pure data (no Phaser), so tests can check it.
//
// Icons are line art on a 24×24 grid (weapons on 48×24), stroked 2 units wide with
// round caps and joins. `ui/icons.ts` paints them into textures in any size and colour.

/** A circle as path data. */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;

export interface IconPath {
  d: string;
  /** Width of the grid; the height is always 24. */
  w: 24 | 48;
}

const sq = (...d: string[]): IconPath => ({ d: d.join(''), w: 24 });
const wide = (...d: string[]): IconPath => ({ d: d.join(''), w: 48 });

export const ICONS = {
  // objectives and goals
  shield: sq('M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z'),
  mast: sq('M12 21V8M8 21l4-13 4 13M6 6a8 8 0 0 1 12 0M8.5 8.5a4 4 0 0 1 7 0'),
  truck: sq('M2 6h11v9H2zM13 9h5l3 3v3h-8', circle(6, 17, 2), circle(17, 17, 2)),
  nest: sq('M4 18c0-5 3.5-9 8-9s8 4 8 9z', circle(12, 14, 2.5), 'M8 9L6 4M16 9l2-5M12 9V3'),
  skull: sq('M5 11a7 7 0 1 1 14 0v3l-2 2v3H7v-3l-2-2z', circle(9, 11, 1.6), circle(15, 11, 1.6), 'M10 19v-2M14 19v-2'),
  head: sq(circle(12, 12, 8), 'M12 2v4M12 18v4M2 12h4M18 12h4', circle(12, 12, 2)),
  // rewards and economy
  star: sq('M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z'),
  crate: sq('M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10'),
  cash: sq(circle(12, 12, 9), 'M15 9c-.5-1-1.6-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.7-.6-3.2-1.6M12 6v1.5M12 16.5V18'),
  medal: sq(circle(12, 15, 6), 'M9 10L6 3h4l2 5M15 10l3-7h-4l-2 5', circle(12, 15, 2)),
  // interface
  lock: sq('M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3'),
  book: sq('M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z'),
  cart: sq('M3 4h2l2.5 11h10L20 7H6.4', circle(9, 19, 1.5), circle(17, 19, 1.5)),
  play: sq('M7 4l13 8-13 8z'),
  back: sq('M15 5l-7 7 7 7'),
  check: sq('M4 12.5l5 5L20 6.5'),
  cross: sq('M6 6l12 12M18 6L6 18'),
  mouse: sq('M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 3v7M6 10h12'),
  touch: sq('M9 12V5a1.5 1.5 0 0 1 3 0v6l5 1c1.2.3 2 1.3 2 2.5L18 21h-7l-5-6c-1-1.4.6-3 2-2z'),
  plus: sq('M12 5v14M5 12h14'),
  clock: sq(circle(12, 12, 9), 'M12 7v5l3 2'),
  gauge: sq('M4 17a8 8 0 1 1 16 0M12 17l4-6'),
  wrench: sq('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z'),
  gear: sq(circle(12, 12, 3), circle(12, 12, 7), 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2'),
  map: sq('M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15'),
  home: sq('M3 11l9-8 9 8M6 9v12h12V9M10 21v-6h4v6'),
  pause: sq('M8 5v14M16 5v14'),
  replay: sq('M5 12a7 7 0 1 0 2-5M7 2v5h5'),
  radio: sq('M4 9h16v11H4zM7 9l10-6', circle(9, 14.5, 2.5), 'M15 13h2M15 16h2'),
  people: sq(circle(9, 8, 3.5), 'M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 5a3 3 0 0 1 0 6M17 14c2.5.5 4 2.7 4 6'),
  // enemy traits and effects
  acid: sq('M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z'),
  bolt: sq('M13 2L4 14h7l-1 8 9-12h-7z'),
  // special tools and keepsakes
  lamp: sq('M8 3h8l2 7H6zM12 10v3M7 15l-3 4M12 16v6M17 15l3 4'),
  wire: sq('M2 20h20M5 20v-5M19 20v-5M13 2l-5 9h4l-2 6 7-9h-4z'),
  flashbang: sq(circle(12, 14, 5), 'M10 9V6h4v3M12 2v1M4 6l2 2M20 6l-2 2M2 14h2M20 14h2'),
  charge: sq('M5 9h14v11H5zM9 9V6h6v3M9 14.5h6M12 3v3'),
  plate: sq('M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12h7M12 8.5v7'),
  satchel: sq('M4 9h16v11H4zM8 9V7a4 4 0 0 1 8 0v2M4 13h16M11 13v3h2v-3'),
  coin: sq(circle(12, 12, 9), circle(12, 12, 5), 'M12 9.5v5'),
  sight: sq(circle(12, 12, 6), 'M12 2v6M12 16v6M2 12h6M16 12h6'),
  wave: sq('M2 14c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4'),
  howl: sq('M4 9h3l5-4v14l-5-4H4zM15 9a4 4 0 0 1 0 6M18 6a9 9 0 0 1 0 12'),
  split: sq('M12 21v-7M12 14L5 7M12 14l7-7M5 12V7h5M19 12V7h-5'),
  blast: sq('M12 2l2.2 6.2L21 6l-4 5.4 5 3.600-6.4.600.800 6.400-4.400-4.800-4.400 4.800.800-6.400L2 15l5-3.600L3 6l6.800 2.200z'),
  burrow: sq('M3 14h18M12 3v14M7 12l5 5 5-5M5 19h3M11 20h2M16 19h3'),
  cloud: sq('M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1A4.5 4.5 0 0 1 17 18z'),
  fast: sq('M4 5l7 7-7 7M12 5l7 7-7 7'),
  flame: sq('M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2.200 1-4 2.200-5 .3 1.500 1.100 2.200 2 2.300C10 8 10 5.500 12 3z'),
  flare: sq('M12 2v4M5 5l3 3M19 5l-3 3', circle(12, 13, 4), 'M9 21h6'),
  eye: sq('M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z', circle(12, 12, 3)),
  // ammunition, support and defences
  bullet: sq('M9 21v-9c0-4 1.500-7 3-9 1.500 2 3 5 3 9v9zM9 17h6'),
  heli: sq('M3 5h18M12 5v4M6 13c0-2.200 2.700-4 6-4s6 1.800 6 4-2.700 4-6 4-6-1.800-6-4zM18 13h4V9M7 21h11M10 17v4M15 17v4'),
  orbital: sq('M12 2v7', circle(12, 15, 4), 'M3 15h3M18 15h3M12 21v1'),
  nuke: sq(circle(12, 12, 9.500), circle(12, 12, 1.800), 'M10.500 9.500L8 5.200a8 8 0 0 1 8 0l-2.500 4.300M14.800 12h5a8 8 0 0 1-4 6.900L13.400 14.600M10.600 14.600L8.200 18.900a8 8 0 0 1-4-6.900h5'),
  shutters: sq('M3 4h18M5 4v16h4V4M10 4v16h4V4M15 4v16h4V4'),
  // weapons, one silhouette each
  rifle: wide('M2 13h14l4-3h20v3h6v2H22l-4 3-3 5H11l2-5H2z'),
  carbine: wide('M3 11h8l2-2h14v-3h6v3h12v3H31l-3 2-1 6h-5l1-5h-8l-3 2H3z'),
  m249: wide('M2 9h9l2-2h16v3h17v3H29v2h-5v7h-8v-7h-3l-6 2H2zM39 13l-4 7M39 13l4 7'),
  launcher: wide('M3 10h9V8h8V6h11v3h14v6H31v3H20v-3h-4l-3 6H8l2-6H3zM23 8v8M27 8v8'),
  shotgun: wide('M2 15l12-6h32v3H30v3h-9v-2h-3l-6 6H6zM31 15h12'),
  sniper: wide('M2 11h9v-1h5V8h2V6h12v2h-2v2h5v2h13v3H33v1h-6l-1 5h-5l1-5h-6l-5 2H2zM38 15l-3 6M38 15l3 6'),
  flamer: wide('M4 6h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM15 10h18v4H15zM33 8h7v8h-7zM43 9c3 2 3 4 0 6M21 14l-2 7h4l2-7'),
  rocket: wide('M2 9h6l3 2h24V8l11 5-11 5v-3H11l-3 2H2zM19 15l-2 6h4l2-6M28 15l-1 5'),
  railgun: wide('M2 8h14v8l-9 1-5 4zM16 9h30M16 15h30M16 9v6M23 9v6M30 9v6M37 9v6M10 17l-1 5h4l2-6'),
  minigun: wide('M4 6h13v12H4zM17 8h29M17 12h29M17 16h29M42 7v10M8 18v4h6v-4'),
  tesla: wide('M2 11h8l3-2h19v7H16l-3 6H8l2-6H2zM32 9l5 3.500M32 16l5-3.500M37 12.500h3l-1-4 6 6h-3l1 4'),
} satisfies Record<string, IconPath>;

export type IconName = keyof typeof ICONS;

/** The silhouette for a weapon, by weapon id. */
export const WEAPON_ICON: Record<string, IconName> = {
  service: 'rifle', m4: 'carbine', m249: 'm249', m32: 'launcher', shotgun: 'shotgun', m82: 'sniper',
  flamer: 'flamer', rpg: 'rocket', railgun: 'railgun', doorgun: 'minigun', tesla: 'tesla',
};

/** The icon for a HUD or armory item that is not a weapon. */
export const ITEM_ICON: Record<string, IconName> = {
  uv: 'lamp', shock: 'wire', flash: 'flashbang', breach: 'charge', plating: 'plate', satchel: 'satchel', coin: 'coin', sight: 'sight',
  double: 'bullet', ap: 'bullet', fire: 'flame', cryo: 'bullet',
  gunship: 'heli', orbital: 'orbital', nuke: 'nuke', repair: 'wrench', wall: 'shutters', reinforce: 'shield',
};
