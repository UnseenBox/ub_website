/**
 * Curios: the weird, funny and spooky things that turn up while digging - skeletons,
 * war relics, oddities and literal idioms. They are NOT rocks: they never take a bag
 * slot, they pay cash straight away, and every one is a collectible.
 *
 * Art: each curio is an emoji sticker for now. Drop a PNG named after the curio id
 * into `src/assets/curios/` (e.g. `trex-skull.png`) to replace it - no code change.
 */

export type CurioCategory = 'bones' | 'war' | 'weird' | 'idiom' | 'treasure';

export interface CurioCategoryDef {
  label: string;
  color: number;
  css: string;
  /** What the player shouts when it pops out. */
  shout: string;
}

export const CURIO_CATEGORIES: Record<CurioCategory, CurioCategoryDef> = {
  bones: { label: 'BONES', color: 0xe8dcc0, css: '#a8946a', shout: 'BONES!' },
  war: { label: 'WAR RELIC', color: 0xaab6c4, css: '#5f7288', shout: 'WHOA!' },
  weird: { label: 'WEIRD', color: 0xb98cff, css: '#8a54e0', shout: 'WHAT?!' },
  idiom: { label: 'IDIOM', color: 0xffb627, css: '#d98a00', shout: 'AHA!' },
  treasure: { label: 'TREASURE', color: 0x5fcf6e, css: '#2f9e45', shout: 'SHINY!' },
};

export interface CurioDef {
  id: string;
  name: string;
  /** One or two emoji. Two are drawn side by side. */
  icon: string;
  category: CurioCategory;
  /** 0 common ... 4 mythic. Drives value, odds and how big the celebration is. */
  tier: number;
  /** First layer (0 based) it can appear in. */
  minLayer: number;
  /** The joke / idiom line on the reveal card. */
  line: string;
}

/** Cash range by tier. A first-time find pays double. */
export const CURIO_VALUE: ReadonlyArray<readonly [number, number]> = [
  [12, 28],
  [35, 80],
  [120, 260],
  [400, 800],
  [1500, 3000],
];

/** XP by tier. */
export const CURIO_XP = [10, 25, 60, 140, 400] as const;

export const CURIO_TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'] as const;

const c = (
  id: string, name: string, icon: string, category: CurioCategory, tier: number, minLayer: number, line: string,
): CurioDef => ({ id, name, icon, category, tier, minLayer, line });

