import type { Game } from '../core/Game';
import { DISCOVERIES, DISCOVERY_BY_ID } from './Discoveries';

export const DISCOVERY_SCORE = 200;

/** Tracks which interactions the player has found, persisted through the SaveManager. */
export class DiscoverySystem {
  newThisRoom = 0;

  constructor(private readonly game: Game) {}

  get total(): number {
    return DISCOVERIES.length;
  }

  get count(): number {
    return this.game.save.data.discoveries.length;
  }

  has(id: string): boolean {
    return this.game.save.data.discoveries.includes(id);
  }

  unlock(id: string): boolean {
    const definition = DISCOVERY_BY_ID.get(id);
    if (!definition || this.has(id)) return false;
    // The menu backdrop simulates a room too; nothing should be discovered from there.
    if (this.game.state !== 'playing') return false;
    this.game.save.data.discoveries.push(id);
    this.game.save.write();
    this.newThisRoom++;
    this.game.bus.emit({ type: 'DISCOVERY', id, isNew: true });
    return true;
  }
}
