import type { InteractionRule } from './InteractionRule';

/**
 * The whole "what happens when X meets Y" table. Nothing in here is a scripted sequence:
 * long chain reactions emerge because the result of one rule (a zone, a broken object,
 * a tag) is the precondition of another.
 *
 * To add an interaction, append a rule. No engine code needs to change unless the rule
 * needs a brand-new effect type.
 */
export const INTERACTION_RULES: readonly InteractionRule[] = [
  // ───────────── impacts ─────────────
  {
    id: 'impact_enemy', trigger: 'impact', source: ['object'], target: ['enemy'], minImpulse: 140, cooldown: 0.15,
    effects: [{ type: 'impactDamage', scale: 0.0145 }], discovery: 'blunt_force',
  },
  {
    id: 'impact_player', trigger: 'impact', source: ['object', '!held'], target: ['player'], minImpulse: 2600,
    effects: [{ type: 'impactDamage', scale: 0 }],
  },
  {
    id: 'structural', trigger: 'impact', source: ['solid'], target: ['breakable'], minImpulse: 450,
    effects: [{ type: 'structuralDamage', scale: 0.004 }],
  },
  {
    id: 'tip_over', trigger: 'impact', source: ['solid'], target: ['tippable', 'standing'],
    effects: [{ type: 'tip' }],
  },
  {
    id: 'billiards', trigger: 'impact', source: ['object', 'heavy'], target: ['object', 'light', '!held'], minImpulse: 420,
    effects: [{ type: 'boost', factor: 1.5 }], discovery: 'billiards',
  },
  {
    id: 'wall_slam', trigger: 'impact', source: ['enemy'], target: ['wall'],
    effects: [{ type: 'slamDamage', to: 'source', minSpeed: 175, scale: 0.11 }], discovery: 'wall_slam',
  },
  {
    id: 'bowling', trigger: 'impact', source: ['enemy'], target: ['enemy'],
    effects: [{ type: 'slamDamage', to: 'target', minSpeed: 175, scale: 0.1 }], discovery: 'bowling',
  },
  {
    id: 'corpse_bowling', trigger: 'impact', source: ['corpse'], target: ['enemy'],
    effects: [{ type: 'slamDamage', to: 'target', minSpeed: 175, scale: 0.1 }], discovery: 'bowling',
  },
  {
    id: 'shaken', trigger: 'impact', source: ['solid'], target: ['explosive'], minImpulse: 1700,
    effects: [{ type: 'detonate', to: 'target' }], discovery: 'shaken',
  },

  // ───────────── things breaking, falling, activating ─────────────
  {
    id: 'lamp_fallen', trigger: 'event', event: 'OBJECT_FALLEN', source: ['lamp'],
    effects: [{ type: 'mark' }], discovery: 'timber',
  },
  {
    id: 'lamp_slam', trigger: 'event', event: 'OBJECT_FALLEN', source: ['lamp'],
    effects: [{ type: 'slam' }], discovery: 'lights_out',
  },
  {
    id: 'shelf_fallen', trigger: 'event', event: 'OBJECT_FALLEN', source: ['bookshelf'],
    effects: [{ type: 'spawnObject', object: 'book', count: 5 }], discovery: 'avalanche',
  },
  {
    id: 'shelf_slam', trigger: 'event', event: 'OBJECT_FALLEN', source: ['bookshelf'],
    effects: [{ type: 'slam' }], discovery: 'well_read',
  },
  {
    id: 'lamp_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['lamp'],
    effects: [
      { type: 'spawnZone', zone: 'electric', radius: 30, ttl: 11, attach: true },
      { type: 'spawnZone', zone: 'glass', radius: 18, ttl: 22 },
    ],
    discovery: 'exposed_wire',
  },
  {
    id: 'computer_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['computer'],
    effects: [
      { type: 'spawnZone', zone: 'electric', radius: 34, ttl: 8, attach: true },
      { type: 'spawnZone', zone: 'glass', radius: 20, ttl: 22 },
    ],
    discovery: 'blue_screen',
  },
  {
    id: 'fan_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['fan'],
    effects: [{ type: 'spawnZone', zone: 'electric', radius: 26, ttl: 4, attach: true }],
  },
  {
    id: 'bottle_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['bottle'],
    effects: [{ type: 'spill', radius: 50 }, { type: 'spawnZone', zone: 'glass', radius: 26, ttl: 25 }],
    discovery: 'spill',
  },
  {
    id: 'pot_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['flowerpot'],
    effects: [{ type: 'spawnZone', zone: 'dirt', radius: 46 }], discovery: 'repotting',
  },
  {
    id: 'trash_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['container'],
    effects: [{ type: 'spawnObject', object: 'paperball', count: 5 }], discovery: 'littering',
  },
  {
    id: 'chair_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['chair'],
    effects: [{ type: 'spawnObject', object: 'plank', count: 3 }], discovery: 'assembly',
  },
  {
    id: 'extinguisher_damaged', trigger: 'event', event: 'OBJECT_DAMAGED', source: ['pressurized'],
    effects: [{ type: 'rocket', duration: 2.6 }], discovery: 'rocket',
  },
  {
    id: 'extinguisher_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['pressurized'],
    effects: [{ type: 'spawnZone', zone: 'foam', radius: 74, ttl: 7 }],
  },
  {
    id: 'explosive_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['explosive'],
    effects: [{ type: 'explode', radius: 150, force: 1, damage: 75 }],
  },

  // ───────────── electricity ─────────────
  {
    id: 'electrify_water', trigger: 'overlap', source: ['electric'], target: ['water'],
    effects: [{ type: 'energize' }], discovery: 'water_electric',
  },
  {
    id: 'water_spreads', trigger: 'overlap', source: ['water', 'energized'], target: ['water'],
    effects: [{ type: 'energize' }],
  },
  {
    id: 'water_conducts', trigger: 'overlap', source: ['water', 'energized'], target: ['object', 'conductive', '!electronic'],
    effects: [{ type: 'energize' }], discovery: 'conductor',
  },
  {
    id: 'shock_water', trigger: 'overlap', source: ['water', 'energized'], target: ['creature'],
    effects: [{ type: 'shock', damage: 28, stun: 1.1 }], discovery: 'shock_therapy',
  },
  {
    id: 'shock_direct', trigger: 'overlap', source: ['electric', '!outlet'], target: ['creature'],
    effects: [{ type: 'shock', damage: 22, stun: 0.9 }], discovery: 'live_wire',
  },
  {
    id: 'spark_ignite', trigger: 'overlap', source: ['electric', '!outlet', '!carried'], target: ['object', 'flammable'],
    effects: [{ type: 'ignite', rate: 0.55 }], discovery: 'short_fuse',
  },
  {
    id: 'short_circuit', trigger: 'overlap', source: ['water'], target: ['electric_enemy'], cooldown: 0.45,
    effects: [{ type: 'hazardDamage', amount: 9, cause: 'water' }, { type: 'slow', factor: 0.5, duration: 0.6 }],
    discovery: 'short_circuit',
  },

  // ───────────── fire ─────────────
  {
    id: 'fire_spread', trigger: 'overlap', source: ['fire'], target: ['object', 'flammable'],
    effects: [{ type: 'ignite', rate: 1.6 }], discovery: 'kindling',
  },
  {
    id: 'fire_burn', trigger: 'overlap', source: ['fire'], target: ['creature'],
    effects: [{ type: 'burn', duration: 2.6 }], discovery: 'hot_foot',
  },
  {
    id: 'fire_explosive', trigger: 'overlap', source: ['fire'], target: ['explosive'],
    effects: [{ type: 'detonate', to: 'target' }], discovery: 'aerosol',
  },
  {
    id: 'fire_water', trigger: 'overlap', source: ['water'], target: ['fire'],
    effects: [{ type: 'extinguish' }], discovery: 'fire_water',
  },
  {
    id: 'foam_fire', trigger: 'overlap', source: ['foam'], target: ['fire'],
    effects: [{ type: 'extinguish' }], discovery: 'extinguished',
  },
  {
    id: 'dirt_fire', trigger: 'overlap', source: ['dirt'], target: ['fire'],
    effects: [{ type: 'extinguish' }], discovery: 'smothered',
  },

  // ───────────── floor hazards ─────────────
  {
    id: 'glass_feet', trigger: 'overlap', source: ['glass'], target: ['enemy'], cooldown: 0.45,
    effects: [{ type: 'hazardDamage', amount: 7, cause: 'glass' }, { type: 'slow', factor: 0.55, duration: 0.6 }],
    discovery: 'barefoot',
  },
  {
    id: 'wet_floor', trigger: 'overlap', noChain: true, source: ['water'], target: ['creature'],
    effects: [{ type: 'slip' }], discovery: 'wet_floor',
  },
  {
    id: 'mud_make', trigger: 'overlap', source: ['dirt'], target: ['water'],
    effects: [{ type: 'transform', zone: 'mud' }, { type: 'remove', to: 'source' }], discovery: 'mud',
  },
  {
    id: 'mud_stuck', trigger: 'overlap', noChain: true, source: ['mud'], target: ['creature'],
    effects: [{ type: 'slow', factor: 0.35, duration: 0.4 }], discovery: 'stuck',
  },
  {
    id: 'foam_party', trigger: 'overlap', noChain: true, source: ['foam'], target: ['enemy'],
    effects: [{ type: 'slow', factor: 0.45, duration: 0.5 }, { type: 'confuse', duration: 0.6 }],
    discovery: 'foam_party',
  },

  // ───────────── wind ─────────────
  {
    id: 'wind_push', trigger: 'overlap', noChain: true, source: ['wind'], target: ['object', '!held'],
    effects: [{ type: 'push', force: 2700 }], discovery: 'air_mail',
  },
  {
    id: 'wind_fire', trigger: 'overlap', source: ['wind'], target: ['fire'],
    effects: [{ type: 'grow' }], discovery: 'fanning',
  },
];
