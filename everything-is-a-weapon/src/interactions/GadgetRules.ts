import type { InteractionRule } from './InteractionRule';

/**
 * Two things live here: the extra tricks the original objects picked up (a shoe dazes,
 * a ball comes off the wall harder, a bin fits over a head), and the rules for the gadgets
 * in GadgetObjects.ts. As everywhere else, results feed other rules: a bucket's puddle
 * conducts, a magnet's loose pan is a projectile, a robot hoover carries whatever is on it.
 *
 * Order matters in one place only: rules that use an object up (`wear`) come before rules
 * that merely change it, so one hit never does both.
 */
export const GADGET_RULES: readonly InteractionRule[] = [
  // ───────────── new tricks for old objects ─────────────
  {
    id: 'ball_ricochet', trigger: 'impact', source: ['ball'], target: ['wall'], minImpulse: 150, cooldown: 0.12,
    noChain: true, effects: [{ type: 'ricochet', factor: 1.18 }],
  },
  {
    id: 'trick_shot', trigger: 'impact', source: ['ricochet'], target: ['enemy'], minImpulse: 200, cooldown: 0.4,
    moving: true, effects: [{ type: 'impactDamage', scale: 0.03 }], discovery: 'trick_shot',
  },
  {
    id: 'shoe_slap', trigger: 'impact', source: ['shoe'], target: ['enemy'], minImpulse: 300, cooldown: 1,
    moving: true, effects: [{ type: 'confuse', duration: 1.2 }], discovery: 'slapped',
  },
  {
    id: 'pan_stars', trigger: 'impact', source: ['pan'], target: ['enemy'], minImpulse: 500, cooldown: 0.6,
    moving: true, effects: [{ type: 'stagger', seconds: 1.6 }],
  },
  {
    id: 'pillow_burst', trigger: 'impact', source: ['pillow'], target: ['enemy'], minImpulse: 260, moving: true,
    effects: [{ type: 'detonate', to: 'source' }],
  },
  {
    id: 'pillow_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['pillow'],
    effects: [{ type: 'spawnZone', zone: 'feathers', radius: 74, ttl: 6 }],
  },
  {
    id: 'feathers_blind', trigger: 'overlap', source: ['feathers'], target: ['enemy'],
    effects: [{ type: 'confuse', duration: 0.7 }, { type: 'slow', factor: 0.7, duration: 0.5 }], discovery: 'snow_day',
  },
  {
    id: 'feathers_fire', trigger: 'overlap', source: ['fire'], target: ['feathers'],
    effects: [{ type: 'blaze', seconds: 2.4 }],
  },
  {
    id: 'teddy_hug', trigger: 'impact', source: ['teddy'], target: ['enemy'], minImpulse: 150, moving: true,
    effects: [{ type: 'wear', duration: 2.8, word: 'HUG!' }], discovery: 'free_hugs',
  },
  {
    id: 'duck_decoy', trigger: 'event', event: 'OBJECT_LANDED', source: ['duck', 'thrown'],
    effects: [{ type: 'lure', radius: 280, seconds: 1.7, sound: 'squeak' }], discovery: 'decoy',
  },
  {
    id: 'toast_butter', trigger: 'event', event: 'OBJECT_LANDED', source: ['toast', 'thrown'],
    effects: [{ type: 'spawnZone', zone: 'oil', radius: 18, ttl: 16 }], discovery: 'butter_side_down',
  },
  {
    id: 'spanner_helmet', trigger: 'impact', source: ['tool'], target: ['enemy', 'helmet'], minImpulse: 300, moving: true,
    effects: [{ type: 'unhelmet' }], discovery: 'unscrewed',
  },
  {
    id: 'paint_face', trigger: 'impact', source: ['paintcan'], target: ['enemy'], minImpulse: 600, moving: true,
    effects: [{ type: 'confuse', duration: 2.6 }, { type: 'detonate', to: 'source' }], discovery: 'modern_art',
  },
  {
    id: 'candle_relight', trigger: 'overlap', source: ['fire'], target: ['candle', '!lit'], noChain: true,
    effects: [{ type: 'tag', to: 'target', tag: 'lit' }],
  },
  {
    id: 'roller_strike', trigger: 'impact', source: ['roller'], target: ['enemy'], minImpulse: 900, moving: true,
    effects: [{ type: 'trip' }], discovery: 'strike',
  },
  {
    id: 'broom_sweep', trigger: 'impact', source: ['sweeper'], target: ['enemy'], minImpulse: 300, moving: true,
    effects: [{ type: 'trip' }], discovery: 'swept',
  },
  {
    id: 'iron_burn', trigger: 'impact', source: ['hot', '!broken'], target: ['enemy'], minImpulse: 250, moving: true,
    effects: [{ type: 'burn', duration: 1.8 }], discovery: 'ironed',
  },

  // ───────────── bins and buckets ─────────────
  {
    id: 'bin_on_head', trigger: 'impact', source: ['wearable', '!full'], target: ['enemy'], minImpulse: 300, moving: true,
    effects: [{ type: 'wear', duration: 3.2, minSpeed: 470, word: 'BINNED!' }], discovery: 'binned',
  },
  {
    id: 'bucket_douse', trigger: 'impact', source: ['bucket', 'full'], target: ['enemy'], minImpulse: 250, moving: true,
    effects: [{ type: 'spill', radius: 66 }, { type: 'untag', to: 'source', tag: 'full' }], discovery: 'bucket_brigade',
  },
  {
    id: 'bucket_land', trigger: 'event', event: 'OBJECT_LANDED', source: ['bucket', 'full', 'thrown'],
    effects: [{ type: 'spill', radius: 66 }, { type: 'untag', to: 'source', tag: 'full' }], discovery: 'bucket_brigade',
  },
  {
    id: 'bucket_refill_bath', trigger: 'impact', source: ['bucket', '!full'], target: ['bathtub'], cooldown: 1,
    noChain: true, effects: [{ type: 'tag', to: 'source', tag: 'full', word: 'REFILL!' }], discovery: 'refill',
  },
  {
    id: 'bucket_refill_toilet', trigger: 'impact', source: ['bucket', '!full'], target: ['toilet', '!broken'], cooldown: 1,
    noChain: true, effects: [{ type: 'tag', to: 'source', tag: 'full', word: 'REFILL!' }], discovery: 'refill',
  },

  // ───────────── robot hoover ─────────────
  {
    id: 'hoover_trip', trigger: 'impact', source: ['enemy'], target: ['hoover', '!held'], minImpulse: 40, cooldown: 2.5,
    effects: [{ type: 'trip', to: 'source' }], discovery: 'trip_hazard',
  },
  {
    id: 'hoover_wet', trigger: 'overlap', source: ['water'], target: ['hoover', '!broken'],
    effects: [{ type: 'detonate', to: 'target' }], discovery: 'no_wet_floors',
  },
  {
    id: 'hoover_glass', trigger: 'overlap', source: ['glass'], target: ['hoover', '!broken'], noChain: true,
    effects: [{ type: 'remove', to: 'source' }], discovery: 'tidy',
  },
  {
    id: 'hoover_dirt', trigger: 'overlap', source: ['dirt'], target: ['hoover', '!broken'], noChain: true,
    effects: [{ type: 'remove', to: 'source' }], discovery: 'tidy',
  },

  // ───────────── magnet and battery ─────────────
  {
    id: 'magnet_pull', trigger: 'overlap', source: ['magnet'], target: ['object', 'metal', '!held'],
    effects: [{ type: 'pull', accel: 2500, maxMass: 14 }], discovery: 'attraction',
  },
  {
    id: 'magnet_helmet', trigger: 'overlap', source: ['magnet'], target: ['enemy', 'helmet'],
    effects: [{ type: 'unhelmet' }], discovery: 'animal_magnetism',
  },
  {
    id: 'battery_water', trigger: 'overlap', source: ['electric', 'battery'], target: ['water'],
    effects: [{ type: 'energize' }], discovery: 'portable_socket',
  },

  // ───────────── traps ─────────────
  {
    id: 'mousetrap_snap', trigger: 'overlap', source: ['trap', 'mousetrap'], target: ['enemy'],
    effects: [{ type: 'snap', damage: 16, stun: 0.5, hold: 3.4, word: 'SNAP!' }], discovery: 'snap',
  },
  {
    id: 'rake_smack', trigger: 'overlap', source: ['trap', 'rake'], target: ['enemy'],
    effects: [{ type: 'snap', damage: 24, stun: 1.3, word: 'THWACK!' }], discovery: 'oldest_joke',
  },

  // ───────────── fuses ─────────────
  {
    id: 'firework_fire', trigger: 'overlap', source: ['fire'], target: ['firework', '!fused'],
    effects: [{ type: 'fuse', to: 'target', seconds: 1.9, rocket: 1.25 }], discovery: 'touchpaper',
  },
  {
    id: 'firework_spark', trigger: 'overlap', source: ['electric', '!outlet', '!carried'], target: ['firework', '!fused'],
    effects: [{ type: 'fuse', to: 'target', seconds: 1.9, rocket: 1.25 }], discovery: 'touchpaper',
  },
  {
    id: 'firework_hit', trigger: 'impact', source: ['firework', 'rocketing'], target: ['enemy'],
    effects: [{ type: 'detonate', to: 'source' }],
  },
  {
    id: 'firework_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['firework'],
    effects: [{ type: 'explode', radius: 125, force: 0.8, damage: 62, style: 'sparkle' }],
  },
  {
    id: 'cooker_hit', trigger: 'impact', source: ['solid', '!player'], target: ['cooker', '!fused', '!held'], minImpulse: 500,
    effects: [{ type: 'fuse', to: 'target', seconds: 2.5, whistle: true }], discovery: 'under_pressure',
  },
  {
    id: 'cooker_fire', trigger: 'overlap', source: ['fire'], target: ['cooker', '!fused'],
    effects: [{ type: 'fuse', to: 'target', seconds: 2.5, whistle: true }], discovery: 'under_pressure',
  },
  {
    id: 'cooker_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['cooker'],
    effects: [
      { type: 'explode', radius: 135, force: 1.1, damage: 55, style: 'steam' },
      { type: 'spawnZone', zone: 'steam', radius: 90, ttl: 5 },
    ],
  },
  {
    id: 'steam_blind', trigger: 'overlap', source: ['steam'], target: ['enemy'], noChain: true,
    effects: [{ type: 'confuse', duration: 0.7 }, { type: 'slow', factor: 0.6, duration: 0.5 }], discovery: 'sauna',
  },

  // ───────────── boombox ─────────────
  {
    id: 'boombox_thrown', trigger: 'event', event: 'OBJECT_THROWN', source: ['boombox', '!broken'],
    effects: [{ type: 'tag', to: 'source', tag: 'playing', seconds: 8 }],
  },
  {
    id: 'boombox_hit', trigger: 'impact', source: ['solid', '!player'], target: ['boombox', '!broken', '!playing', '!held'], minImpulse: 400,
    effects: [{ type: 'tag', to: 'target', tag: 'playing', seconds: 8 }],
  },
  {
    id: 'music_dance', trigger: 'overlap', source: ['music'], target: ['enemy'], noChain: true,
    effects: [{ type: 'confuse', duration: 0.6 }, { type: 'slow', factor: 0.3, duration: 0.5 }], discovery: 'dance_floor',
  },

  // ───────────── full of water ─────────────
  {
    id: 'fishtank_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['fishtank'],
    effects: [
      { type: 'spill', radius: 96 },
      { type: 'spawnZone', zone: 'glass', radius: 30, ttl: 24 },
      { type: 'spawnObject', object: 'fish', count: 3 },
    ],
    discovery: 'fish_out_of_water',
  },
  {
    id: 'cooler_fallen', trigger: 'event', event: 'OBJECT_FALLEN', source: ['watercooler'],
    effects: [{ type: 'spill', radius: 100 }], discovery: 'watercooler',
  },
  {
    id: 'cooler_slam', trigger: 'event', event: 'OBJECT_FALLEN', source: ['watercooler'],
    effects: [{ type: 'slam' }],
  },
];
