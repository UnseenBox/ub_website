import type { Game } from '../core/Game';
import type { Chain } from '../core/types';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Zone } from './Zone';

/**
 * Accumulates heat on a flammable object. Paper catches almost instantly,
 * a table needs to sit in the flames for a while.
 */
export function exposeToFire(game: Game, object: PhysicsObject, rate: number, seconds: number, chain: Chain | null): boolean {
  if (object.burning || !object.alive || !object.def.flammable) return false;
  const massFactor = 1 / (1 + object.def.mass / 25);
  object.igniteExposure += rate * object.material.flammability * massFactor * seconds;
  if (object.igniteExposure < 1) {
    if (Math.random() < 0.3) game.particles.burst('smoke', object.body.x, object.body.y - object.def.height, 1, 30);
    return false;
  }
  if (!object.ignite(game, chain)) return false;
  game.audio.play('ignite', 0.8);
  return true;
}

/** Puts a fire zone out, including whatever was carrying it. */
export function extinguishZone(game: Game, fire: Zone): boolean {
  if (!fire.alive || fire.zone !== 'fire') return false;
  fire.alive = false;
  const carrier = fire.attached;
  if (carrier) {
    if (carrier.kind === 'object') carrier.extinguish();
    else carrier.extinguish();
  }
  game.particles.burst('steam', fire.x, fire.y, 10, 70);
  game.audio.play('hiss', 0.6);
  return true;
}
