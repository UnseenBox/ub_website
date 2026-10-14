import type { InteractionRule } from './InteractionRule';

/**
 * Interactions for the kitchen, bathroom, living room, bedroom and garage objects.
 * They plug into the same engine as the core rules, and they combine with them freely:
 * a puddle from a broken vase conducts electricity, a burning cushion sets off the flour.
 */
export const HOUSE_RULES: readonly InteractionRule[] = [
  // ───────────── slippery things ─────────────
  {
    id: 'slick_trip', trigger: 'overlap', source: ['slick'], target: ['enemy'],
    effects: [{ type: 'trip' }], discovery: 'pratfall',
  },
  {
    id: 'slick_player', trigger: 'overlap', source: ['slick'], target: ['player'], noChain: true,
    effects: [{ type: 'slip' }],
  },
  {
    id: 'oil_trip', trigger: 'overlap', source: ['oil'], target: ['enemy'],
    effects: [{ type: 'trip' }], discovery: 'oil_slick',
  },
  {
    id: 'oil_player', trigger: 'overlap', source: ['oil'], target: ['player'], noChain: true,
    effects: [{ type: 'slip' }],
  },
  {
    id: 'paint_slip', trigger: 'overlap', source: ['paint'], target: ['creature'], noChain: true,
    effects: [{ type: 'slip' }], discovery: 'wet_paint',
  },
  {
    id: 'skate_trip', trigger: 'impact', source: ['enemy'], target: ['skateboard', '!held'], minImpulse: 40, cooldown: 1.5,
    effects: [{ type: 'trip', to: 'source' }, { type: 'shoot', speed: 520 }], discovery: 'kickflip',
  },

  // ───────────── oil and flour ─────────────
  {
    id: 'oil_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['oilbottle'],
    effects: [{ type: 'spawnZone', zone: 'oil', radius: 62 }, { type: 'spawnZone', zone: 'glass', radius: 20, ttl: 20 }],
  },
  {
    id: 'jerry_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['jerrycan'],
    effects: [{ type: 'spawnZone', zone: 'oil', radius: 84 }],
  },
  {
    id: 'oil_fire', trigger: 'overlap', source: ['fire'], target: ['oil'],
    effects: [{ type: 'blaze', seconds: 8 }], discovery: 'grease_fire',
  },
  {
    id: 'oil_spark', trigger: 'overlap', source: ['electric', '!outlet', '!carried'], target: ['oil'],
    effects: [{ type: 'blaze', seconds: 8 }], discovery: 'grease_fire',
  },
  {
    id: 'flour_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['flour'],
    effects: [{ type: 'spawnZone', zone: 'flour', radius: 82, ttl: 8 }],
  },
  {
    id: 'flour_blind', trigger: 'overlap', source: ['flour'], target: ['enemy'],
    effects: [{ type: 'confuse', duration: 0.7 }, { type: 'slow', factor: 0.6, duration: 0.5 }], discovery: 'whiteout',
  },
  {
    id: 'flour_fire', trigger: 'overlap', source: ['fire'], target: ['flour'],
    effects: [{ type: 'explode', radius: 160, force: 1.1, damage: 70, at: 'target' }, { type: 'remove', to: 'target' }],
    discovery: 'dust_explosion',
  },
  {
    id: 'flour_spark', trigger: 'overlap', source: ['electric', '!outlet', '!carried'], target: ['flour'],
    effects: [{ type: 'explode', radius: 160, force: 1.1, damage: 70, at: 'target' }, { type: 'remove', to: 'target' }],
    discovery: 'dust_explosion',
  },

  // ───────────── kitchen ─────────────
  {
    id: 'toaster_pop', trigger: 'impact', source: ['solid'], target: ['toaster', '!broken'], minImpulse: 450, cooldown: 1.1,
    effects: [{ type: 'spawnObject', object: 'toast', count: 2 }], discovery: 'breakfast',
  },
  {
    id: 'appliance_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['appliance'],
    effects: [{ type: 'spawnZone', zone: 'electric', radius: 26, ttl: 8, attach: true }],
  },
  {
    id: 'plate_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['plate'],
    effects: [{ type: 'spawnZone', zone: 'glass', radius: 16, ttl: 18 }],
  },
  {
    id: 'fridge_fallen', trigger: 'event', event: 'OBJECT_FALLEN', source: ['fridge'],
    effects: [{ type: 'spawnObject', object: 'banana', count: 2 }, { type: 'spawnObject', object: 'bottle', count: 2 }],
    discovery: 'leftovers',
  },
  {
    id: 'fridge_slam', trigger: 'event', event: 'OBJECT_FALLEN', source: ['fridge'],
    effects: [{ type: 'slam' }], discovery: 'cold_cuts',
  },

  // ───────────── bathroom ─────────────
  {
    id: 'plunged', trigger: 'impact', source: ['plunger'], target: ['enemy'], minImpulse: 180,
    effects: [{ type: 'stick', duration: 3.4 }], discovery: 'plunged',
  },
  {
    id: 'mirror_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['mirror'],
    effects: [{ type: 'spawnZone', zone: 'glass', radius: 36, ttl: 26 }], discovery: 'bad_luck',
  },
  {
    id: 'toilet_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['toilet'],
    effects: [{ type: 'spill', radius: 92 }], discovery: 'flood',
  },
  {
    id: 'tub_splash', trigger: 'impact', source: ['solid', '!player', '!enemy'], target: ['bathtub'], minImpulse: 1500, cooldown: 2.5,
    effects: [{ type: 'spill', radius: 54 }], discovery: 'splash_zone',
  },

  // ───────────── living room and bedroom ─────────────
  {
    id: 'vase_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['vase'],
    effects: [{ type: 'spill', radius: 46 }, { type: 'spawnZone', zone: 'glass', radius: 20, ttl: 22 }],
  },
  {
    id: 'tv_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['tv'],
    effects: [
      { type: 'spawnZone', zone: 'electric', radius: 34, ttl: 9, attach: true },
      { type: 'spawnZone', zone: 'glass', radius: 24, ttl: 22 },
    ],
    discovery: 'bad_reception',
  },
  {
    id: 'alarm_ring', trigger: 'impact', source: ['solid', '!player'], target: ['alarmclock', '!held'], minImpulse: 220, cooldown: 4,
    effects: [{ type: 'ring', duration: 3.6 }], discovery: 'wake_up_call',
  },

  // ───────────── garage ─────────────
  {
    id: 'paint_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['paintcan'],
    effects: [{ type: 'spawnZone', zone: 'paint', radius: 66 }],
  },
  {
    id: 'toolbox_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['toolbox'],
    effects: [{ type: 'spawnObject', object: 'wrench', count: 4 }], discovery: 'spare_parts',
  },
];
