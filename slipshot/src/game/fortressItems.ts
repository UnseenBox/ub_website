/** Everything the player can buy, unlock and place in the fortress. */
export type FortressItemId = 'brick' | 'metal' | 'spikes' | 'jelly' | 'telescope' | 'cannon' | 'duck';

export interface FortressItemDef {
  id: FortressItemId;
  name: string;
  /** One short line for the shop card. */
  blurb: string;
  /** Size in metres, unrotated. Rotating swaps width and height. */
  w: number;
  h: number;
  hp: number;
  /** Coins per piece. */
  price: number;
  /** One-time coins to unlock the item. 0 means unlocked from the start. */
  unlock: number;
  /** Most of this item that can stand in the fortress at once. */
  maxPlaced: number;
  rotatable: boolean;
  /** Share of an enemy shot's damage the piece takes. */
  damageTaken: number;
  color: string;
}

/** A piece standing in the saved fortress: centre position in metres and a quarter turn. */
export interface PlacedPiece {
  item: FortressItemId;
  x: number;
  y: number;
  rot: 0 | 1;
}

export const FORTRESS_ITEMS: FortressItemDef[] = [
  {
    id: 'brick',
    name: 'Brick',
    blurb: 'Cheap, stackable cover.',
    w: 1.0,
    h: 0.5,
    hp: 60,
    price: 15,
    unlock: 0,
    maxPlaced: 40,
    rotatable: true,
    damageTaken: 1,
    color: '#e07a52',
  },
  {
    id: 'metal',
    name: 'Metal Sheet',
    blurb: 'A tall, tough wall.',
    w: 0.22,
    h: 1.6,
    hp: 160,
    price: 40,
    unlock: 120,
    maxPlaced: 16,
    rotatable: true,
    damageTaken: 0.6,
    color: '#a9b8c8',
  },
  {
    id: 'spikes',
    name: 'Spike Strip',
    blurb: 'Pops slime. Barely scratched.',
    w: 1.0,
    h: 0.35,
    hp: 80,
    price: 35,
    unlock: 150,
    maxPlaced: 10,
    rotatable: false,
    damageTaken: 0.35,
    color: '#c9d3df',
  },
  {
    id: 'jelly',
    name: 'Jelly Pad',
    blurb: 'Bounces enemy slime back.',
    w: 1.0,
    h: 0.45,
    hp: 70,
    price: 45,
    unlock: 180,
    maxPlaced: 8,
    rotatable: true,
    damageTaken: 0.3,
    color: '#ff7ad9',
  },
  {
    id: 'telescope',
    name: 'Telescope',
    blurb: 'Your aim line reaches twice as far.',
    w: 0.55,
    h: 1.0,
    hp: 40,
    price: 80,
    unlock: 200,
    maxPlaced: 1,
    rotatable: false,
    damageTaken: 1,
    color: '#7a6cff',
  },
  {
    id: 'duck',
    name: 'Rubber Duck',
    blurb: 'Enemies keep shooting at it instead.',
    w: 0.7,
    h: 0.7,
    hp: 50,
    price: 60,
    unlock: 250,
    maxPlaced: 2,
    rotatable: false,
    damageTaken: 1,
    color: '#ffd23f',
  },
  {
    id: 'cannon',
    name: 'Slime Cannon',
    blurb: 'Lobs slime at enemies on its own.',
    w: 0.9,
    h: 0.7,
    hp: 90,
    price: 140,
    unlock: 350,
    maxPlaced: 3,
    rotatable: false,
    damageTaken: 1,
    color: '#5a6b8a',
  },
];

export const FORTRESS_ITEM_IDS: FortressItemId[] = FORTRESS_ITEMS.map((d) => d.id);

export function fortressItem(id: FortressItemId): FortressItemDef {
  const d = FORTRESS_ITEMS.find((i) => i.id === id);
  if (!d) throw new Error(`Unknown fortress item ${id}`);
  return d;
}

export function isFortressItemId(v: unknown): v is FortressItemId {
  return typeof v === 'string' && FORTRESS_ITEMS.some((d) => d.id === v);
}

/** Width and height of an item after rotation. */
export function pieceSize(id: FortressItemId, rot: 0 | 1): { w: number; h: number } {
  const d = fortressItem(id);
  return rot === 1 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
