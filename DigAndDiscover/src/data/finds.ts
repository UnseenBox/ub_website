/**
 * Finds: the odd things that turn up in the ground besides rocks.
 *
 * Three distinct kinds, three distinct economics:
 *
 * - ARTIFACT: real historical or collector value. Picked up and stored, no money
 *   on the spot. The player sells them later for cash. Rare.
 * - COLLECTION: charming oddities kept for the collection record. No money value.
 * - JUNK: plain rubbish. No sale value, only counted by type for now.
 *
 * Art: every def names a painter key that `src/art/FindArt.ts` knows how to draw.
 * No emoji, no bitmaps - everything is painted with Canvas 2D primitives.
 */

export type FindCategory = 'artifact' | 'collection' | 'junk';

export type ConditionId = 'poor' | 'fair' | 'good' | 'fine' | 'mint';

export interface FindDef {
  /** Unique, kebab-case. */
  id: string;
  /** Display name. */
  name: string;
  category: FindCategory;
  /** 0 common ... 4 legendary (rarity inside its category). */
  tier: number;
  /** First layer index (0 based) it can appear in. */
  minLayer: number;
  /** Optional last layer it can appear in. */
  maxLayer?: number;
  /** Relative weight inside its category and tier pool. */
  weight: number;
  /** Painter key, see FindArt. */
  art: string;
  /** 2-4 colours (0xRRGGBB), index 0 is the signature colour. */
  palette: number[];
  /** One line: significance (artifact) or flavour (collection/junk). */
  history: string;
  /** ONLY for artifacts: sale range in dollars before condition. */
  value?: readonly [number, number];
}

/** Condition of a found artifact. Only artifacts carry a condition. */
export interface ConditionDef {
  /** Display label. */
  label: string;
  /** Multiplier applied to the base sale value. */
  valueMult: number;
  /** Relative chance of being rolled. */
  weight: number;
}

export interface CategoryStyle {
  label: string;
  color: number;
  css: string;
}

const artifact = (
  id: string,
  name: string,
  tier: number,
  minLayer: number,
  maxLayer: number,
  value: readonly [number, number],
  art: string,
  palette: number[],
  history: string,
  weight = 10,
): FindDef => ({ id, name, category: 'artifact', tier, minLayer, maxLayer, weight, art, palette, history, value });

const collection = (
  id: string,
  name: string,
  tier: number,
  minLayer: number,
  maxLayer: number,
  art: string,
  palette: number[],
  history: string,
  weight = 10,
): FindDef => ({ id, name, category: 'collection', tier, minLayer, maxLayer, weight, art, palette, history });

const junk = (
  id: string,
  name: string,
  tier: number,
  minLayer: number,
  maxLayer: number,
  art: string,
  palette: number[],
  history: string,
  weight = 10,
): FindDef => ({ id, name, category: 'junk', tier, minLayer, maxLayer, weight, art, palette, history });

/**
 * The catalogue.
 *
 * Layer bands: tier 0 sits at the surface, tier 1 appears from layer 0-2,
 * tier 2 from layer 2-4, tier 3 from layer 4-6 and tier 4 (legendary) from
 * layer 6 down to the bottom. Deeper tiers stay reachable a little longer so
 * the deepest layers do not collapse into a single legendary item.
 */
