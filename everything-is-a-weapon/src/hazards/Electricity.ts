import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Zone } from './Zone';
import { extendChain, freshChain } from '../gameplay/Chain';

/** Level given to a real power source. Each conductor the current passes through costs one level. */
export const SOURCE_LEVEL = 5;
/** How long something stays live after its last contact with a source. */
const HOLD_SECONDS = 0.45;

/**
 * Electrifies a puddle from a source of the given level.
 * Levels fall by one per hop, which is what stops two touching puddles from
 * keeping each other alive forever once the real source is gone.
 */
export function energizeWater(game: Game, water: Zone, sourceLevel: number): boolean {
  const level = sourceLevel - 1;
  if (level < 1) return false;
  const active = water.energized && game.time <= water.energizedUntil;
  if (active && water.level > level) return false;
  const isNew = !active;
  water.level = level;
  water.energizedUntil = game.time + HOLD_SECONDS;
  water.tags.add('energized');
  if (isNew) {
    game.bus.emit({ type: 'ELECTRICITY_CONTACT', target: water });
    game.audio.play('zap', 0.9);
    game.particles.burst('spark', water.x, water.y, 12, 220);
  }
  return true;
}

/** A conductive object sitting in live water becomes a mobile electricity source. */
export function energizeObject(game: Game, object: PhysicsObject, sourceLevel: number): boolean {
  const level = sourceLevel - 1;
  if (level < 1 || !object.alive || !object.def.conductive) return false;
  const zone = object.electricZone;
  // Same rule as for puddles: a weaker source may not keep a stronger charge alive,
  // otherwise a metal bin and the puddle it sits in would power each other forever.
  if (zone && zone.alive && zone.level > level) return false;
  const isNew = !object.tags.has('energized');
  object.energizedUntil = game.time + HOLD_SECONDS;
  object.tags.add('energized');
  if (zone && zone.alive) {
    if (Number.isFinite(zone.ttl)) zone.ttl = Math.max(zone.ttl, HOLD_SECONDS);
    zone.level = level;
  } else {
    const chain = freshChain(object, game.time);
    object.electricZone = game.zones.spawn(game, 'electric', object.body.x, object.body.y, object.body.boundR + 12, {
      attached: object,
      ttl: HOLD_SECONDS,
      level,
      chain: chain ? extendChain(chain, 'ELECTRICITY') : null,
      extraTags: ['carried'],
    });
  }
  if (isNew) game.bus.emit({ type: 'ELECTRICITY_CONTACT', target: object });
  return isNew;
}
