import type { ObjectDefinition } from './ObjectDefinitions';

const NEVER = 9999;

/**
 * A second helping of things lying about the flat. Same rules as everywhere else: each one
 * is data, and what it does comes from its tags and the rules in interactions/MoreRules.ts.
 * They are scattered by gameplay/Pickups.ts when a room loads (see THEME_EXTRAS there), so
 * the hand-made rooms get them too.
 */
export const MORE_OBJECTS: readonly ObjectDefinition[] = [
  {
    id: 'cactus', name: 'Cactus', material: 'ceramic', shape: { kind: 'circle', r: 9 }, mass: 2.4, height: 22,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    perk: 'it hurts twice',
  },
  {
    id: 'guitar', name: 'Guitar', material: 'wood', shape: { kind: 'box', hw: 22, hh: 8 }, mass: 3, height: 6,
    health: 70, breakable: true, flammable: true, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'leaves them seeing stars',
  },
  {
    id: 'piggybank', name: 'Piggy Bank', material: 'ceramic', shape: { kind: 'circle', r: 10 }, mass: 3.2, height: 14,
    health: 12, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true, funny: true,
    perk: 'full of loose change',
  },
  {
    id: 'coin', name: 'Coin', material: 'metal', shape: { kind: 'circle', r: 4 }, mass: 0.1, height: 2,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, funny: true,
    groundFriction: 240, emitters: [{ zone: 'slick', radius: 9 }], perk: 'underfoot, it is a banana',
  },
  {
    id: 'syrup', name: 'Maple Syrup', material: 'glass', shape: { kind: 'circle', r: 7 }, mass: 1.3, height: 16,
    health: 12, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'breaks into a sticky patch',
  },
  {
    id: 'dumbbell', name: 'Dumbbell', material: 'metal', shape: { kind: 'box', hw: 12, hh: 6 }, mass: 15, height: 8,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, groundFriction: 1300,
    perk: 'small, and far too heavy',
  },
  {
    id: 'pizza', name: 'Pizza Box', material: 'paper', shape: { kind: 'box', hw: 14, hh: 14 }, mass: 0.5, height: 4,
    health: NEVER, breakable: false, flammable: true, conductive: false, throwable: true, funny: true, glide: 0.72,
    perk: 'flies like a frisbee',
  },
  {
    id: 'globe', name: 'Globe', material: 'plastic', shape: { kind: 'circle', r: 12 }, mass: 2.6, height: 20,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, rolls: true,
    restitution: 0.7, perk: 'goes right round the room',
  },
  {
    id: 'trophy', name: 'Trophy', material: 'metal', shape: { kind: 'circle', r: 8 }, mass: 3.4, height: 20,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true, funny: true, quirk: 'gong',
    perk: 'first place, in the face',
  },
  {
    id: 'lavalamp', name: 'Lava Lamp', material: 'glass', shape: { kind: 'circle', r: 7 }, mass: 2.2, height: 26,
    health: 14, breakable: true, flammable: false, conductive: true, throwable: true, removeOnBreak: true, electronic: true,
    perk: 'breaks into slippery goo',
  },
  {
    id: 'kettle', name: 'Kettle', material: 'metal', shape: { kind: 'circle', r: 9 }, mass: 2.8, height: 14,
    health: NEVER, breakable: false, flammable: false, conductive: true, throwable: true,
    perk: 'lands in a cloud of steam',
  },

  // ───────────── more things to use up ─────────────
  {
    id: 'plasters', name: 'Box of Plasters', material: 'paper', shape: { kind: 'box', hw: 8, hh: 6 }, mass: 0.2, height: 6,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true,
    groundFriction: 520, consume: 'heal', perk: 'patch yourself up: +2',
  },
  {
    id: 'bubblewrap', name: 'Bubble Wrap', material: 'plastic', shape: { kind: 'circle', r: 9 }, mass: 0.2, height: 9,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true,
    groundFriction: 520, consume: 'armor', perk: 'wear it: the next two hits pop',
  },
  {
    id: 'snooze', name: 'Snooze Button', material: 'plastic', shape: { kind: 'circle', r: 9 }, mass: 0.3, height: 6,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true,
    groundFriction: 520, consume: 'snooze', perk: 'five more minutes: movers freeze',
  },
  {
    id: 'bone', name: 'Bone', material: 'plastic', shape: { kind: 'box', hw: 9, hh: 4 }, mass: 0.3, height: 4,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, consume: 'treat', perk: 'for the dog: it will not let go',
  },
  {
    id: 'cracker', name: 'Cracker', material: 'paper', shape: { kind: 'box', hw: 7, hh: 7 }, mass: 0.1, height: 3,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, consume: 'treat', perk: 'for the parrot: dive bombing',
  },
  {
    id: 'seeds', name: 'Sunflower Seeds', material: 'paper', shape: { kind: 'box', hw: 8, hh: 7 }, mass: 0.2, height: 8,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, consume: 'treat', perk: 'for the hamster: bowling night',
  },
];