export const FINDS: readonly FindDef[] = [
  // ---------------- artifacts: tier 0 ----------------
  artifact('copper-roman-coin', 'Roman Copper Coin', 0, 0, 0, [4, 12], 'coin', [0xb87333, 0x8a4f22, 0xd6a06a],
    'Small change for a Roman legionary, worn smooth by centuries.', 14),
  artifact('copper-worn-coin', 'Worn Copper Coin', 0, 0, 0, [6, 15], 'coin', [0xa9682f, 0x7a4520, 0xc79a68],
    'A copper coin with almost no face left, but still legal tender.', 12),
  artifact('brass-uniform-button', 'Brass Uniform Button', 0, 0, 0, [5, 13], 'button', [0xd9a441, 0x9c6b22, 0xf2d38a],
    "A tidy soldier's button with a faded anchor stamped on it.", 10),
  artifact('glass-trade-beads', 'Glass Trade Beads', 0, 0, 0, [7, 15], 'beads', [0x3f8fbf, 0x255a80, 0x9fd6ef],
    'Blue glass beads traded along river routes for centuries.', 9),

  // ---------------- artifacts: tier 1 ----------------
  artifact('medieval-silver-penny', 'Medieval Silver Penny', 1, 0, 2, [22, 55], 'coin', [0xc9cbd0, 0x8e939c, 0xf0f2f5],
    'A hammered silver penny from a small medieval mint.', 11),
  artifact('steel-helmet', 'Steel Brodie Helmet', 1, 1, 2, [30, 60], 'helmet', [0x6f7a84, 0x454e57, 0x9aa6ae],
    'A shallow steel helmet from the trenches of a modern war.', 8),
  artifact('brass-shell-case', 'Brass Shell Case', 1, 0, 2, [20, 45], 'shell', [0xc9a24a, 0x8f6b26, 0xecd28c],
    'An empty brass case, still sharp enough to cut paper.', 12),
  artifact('hand-plane', 'Wooden Hand Plane', 1, 1, 2, [26, 58], 'plane', [0x9a6a3c, 0x5e3c1e, 0xc79a68],
    'A smooth wooden plane for smoothing timber by hand.', 8),
  artifact('brass-calipers', 'Brass Calipers', 1, 1, 2, [24, 52], 'calipers', [0xcaa04a, 0x8a6524, 0xe8cd8e],
    'Shopsmith calipers for measuring thickness to a hair.', 8),
  artifact('blacksmith-tongs', 'Blacksmith Tongs', 1, 2, 2, [28, 60], 'tongs', [0x5f646b, 0x35393f, 0x8d939a],
    'Long forge tongs, blackened by a hundred fires.', 7),
  artifact('hand-drill', 'Hand Drill', 1, 1, 2, [20, 44], 'drill', [0xa8794a, 0x66421f, 0xd0a874],
    'A breast drill for boring holes before electricity.', 7),
  artifact('musket-powder-flask', 'Gunpowder Flask', 1, 1, 2, [30, 58], 'flask', [0x8e9a63, 0x5a6339, 0xbcc492],
    'A copper flask that once held black powder.', 7),
  artifact('roman-bronze-bracelet', 'Roman Bronze Bracelet', 1, 2, 2, [22, 52], 'bracelet', [0xb08a4a, 0x74562a, 0xd9b878],
    'A coiled bronze bracelet from a Roman household.', 7),

  // ---------------- artifacts: tier 2 ----------------
  artifact('silver-roman-denarius', 'Roman Silver Denarius', 2, 2, 4, [95, 210], 'coin', [0xd2d5da, 0x969ba4, 0xf6f8fb],
    'A silver denarius stamped with a wolf and the twins.', 8),
  artifact('cannonball-1800s', '1800s Cannonball', 2, 3, 4, [120, 230], 'cannonball', [0x4a4f57, 0x282c31, 0x6e747c],
    'A cast iron ball from the age of black powder and smoke.', 7),
  artifact('pocket-watch', 'Silver Pocket Watch', 2, 2, 4, [110, 225], 'watch', [0xc4c8ce, 0x82878f, 0xecf0f4],
    'A silver pocket watch, its hands still politely waiting.', 8),
  artifact('clockwork-gears', 'Clockwork Gear Set', 2, 3, 4, [90, 200], 'gears', [0xbb9448, 0x7e6128, 0xe2c078],
    'Brass gears from a clock that no longer keeps time.', 9),
  artifact('brass-telescope', 'Brass Telescope', 2, 4, 4, [150, 230], 'telescope', [0xc39a4d, 0x846428, 0xe8cf95],
    'A collapsible brass telescope for skies and ships.', 6),
  artifact('box-camera', 'Box Camera', 2, 3, 4, [100, 210], 'camera', [0x6b5442, 0x3d2d22, 0x9c8168],
    'A bellows camera that needed a long minute of patience.', 7),
  artifact('typewriter-keys', 'Typewriter Key Set', 2, 4, 4, [95, 200], 'keys', [0xdedad0, 0x9d998f, 0x3a3733],
    'A neat row of typewriter keys with worn round tops.', 7),
  artifact('signet-ring', 'Gold Signet Ring', 2, 3, 4, [120, 230], 'ring', [0xe3b64a, 0x9c731f, 0xfae08d],
    'A signet ring for sealing letters with a crest.', 7),
  artifact('viking-silver-brooch', 'Viking Silver Brooch', 2, 3, 4, [110, 225], 'brooch', [0xc9cdd4, 0x8b9099, 0xecf1f6],
    'A bird brooch from a longboat burial, still fierce.', 7),

  // ---------------- artifacts: tier 3 ----------------
  artifact('gold-roman-solidus', 'Roman Gold Solidus', 3, 4, 9, [380, 760], 'coin', [0xeec158, 0xaf8420, 0xfff0a8],
    'A solidus of pure gold, minted when emperors still marched.', 5),
  artifact('medieval-gold-noble', 'Medieval Gold Noble', 3, 5, 9, [420, 800], 'coin', [0xf0c95e, 0xb28a24, 0xfff4b0],
    'A gold noble with a ship on the reverse, a very good day.', 5),
  artifact('gold-locket', 'Victorian Gold Locket', 3, 4, 9, [360, 700], 'locket', [0xe6bd52, 0x9d7722, 0xfbe6a0],
    'A gold locket with an empty space for a portrait.', 5),
  artifact('gilded-helmet', 'Gilded Cavalry Helmet', 3, 5, 9, [400, 780], 'helmet', [0xd9ac3f, 0x8f6a1c, 0xf5dc94],
    'A cavalry helmet gilt in gold for a proud officer.', 5),

  // ---------------- artifacts: tier 4 (legendary) ----------------
  artifact('golden-idol', 'Ancient Golden Idol', 4, 6, 9, [1500, 3500], 'idol', [0xf6cd55, 0xb07f13, 0xfff3b8],
    'A solid gold idol. People have killed for less.', 2),
  artifact('royal-crown', 'Cracked Royal Crown', 4, 7, 9, [1800, 3300], 'crown', [0xf0c44e, 0x9c6f14, 0xffe9a2],
    'A crown with a crack and a very messy history.', 2),
  artifact('golden-tablet', 'Golden Cuneiform Tablet', 4, 6, 9, [1600, 3200], 'tablet', [0xe7bd48, 0x9d7315, 0xfbe197],
    'A tablet of golden letters in a language nobody here reads.', 2),

  // ---------------- collection: tier 0 ----------------
  collection('toy-soldier', 'Lead Toy Soldier', 0, 0, 2, 'soldier', [0x9c3f36, 0x5e241f, 0xd2746a],
    'A tiny soldier with a painted moustache.', 12),
  collection('spinning-top', 'Wooden Spinning Top', 0, 0, 2, 'top', [0xc4713a, 0x7e4119, 0xe7a26a],
    'A striped wooden top that never quite stayed upright.', 12),
  collection('windup-mouse', 'Windup Mouse', 0, 0, 2, 'mouse', [0x9a8a7c, 0x5f5349, 0xc6b7a8],
    'A tin mouse that still winds up, sort of.', 11),
  collection('rubber-duck', 'Rubber Duck', 0, 0, 2, 'duck', [0xf2c33c, 0xb4851a, 0xffe894],
    'A rubber duck. Some things never change.', 12),
  collection('enamel-mug', 'Chipped Enamel Mug', 0, 0, 2, 'mug', [0xe8eaea, 0xa9adb0, 0x3d6ea8],
    'A chipped enamel mug from a factory canteen.', 12),
  collection('pottery-shard', 'Decorated Pottery Shard', 0, 0, 2, 'shard', [0xc4764a, 0x7e4426, 0xe8a878],
    'A painted shard with a spiral and a running line.', 11),
  collection('glass-marble', 'Glass Marble', 0, 0, 2, 'marble', [0x5aa8d8, 0x2f6c94, 0xb4e2f6],
    'A swirl marble, worn smooth by a pocket.', 12),
  collection('mystery-key', 'Mystery Key', 0, 0, 2, 'key', [0xb58b46, 0x6f5123, 0xdcb878],
    'A long key that fits a lock nobody has any more.', 11),
  collection('bone-whistle', 'Bone Whistle', 0, 1, 3, 'whistle', [0xe6dcc0, 0xa89c7c, 0xfaf2da],
    'A slim bone whistle that makes one thin note.', 9),

  // ---------------- collection: tier 1 ----------------
  collection('tin-windup-robot', 'Tin Windup Robot', 1, 0, 3, 'robot', [0x6fa8c8, 0x3c6480, 0xa8d4e8],
    'A tin robot whose key is missing but whose spirit is not.', 8),
  collection('porcelain-doll-head', 'Porcelain Doll Head', 1, 1, 3, 'dollhead', [0xf0dcc8, 0xc0a68e, 0x8f4a54],
    'A doll head with painted cheeks and no story attached.', 8),
  collection('cracked-teapot', 'Cracked Teapot', 1, 0, 3, 'teapot', [0x7fae94, 0x4b7561, 0xb6d9c4],
    'A teapot with a crack that somebody mended with tape.', 9),
  collection('brass-oil-lamp', 'Brass Oil Lamp', 1, 1, 3, 'lamp', [0xc9a24a, 0x856522, 0xe8cd8e],
    'A brass lamp that burned oil and smelled of smoke.', 8),
  collection('music-box', 'Music Box', 1, 1, 3, 'musicbox', [0xb5763f, 0x6f4420, 0xdda76e],
    'A music box that plays one waltz and one waltz only.', 8),
  collection('snow-globe', 'Snow Globe', 1, 2, 3, 'snowglobe', [0x9fd0ea, 0x4d84a8, 0xe8f6fd],
    'A snow globe with a tiny cabin inside.', 8),
  collection('ornate-mirror', 'Ornate Hand Mirror', 1, 1, 3, 'mirror', [0xd3b06a, 0x8a6d2f, 0xf2dda6],
    'A small mirror with a gilded frame full of swirls.', 8),
  collection('ammonite-fossil', 'Ammonite Fossil', 1, 1, 3, 'ammonite', [0xd0ac74, 0x8e6f42, 0xf0d9ac],
    'A chambered spiral from an ancient sea.', 9),
  collection('trilobite-fossil', 'Trilobite Fossil', 1, 2, 3, 'trilobite', [0x9a7b58, 0x5f4830, 0xc4a480],
    'A trilobite crawling through 300 million years.', 8),
  collection('stone-arrowhead', 'Stone Arrowhead', 1, 1, 3, 'arrowhead', [0x8f8a7a, 0x55513f, 0xb8b3a2],
    'A knapped flint point, sharp as the day it was made.', 9),
  collection('tin-lighter', 'Engraved Tin Lighter', 1, 1, 3, 'lighter', [0xc8cbd0, 0x7f848c, 0xecf0f4],
    "A silver-plated lighter with somebody's initials.", 8),

  // ---------------- collection: tier 2 ----------------
  collection('jack-in-the-box', 'Jack in the Box', 2, 3, 6, 'jackbox', [0xc9503f, 0x7d2a1f, 0xe9927f],
    'A painted box with a clown waiting to spring out.', 6),
  collection('rotary-telephone', 'Rotary Telephone', 2, 2, 6, 'phone', [0x2f3238, 0x171a1d, 0x646a72],
    'A black rotary telephone with a dial you had to respect.', 6),
  collection('bakelite-radio', 'Bakelite Radio', 2, 3, 6, 'radio', [0xa2642f, 0x5f3a18, 0xd0924f],
    'A brown Bakelite radio that crackled warmly.', 6),
  collection('carved-wooden-mask', 'Carved Wooden Mask', 2, 2, 6, 'mask', [0x9a6b45, 0x5d3d24, 0xc79668],
    'A carved mask with a solemn, slightly worried face.', 6),

  // ---------------- collection: tier 3 ----------------
  collection('royal-silver-thimble', 'Royal Silver Thimble', 3, 4, 9, 'thimble', [0xcdd2d8, 0x8d939b, 0xf0f4f8],
    'A thimble from a palace tailor, still dented from use.', 5),
  collection('crystal-decanter', 'Crystal Cut Decanter', 3, 5, 9, 'decanter', [0xa8d8e8, 0x4f8fa8, 0xe6f8ff],
    'A cut glass decanter that bends the light around it.', 5),

  // ---------------- junk ----------------
  junk('broken-glass', 'Broken Glass', 0, 0, 4, 'glass', [0xbcd8d8, 0x7ea4a6, 0xeaf7f7],
    'A sharp green shard of nothing much.', 14),
  junk('rusty-tin-can', 'Rusty Tin Can', 0, 0, 4, 'can', [0x9a8f7a, 0x5f5749, 0xc4b9a4],
    'A tin can eaten through with rust.', 13),
  junk('bent-nails', 'Bent Nails', 0, 0, 4, 'nails', [0x8a8175, 0x50493f, 0xb0a89a],
    'A fistful of nails bent into useless shapes.', 13),
  junk('bent-spoon', 'Bent Spoon', 0, 0, 4, 'spoon', [0xa8aeb4, 0x6a7076, 0xd2d8de],
    'A spoon bent into a shape nobody intended.', 12),
  junk('cracked-plastic-toy', 'Cracked Plastic Toy', 0, 1, 4, 'plastictoy', [0xd76a7a, 0x8f3d4a, 0xf0a0aa],
    'A plastic toy with a crack straight through it.', 12),
  junk('tangled-wire', 'Tangled Wire', 0, 0, 4, 'wire', [0x8c8f93, 0x54575a, 0xb6b9bd],
    'A knot of wire with no obvious purpose.', 12),
  junk('worn-shoe-sole', 'Worn Shoe Sole', 0, 1, 4, 'sole', [0x6b5847, 0x3b2f25, 0x937c66],
    'A shoe sole worn down to almost nothing.', 11),
  junk('bottle-cap', 'Bottle Cap', 0, 0, 4, 'bottlecap', [0xb03a3a, 0x6b1f1f, 0xd9756f],
    'A crimped bottle cap with no bottle to match.', 13),
  junk('wrapper-scraps', 'Wrapper Scraps', 0, 0, 4, 'wrapper', [0xd8c98f, 0x9a8c58, 0xf2e6bb],
    'Crumpled wrapper scraps with faded print.', 12),
  junk('broken-pipe', 'Broken Pipe', 1, 1, 5, 'pipe', [0x8a6a45, 0x4f3b26, 0xb59268],
    'A broken clay pipe from a long-ago break.', 9),
  junk('plastic-comb', 'Broken Plastic Comb', 0, 1, 4, 'comb', [0x4a7fc0, 0x2a4f80, 0x8fb2e0],
    'A plastic comb with half its teeth gone.', 12),
  junk('rusty-spring', 'Rusty Spring', 0, 1, 4, 'spring', [0x93897c, 0x574f45, 0xbdb2a2],
    'A coil of spring pulled out of shape.', 11),
  junk('chipped-tile', 'Chipped Tile Fragment', 0, 1, 4, 'tile', [0xdcd3c2, 0x9c9382, 0xf2ece0],
    'A tile fragment from an older floor.', 11),
  junk('old-battery', 'Leaking Battery', 1, 2, 5, 'battery', [0x4f5a63, 0x2a3138, 0x8b959d],
    'A battery that has leaked all over itself.', 9),
  junk('torn-leather', 'Torn Leather Scrap', 0, 1, 4, 'leather', [0x8a613a, 0x4f371e, 0xb98c5c],
    'A scrap of leather with the stitching still on.', 11),
  junk('unidentifiable-scrap', 'Unidentifiable Scrap Metal', 1, 2, 5, 'scrap', [0x7f8288, 0x4a4d52, 0xa8abb0],
    'A bent piece of metal that was something once.', 10),
];

