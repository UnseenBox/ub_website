import type { ObjectDefinition } from './ObjectDefinitions';

const NEVER = 9999;

/**
 * The rest of the flat: what you find in a kitchen, a bathroom, a living room, a bedroom
 * and a garage. Same rules as the core objects — each entry is only data, and whatever it
 * can do comes from its material, its tags and the interaction rules in HouseRules.ts.
 *
 * `fixed` objects are plumbed-in or built-in: they never move, but they can still be hit,
 * broken, stood on by smaller things and matched by rules.
 */
export const HOUSE_OBJECTS: readonly ObjectDefinition[] = [
  // ───────────── kitchen ─────────────
  {
    id: 'pan', name: 'Frying Pan', material: 'metal', shape: { kind: 'circle', r: 11 }, mass: 2.8, height: 5,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, quirk: 'gong',
    tags: ['guard'], perk: 'stuns, and blocks a lunge',
  },
  {
    id: 'plate', name: 'Plate', material: 'ceramic', shape: { kind: 'circle', r: 10 }, mass: 0.6, height: 3,
    health: 8, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    groundFriction: 300, glide: 0.62, perk: 'sails like a frisbee',
  },
  {
    id: 'toaster', name: 'Toaster', material: 'electronic', shape: { kind: 'box', hw: 11, hh: 8 }, mass: 2.4,
    height: 12, health: 46, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    tags: ['appliance'], perk: 'hit it for toast',
  },
  {
    id: 'toast', name: 'Toast', material: 'paper', shape: { kind: 'box', hw: 7, hh: 6 }, mass: 0.15, height: 3,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    perk: 'lands butter side down',
  },
  {
    id: 'banana', name: 'Banana', material: 'plastic', shape: { kind: 'circle', r: 7 }, mass: 0.25, height: 5,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, emitters: [{ zone: 'slick', radius: 13 }], perk: 'leave it in their way',
  },
  {
    id: 'oilbottle', name: 'Cooking Oil', material: 'glass', shape: { kind: 'circle', r: 7 }, mass: 1.2, height: 17,
    health: 14, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'slippery, then on fire',
  },
  {
    id: 'flour', name: 'Bag of Flour', material: 'paper', shape: { kind: 'box', hw: 10, hh: 8 }, mass: 1.6, height: 16,
    health: 9, breakable: true, flammable: true, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'a cloud that goes boom',
  },
  {
    id: 'fridge', name: 'Fridge', material: 'metal', shape: { kind: 'box', hw: 26, hh: 22 }, mass: 95, height: 58,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: false, groundFriction: 1700,
    tip: {
      length: 82, fallenShape: { kind: 'box', hw: 41, hh: 26 }, minImpulse: 4200, slamDamage: 85, slamRadius: 50,
      perpendicular: true,
    },
    perk: 'falls flat, full of food',
  },
  {
    id: 'counter', name: 'Worktop', material: 'wood', shape: { kind: 'box', hw: 70, hh: 23 }, mass: 500, height: 26,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: false, fixed: true, surface: true,
  },
  {
    id: 'stove', name: 'Cooker', material: 'metal', shape: { kind: 'box', hw: 32, hh: 23 }, mass: 500, height: 26,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: false, fixed: true, surface: true,
    emitters: [{ zone: 'fire', radius: 14, offset: -15, whileTag: 'lit' }], tags: ['lit'],
  },

  // ───────────── bathroom ─────────────
  {
    id: 'soap', name: 'Bar of Soap', material: 'plastic', shape: { kind: 'box', hw: 8, hh: 5 }, mass: 0.2, height: 4,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 150, emitters: [{ zone: 'slick', radius: 11 }], perk: 'slides for miles',
  },
  {
    id: 'duck', name: 'Rubber Duck', material: 'rubber', shape: { kind: 'circle', r: 8 }, mass: 0.3, height: 9,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true, quirk: 'squeak',
    perk: 'its squeak turns heads',
  },
  {
    id: 'hairdryer', name: 'Hairdryer', material: 'electronic', shape: { kind: 'box', hw: 10, hh: 5 }, mass: 0.8,
    height: 7, health: 18, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    emitters: [{ zone: 'wind', radius: 36, offset: 48, whileTag: 'powered' }],
    tags: ['appliance', 'powered'], perk: 'point it: hot air',
  },
  {
    id: 'plunger', name: 'Plunger', material: 'rubber', shape: { kind: 'circle', r: 7 }, mass: 0.8, height: 22,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    restitution: 0.3, perk: 'sticks to a face',
  },
  {
    id: 'mirror', name: 'Mirror', material: 'glass', shape: { kind: 'box', hw: 15, hh: 4 }, mass: 3, height: 34,
    health: 12, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'a whole floor of glass',
  },
  {
    id: 'toilet', name: 'Toilet', material: 'ceramic', shape: { kind: 'box', hw: 15, hh: 20 }, mass: 500, height: 22,
    health: 26, breakable: true, flammable: false, conductive: false, throwable: false, fixed: true,
  },
  {
    id: 'bathtub', name: 'Bathtub', material: 'ceramic', shape: { kind: 'box', hw: 62, hh: 27 }, mass: 500, height: 20,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: false, fixed: true,
  },

  // ───────────── living room ─────────────
  {
    // "Breakable" only by rule: it bursts when it hits someone, never from being knocked about.
    id: 'pillow', name: 'Cushion', material: 'fabric', shape: { kind: 'box', hw: 13, hh: 10 }, mass: 0.5, height: 7,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    removeOnBreak: true, perk: 'bursts into feathers',
  },
  {
    id: 'tv', name: 'Telly', material: 'electronic', shape: { kind: 'box', hw: 26, hh: 6 }, mass: 13, height: 34,
    health: 55, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    perk: 'sparks once smashed',
  },
  {
    id: 'vase', name: 'Vase', material: 'ceramic', shape: { kind: 'circle', r: 9 }, mass: 2.2, height: 20,
    health: 16, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    tags: ['liquid'], perk: 'water and shards',
  },
  {
    id: 'sofa', name: 'Sofa', material: 'fabric', shape: { kind: 'box', hw: 58, hh: 24 }, mass: 85, height: 20,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: false, surface: true,
    groundFriction: 1500, perk: 'too heavy to throw: shove it',
  },

  // ───────────── bedroom ─────────────
  {
    id: 'bed', name: 'Bed', material: 'fabric', shape: { kind: 'box', hw: 44, hh: 64 }, mass: 120, height: 16,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: false, surface: true,
    groundFriction: 1700, perk: 'too heavy to throw: shove it',
  },
  {
    id: 'alarmclock', name: 'Alarm Clock', material: 'metal', shape: { kind: 'circle', r: 7 }, mass: 0.6, height: 9,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, funny: true,
    perk: 'rings: they go to look',
  },
  {
    id: 'teddy', name: 'Teddy Bear', material: 'fabric', shape: { kind: 'circle', r: 9 }, mass: 0.6, height: 10,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    perk: 'hugs a face, will not let go',
  },

  // ───────────── garage ─────────────
  {
    id: 'tire', name: 'Tyre', material: 'rubber', shape: { kind: 'circle', r: 15 }, mass: 7, height: 9,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, rolls: true,
    restitution: 0.75, tags: ['roller'], perk: 'bowls them over',
  },
  {
    id: 'skateboard', name: 'Skateboard', material: 'wood', shape: { kind: 'box', hw: 18, hh: 6 }, mass: 2.6, height: 5,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, groundFriction: 110,
    perk: 'someone will step on it',
  },
  {
    id: 'paintcan', name: 'Tin of Paint', material: 'metal', shape: { kind: 'circle', r: 10 }, mass: 4, height: 14,
    health: 30, breakable: true, flammable: false, conductive: true, throwable: true, removeOnBreak: true,
    perk: 'right in the eyes',
  },
  {
    id: 'jerrycan', name: 'Petrol Can', material: 'plastic', shape: { kind: 'box', hw: 11, hh: 8 }, mass: 5, height: 18,
    health: 34, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    explosive: true, perk: 'do not drop',
  },
  {
    id: 'toolbox', name: 'Toolbox', material: 'metal', shape: { kind: 'box', hw: 18, hh: 10 }, mass: 12, height: 14,
    health: 60, breakable: true, flammable: false, conductive: true, throwable: true,
    perk: 'full of spanners',
  },
  {
    id: 'wrench', name: 'Spanner', material: 'metal', shape: { kind: 'box', hw: 10, hh: 3 }, mass: 1.2, height: 3,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true,
    tags: ['tool'], perk: 'undoes a saucepan hat',
  },
];
