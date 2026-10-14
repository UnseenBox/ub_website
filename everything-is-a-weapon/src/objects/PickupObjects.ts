import type { ObjectDefinition } from './ObjectDefinitions';

const NEVER = 9999;

/**
 * Things you use up instead of throwing: grabbing one consumes it on the spot
 * (gameplay/Pickups.ts). They are placed by the game when a room loads, not by the room data,
 * so every room layout can have them.
 */
export const PICKUP_OBJECTS: readonly ObjectDefinition[] = [
  {
    id: 'chili', name: 'Ghost Pepper', material: 'plastic', shape: { kind: 'circle', r: 7 }, mass: 0.2, height: 5,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, consume: 'rage', perk: 'eat it: one minute of blind rage',
  },
  {
    id: 'tuna', name: 'Tin of Tuna', material: 'metal', shape: { kind: 'circle', r: 8 }, mass: 0.4, height: 5,
    health: NEVER, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 520, consume: 'treat', perk: 'for the cat: it goes to war',
  },
];