/** Fast lookup by id. */
export const FIND_BY_ID: Record<string, FindDef> = Object.fromEntries(FINDS.map((f) => [f.id, f]));

/** Condition of an artifact. Weights make good condition common and mint rare. */
export const CONDITIONS: Record<ConditionId, ConditionDef> = {
  poor: { label: 'Poor', valueMult: 0.35, weight: 30 },
  fair: { label: 'Fair', valueMult: 0.7, weight: 35 },
  good: { label: 'Good', valueMult: 1.0, weight: 22 },
  fine: { label: 'Fine', valueMult: 1.6, weight: 10 },
  mint: { label: 'Mint', valueMult: 2.6, weight: 3 },
};

/** Category colours so the player reads the kind of find at a glance. */
export const CATEGORY_STYLE: Record<FindCategory, CategoryStyle> = {
  artifact: { label: 'ARTIFACT', color: 0xffc63f, css: '#ffc63f' },
  collection: { label: 'COLLECTION', color: 0x35d6c0, css: '#35d6c0' },
  junk: { label: 'JUNK', color: 0x9a8f7a, css: '#9a8f7a' },
};

/** Tier names, used by the UI. */
export const FIND_TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

/**
 * Every tunable number of the finds system lives here.
 */
export const FIND_CONFIG = {
  /** Per-swing chance that a swing turns up a find of each category. */
  chancePerSwing: {
    /** Historic valuables: rare, and the only kind that ever pays money. */
    artifact: 0.004,
    /** Charming oddities for the collection record. */
    collection: 0.007,
    /** Plain rubbish: common, worthless, but fun to look at. */
    junk: 0.012,
  },

  /**
   * Per-layer multipliers for the per-swing chances, index = layer index
   * (0 = Surface Soil ... 9 = Heart of the Earth). Artifacts get richer with
   * depth, collection items are flat, rubbish thins out as you go down.
   */
  layerMult: {
    artifact: [1.0, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8, 1.9, 2.0, 2.0],
    collection: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    junk: [1.0, 0.95, 0.85, 0.7, 0.55, 0.42, 0.3, 0.22, 0.15, 0.1],
  },

  /** Swings that must pass between two finds. The roll is skipped while it runs. */
  minSwingsBetweenFinds: 6,

  /** How much likelier a collection item the player has never found is. */
  newFindBonus: 2,

  /**
   * Tier odds per pair of layers (layers 0-1, 2-3, 4-5, 6-7, 8-9).
   * Shallow ground is mostly common finds, deeper ground opens up the good stuff.
   */
  tierOdds: [
    [62, 32, 6, 0, 0],
    [38, 40, 18, 4, 0],
    [24, 36, 26, 12, 2],
    [16, 30, 30, 18, 6],
    [10, 26, 32, 22, 10],
  ] as readonly (readonly [number, number, number, number, number])[],

  /** XP awarded when a find is discovered, by category and tier. */
  xpByTier: {
    artifact: [5, 12, 30, 70, 200],
    collection: [4, 10, 25, 60, 150],
    junk: [1],
  },
};
