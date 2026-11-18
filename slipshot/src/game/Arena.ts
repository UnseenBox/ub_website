import * as planck from 'planck';
import { PhysicsObject } from '../physics/PhysicsObject';
import type { PhysicsManager } from '../physics/PhysicsManager';
import type { Tag } from '../physics/tags';

export interface SolidBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface IslandInfo {
  minX: number;
  maxX: number;
  topY: number;
  /** Home islands hold the player and the enemies. */
  home: 'player' | 'enemy';
}

/**
 * The only ground in the arena: two home islands with a void between them.
 * Characters stand on them and fall into the void when they are knocked off.
 * Each island is 0.6 m thick below its top.
 */
export const ISLANDS: IslandInfo[] = [
  { minX: -16, maxX: -6, topY: 0, home: 'player' },
  { minX: 7.5, maxX: 18.5, topY: 0, home: 'enemy' },
];

/**
 * Static terrain (the islands) on one static body, plus the loose objects that
 * slime can coat. Everything physical is a real Planck fixture.
 */
export class Arena {
  readonly terrain: planck.Body;
  readonly solids: SolidBox[] = [];
  readonly islands = ISLANDS;
  readonly objects: PhysicsObject[] = [];

  constructor(physics: PhysicsManager) {
    this.terrain = physics.world.createBody({ type: 'static', position: { x: 0, y: 0 } });
    const tag: Tag = { kind: 'platform' };

    for (const p of ISLANDS) {
      const hw = (p.maxX - p.minX) / 2;
      const cx = (p.maxX + p.minX) / 2;
      this.addBox(cx, p.topY - 0.3, hw, 0.3, tag, 0.8);
    }

    // Resting on the home islands. Nothing else is loose in the arena.
    this.objects.push(new PhysicsObject(physics, 'crate', -12, 0.47, 0.45, 8));
    this.objects.push(new PhysicsObject(physics, 'ball', 9.0, 0.46, 0.45, 6));
  }

  private addBox(cx: number, cy: number, hx: number, hy: number, tag: Tag, friction: number): void {
    const shape = new planck.Box(hx, hy, new planck.Vec2(cx, cy), 0);
    this.terrain.createFixture(shape, { friction, restitution: 0.05, userData: tag });
    this.solids.push({ minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy });
  }

  /** True when a point lies inside solid terrain (used by the aim preview). */
  isSolid(x: number, y: number): boolean {
    for (const s of this.solids) {
      if (x >= s.minX && x <= s.maxX && y >= s.minY && y <= s.maxY) return true;
    }
    return false;
  }
}
