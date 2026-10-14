import type { InteractionRule } from './InteractionRule';

/** Rules for objects/MoreObjects.ts. They reuse the effects and zones that are already there. */
export const MORE_RULES: readonly InteractionRule[] = [
  {
    id: 'cactus_prick', trigger: 'impact', source: ['cactus'], target: ['enemy'], minImpulse: 60, cooldown: 0.5, moving: true,
    effects: [{ type: 'hazardDamage', amount: 12, cause: 'glass' }, { type: 'stagger', seconds: 0.7 }], discovery: 'prickly',
  },
  {
    id: 'guitar_kabong', trigger: 'impact', source: ['guitar'], target: ['enemy'], minImpulse: 90, cooldown: 0.5, moving: true,
    effects: [{ type: 'confuse', duration: 2.2 }, { type: 'stagger', seconds: 0.5 }], discovery: 'encore',
  },
  {
    id: 'piggy_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['piggybank'],
    effects: [{ type: 'spawnObject', object: 'coin', count: 7 }], discovery: 'payday',
  },
  {
    id: 'syrup_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['syrup'],
    effects: [{ type: 'spawnZone', zone: 'mud', radius: 58, ttl: 14 }, { type: 'spawnZone', zone: 'glass', radius: 18, ttl: 14 }],
    discovery: 'sticky_situation',
  },
  {
    id: 'lava_broken', trigger: 'event', event: 'OBJECT_BROKEN', source: ['lavalamp'],
    effects: [{ type: 'spawnZone', zone: 'paint', radius: 52, ttl: 16 }, { type: 'spawnZone', zone: 'glass', radius: 18, ttl: 14 }],
    discovery: 'groovy',
  },
  {
    id: 'kettle_steam', trigger: 'impact', source: ['kettle'], target: ['enemy'], minImpulse: 80, cooldown: 1.5, moving: true,
    effects: [{ type: 'spawnZone', zone: 'steam', radius: 56, ttl: 3.5 }], discovery: 'tea_time',
  },
];
