import type { Game } from '../core/Game';
import type { Chain } from '../core/types';
import type { Zone } from './Zone';

const MAX_PUDDLE_RADIUS = 110;

/**
 * Spills water on the floor. Spilling into an existing puddle makes that puddle bigger
 * instead of stacking zones, so repeated bottles build one large hazard.
 */
export function spillWater(game: Game, x: number, y: number, radius: number, chain: Chain | null): Zone {
  for (const zone of game.zones.zones) {
    if (!zone.alive || zone.zone !== 'water' || zone.attached) continue;
    const d = Math.hypot(zone.x - x, zone.y - y);
    if (d < zone.r * 0.8) {
      zone.r = Math.min(MAX_PUDDLE_RADIUS, Math.sqrt(zone.r * zone.r + radius * radius));
      if (chain) {
        zone.chain = chain;
        zone.chainAt = game.time;
      }
      game.particles.burst('water', x, y, 14, 180);
      return zone;
    }
  }
  const created = game.zones.spawn(game, 'water', x, y, radius, { chain });
  game.particles.burst('water', x, y, 18, 200);
  game.bus.emit({ type: 'WATER_CONTACT', target: created });
  return created;
}
