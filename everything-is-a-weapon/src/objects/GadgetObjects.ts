import type { ObjectDefinition } from './ObjectDefinitions';

const NEVER = 9999;

/**
 * Objects that do something of their own: they move, wait, count down, pull, play or come
 * back. Still only data — the moving parts are a `behavior` (entities/Behaviors.ts), an
 * emitter zone, or rules in interactions/GadgetRules.ts.
 */
export const GADGET_OBJECTS: readonly ObjectDefinition[] = [
  // ───────────── things that move by themselves ─────────────
  {
    id: 'hoover', name: 'Robot Hoover', material: 'electronic', shape: { kind: 'circle', r: 15 }, mass: 4, height: 8,
    health: 50, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true, surface: true,
    groundFriction: 200, behavior: { kind: 'wander', speed: 74 }, tags: ['appliance'],
    perk: 'wanders about, hates water',
  },
  {
    id: 'teeth', name: 'Wind-up Teeth', material: 'plastic', shape: { kind: 'circle', r: 7 }, mass: 0.4, height: 8,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 300,
    behavior: { kind: 'seek', speed: 168, seconds: 7, bite: 5, every: 0.55, discovery: 'ankle_biter' },
    perk: 'throw them: they chase',
  },
  {
    id: 'boomerang', name: 'Boomerang', material: 'wood', shape: { kind: 'box', hw: 13, hh: 4 }, mass: 1.3, height: 3,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true,
    behavior: { kind: 'boomerang', seconds: 1.7, discovery: 'returns' }, perk: 'comes back to your hand',
  },
  {
    id: 'fish', name: 'Fish', material: 'rubber', shape: { kind: 'circle', r: 7 }, mass: 0.3, height: 4,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    restitution: 0.2, groundFriction: 420, emitters: [{ zone: 'slick', radius: 12 }],
    behavior: { kind: 'flop', seconds: 9 }, perk: 'slippery, and cross about it',
  },

  // ───────────── things that wait ─────────────
  {
    id: 'mousetrap', name: 'Mousetrap', material: 'wood', shape: { kind: 'box', hw: 9, hh: 6 }, mass: 0.3, height: 3,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    behavior: { kind: 'trap', rearm: 0 },
    emitters: [{ zone: 'trap', radius: 13, whileTag: 'armed', tags: ['mousetrap'] }],
    perk: 'put it down, then wait',
  },
  {
    id: 'rake', name: 'Rake', material: 'wood', shape: { kind: 'box', hw: 30, hh: 4 }, mass: 2.2, height: 4,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true,
    behavior: { kind: 'trap', rearm: 1.6 },
    emitters: [{ zone: 'trap', radius: 13, offset: 24, whileTag: 'armed', tags: ['rake'] }],
    perk: 'the oldest joke there is',
  },

  // ───────────── things that pull, power and pour ─────────────
  {
    id: 'magnet', name: 'Magnet', material: 'metal', shape: { kind: 'box', hw: 11, hh: 10 }, mass: 3, height: 6,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true,
    groundFriction: 1500, emitters: [{ zone: 'magnet', radius: 130 }], perk: 'metal comes flying to it',
  },
  {
    id: 'battery', name: 'Car Battery', material: 'plastic', shape: { kind: 'box', hw: 14, hh: 9 }, mass: 13, height: 13,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true,
    emitters: [{ zone: 'electric', radius: 20, tags: ['outlet', 'battery'] }],
    perk: 'a socket you can carry',
  },
  {
    id: 'bucket', name: 'Bucket', material: 'metal', shape: { kind: 'circle', r: 11 }, mass: 2.6, height: 15,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true,
    tags: ['full', 'wearable'], perk: 'water to go; refill at the bath',
  },

  // ───────────── things on a timer ─────────────
  {
    id: 'firework', name: 'Firework', material: 'paper', shape: { kind: 'box', hw: 14, hh: 4 }, mass: 1, height: 5,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'light it, point it, let go',
  },
  {
    id: 'cooker', name: 'Pressure Cooker', material: 'metal', shape: { kind: 'circle', r: 12 }, mass: 5, height: 13,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, removeOnBreak: true,
    perk: 'hit it, then stand back',
  },
  {
    id: 'boombox', name: 'Boombox', material: 'electronic', shape: { kind: 'box', hw: 17, hh: 8 }, mass: 3.4, height: 13,
    health: 60, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    emitters: [{ zone: 'music', radius: 125, whileTag: 'playing' }], tags: ['appliance'],
    perk: 'throw it: they have to dance',
  },

  // ───────────── things full of water ─────────────
  {
    id: 'fishtank', name: 'Fish Tank', material: 'glass', shape: { kind: 'box', hw: 22, hh: 13 }, mass: 24, height: 22,
    health: 34, breakable: true, flammable: false, conductive: false, throwable: false, removeOnBreak: true,
    groundFriction: 1300, perk: 'a flood with fish in it',
  },
  {
    id: 'watercooler', name: 'Water Cooler', material: 'plastic', shape: { kind: 'circle', r: 12 }, mass: 13, height: 50,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: false, groundFriction: 1300,
    tip: { length: 56, fallenShape: { kind: 'box', hw: 28, hh: 11 }, minImpulse: 1000, slamDamage: 30, slamRadius: 30 },
    perk: 'tip it over for a flood',
  },

  // ───────────── things that roll, sweep and scorch ─────────────
  {
    id: 'officechair', name: 'Office Chair', material: 'plastic', shape: { kind: 'circle', r: 16 }, mass: 9, height: 14,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, groundFriction: 150,
    tags: ['roller'], perk: 'on wheels: goes a long way',
  },
  {
    id: 'bowlingball', name: 'Bowling Ball', material: 'plastic', shape: { kind: 'circle', r: 11 }, mass: 15, height: 11,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, rolls: true,
    restitution: 0.1, groundFriction: 170, tags: ['roller'], perk: 'slow to throw, hard to stop',
  },
  {
    id: 'broom', name: 'Broom', material: 'wood', shape: { kind: 'box', hw: 30, hh: 3.5 }, mass: 1.6, height: 4,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true,
    tags: ['sweeper'], perk: 'sweeps legs',
  },
  {
    id: 'iron', name: 'Iron', material: 'electronic', shape: { kind: 'box', hw: 11, hh: 7 }, mass: 3.2, height: 9,
    health: 50, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    tags: ['appliance', 'hot'], perk: 'still hot',
  },
];