export const CURIOS: readonly CurioDef[] = [
  // ---- bones ----
  c('old-bone', 'Old Bone', '🦴', 'bones', 0, 0, 'Somebody\'s dinner. A very long time ago.'),
  c('fossil-shell', 'Fossil Shell', '🐚', 'bones', 0, 1, 'The sea was right here once.'),
  c('broken-leg', 'Break a Leg!', '🦵🦴', 'idiom', 1, 1, 'Break a leg! ...Please don\'t, though.'),
  c('skeleton', 'Whole Skeleton', '💀', 'bones', 2, 2, 'Hello, friend. Don\'t be scared!'),
  c('closet-skeleton', 'Skeleton in the Closet', '🚪💀', 'idiom', 3, 3, 'Everyone has one. You just dug yours up.'),
  c('ammonite', 'Ammonite', '🐌', 'bones', 1, 4, 'A snail from 400 million years ago!'),
  c('dino-egg', 'Dinosaur Egg', '🥚', 'bones', 2, 3, 'Still warm? ...No. Still weird though.'),
  c('rhino-horn', 'Woolly Rhino Horn', '🦏', 'bones', 2, 4, 'It was NOT a unicorn. Probably.'),
  c('trex-skull', 'T-Rex Skull', '🦖', 'bones', 3, 5, 'RAWR! A museum would pay big for this.'),
  c('dragon-skull', 'Dragon Skull?!', '🐉', 'bones', 4, 8, 'Is that a DRAGON? Don\'t tell anyone.'),
  // ---- war relics ----
  c('soldier-helmet', 'Soldier\'s Helmet', '⛑️', 'war', 1, 2, 'Still has a dent. Somebody had a bad day.'),
  c('cannonball', 'Cannonball', '💣', 'war', 1, 2, 'BOOM! (Luckily, a very old one.)'),
  c('rusty-dagger', 'Rusty Dagger', '🗡️', 'war', 1, 2, 'Sharp enough to cut a sandwich. Maybe.'),
  c('war-horn', 'War Horn', '📯', 'war', 1, 3, 'You blow it. Everyone looks at you.'),
  c('ancient-bow', 'Ancient Bow', '🏹', 'war', 1, 3, 'Robin Hood\'s cousin lost this.'),
  c('crossed-swords', 'Crossed Swords', '⚔️', 'war', 2, 3, 'Somebody lost a very serious duel here.'),
  c('pirate-anchor', 'Pirate Anchor', '⚓', 'war', 2, 3, 'Why is a ship anchor in a HOLE?!'),
  c('bury-hatchet', 'Bury the Hatchet', '🪓', 'idiom', 2, 3, 'You found the buried hatchet. Peace at last!'),
  c('knight-shield', 'Knight\'s Shield', '🛡️', 'war', 2, 4, 'Blocks swords. Does not block embarrassment.'),
  c('war-medal', 'War Medal', '🎖️', 'war', 2, 4, 'For bravery. Or for losing it, down here.'),
  c('lost-crown', 'Lost Crown', '👑', 'war', 3, 6, 'Long live the king... of the hole!'),
  // ---- weird ----
  c('rubber-duck', 'Rubber Duck', '🦆', 'weird', 0, 1, 'Quack. How did it get HERE?!'),
  c('old-phone', 'Ancient Telephone', '☎️', 'weird', 1, 1, 'Hello? Is it me you\'re digging for?'),
  c('old-tv', 'Old TV', '📺', 'weird', 0, 2, 'Nothing on but static. And one very odd channel.'),
  c('retro-arcade', 'Retro Arcade Stick', '🕹️', 'weird', 1, 2, 'INSERT COIN to continue digging.'),
  c('creepy-clown', 'Creepy Clown', '🤡', 'weird', 1, 2, 'Nobody asked for this. Put it back!'),
  c('friendly-ghost', 'A Friendly Ghost', '👻', 'weird', 2, 4, 'BOO! ...sorry, you didn\'t even flinch.'),
  c('rusty-robot', 'Rusty Robot', '🤖', 'weird', 2, 5, 'BEEP. YOU ARE DIGGING TOO DEEP.'),
  c('golden-toilet', 'Golden Toilet', '🚽', 'weird', 3, 5, 'The ultimate throne. Priceless. Also, a toilet.'),
  c('moai', 'Moai Head', '🗿', 'weird', 3, 6, 'Sorry to dig you up, big guy.'),
  c('ufo-parts', 'UFO Parts', '🛸', 'weird', 3, 6, 'It\'s... not from around here.'),
  c('lost-rocket', 'Lost Rocket', '🚀', 'weird', 3, 7, 'Houston, we have a hole.'),
  c('tiny-alien', 'Tiny Alien', '👽', 'weird', 4, 7, 'We are not alone. Down here, anyway.'),
  // ---- treasure ----
  c('ancient-vase', 'Ancient Vase', '🏺', 'treasure', 1, 1, 'Don\'t drop it. Seriously. Don\'t.'),
  c('treasure-map', 'Treasure Map', '📜', 'treasure', 1, 1, 'X marks the spot... and you\'re standing on it.'),
  c('diamond-ring', 'Diamond Ring', '💍', 'treasure', 2, 3, 'Somebody said yes. Somebody else lost it.'),
  c('jackpot', 'Hit the Jackpot!', '🎰', 'idiom', 3, 5, 'Three sevens! You hit the jackpot!'),
  // ---- idioms ----
  c('piece-of-cake', 'Piece of Cake', '🍰', 'idiom', 0, 1, 'Who buries a cake?! ...Easy as pie.'),
  c('bite-the-dust', 'Bites the Dust', '🦷', 'idiom', 0, 1, 'Another one bites the dust!'),
  c('time-flies', 'Time Flies', '⏳', 'idiom', 1, 1, 'Time flies when you\'re digging!'),
  c('cash-bag', 'Cold, Hard Cash', '💰', 'idiom', 1, 1, 'Cold, hard cash. Hmm, it IS cold down here.'),
  c('sleeping-dog', 'Let Sleeping Dogs Lie', '🐕💤', 'idiom', 1, 2, 'Shhh. Put the dirt back. Quietly.'),
  c('cat-bag', 'Cat\'s Out of the Bag', '🐈🛍️', 'idiom', 1, 2, 'Well. The cat\'s out of the bag now.'),
  c('can-of-worms', 'Can of Worms', '🥫🐛', 'idiom', 1, 2, 'You\'ve opened a can of worms. Literally.'),
  c('needle-haystack', 'Needle in a Haystack', '🧷', 'idiom', 1, 2, 'Found it! ...Wait, that was easy.'),
  c('message-bottle', 'Message in a Bottle', '📜🍾', 'idiom', 1, 2, 'It says: "Please send snacks."'),
  c('black-sheep', 'The Black Sheep', '🐑🖤', 'idiom', 1, 2, 'Every family has one. Even down here.'),
  c('light-tunnel', 'Light at the Tunnel\'s End', '🔦', 'idiom', 1, 3, 'There IS light at the end of the tunnel!'),
  c('elephant-room', 'Elephant in the Room', '🐘', 'idiom', 2, 3, 'Nobody mentioned the elephant in the hole.'),
  c('pot-of-gold', 'Pot of Gold', '🌈💰', 'idiom', 3, 4, 'The end of the rainbow! Finally!'),
  c('bull-china', 'Bull in a China Shop', '🐂🏺', 'idiom', 2, 4, 'Oh no. Oh no no no.'),
  c('own-grave', 'Dig Your Own Grave', '⚰️', 'idiom', 2, 4, 'Careful what you wish for, digger...'),
  c('golden-egg', 'The Golden Egg', '🥚✨', 'idiom', 4, 6, 'The goose that laid the golden egg!'),
  c('rock-bottom', 'Rock Bottom', '🧱', 'idiom', 3, 9, 'You hit rock bottom. Literally.'),
];

export const CURIO_BY_ID: Record<string, CurioDef> = Object.fromEntries(CURIOS.map((x) => [x.id, x]));
