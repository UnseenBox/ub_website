import * as planck from 'planck';
import { ARENA } from '../config';
import { PhysicsObject } from '../physics/PhysicsObject';
import type { PhysicsManager } from '../physics/PhysicsManager';
import type { Tag } from '../physics/tags';

export interface SolidBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlatformInfo {
  minX: number;
  maxX: number;
  topY: number;
}

/** Raised platforms. Their tops are at topY; the slab runs 0.6 m thick below. */
const PLATFORMS: PlatformInfo[] = [
  { minX: -6.9, maxX: -4.1, topY: 3.1 },
  { minX: 0.2, maxX: 3.8, topY: 1.0 },
  { minX: 11.1, maxX: 15.9, topY: 4.0 },
];

/**
 * Static terrain (floor, walls, platforms) on one static body, plus the loose
 * objects that slime can coat. Everything physical is a real Planck fixture.
 */
export class Arena {
  readonly terrain: planck.Body;
  readonly solids: SolidBox[] = [];
  readonly platforms = PLATFORMS;
  readonly objects: PhysicsObject[] = [];

  constructor(physics: PhysicsManager) {
    this.terrain = physics.world.createBody({ type: 'static', position: { x: 0, y: 0 } });

    const groundTag: Tag = { kind: 'ground' };
    const platformTag: Tag = { kind: 'platform' };

    this.addBox(0, -0.5, ARENA.halfWidth, 0.5, groundTag, 0.9);

    for (const p of PLATFORMS) {
      const hw = (p.maxX - p.minX) / 2;
      const cx = (p.maxX + p.minX) / 2;
      this.addBox(cx, p.topY - 0.3, hw, 0.3, platformTag, 0.8);
    }

    this.objects.push(new PhysicsObject(physics, 'crate', -2.6, 0.47, 0.45, 8));
    this.objects.push(new PhysicsObject(physics, 'crate', 1.0, 1.0 + 0.44, 0.42, 5));
    this.objects.push(new PhysicsObject(physics, 'ball', 6.2, 0.46, 0.45, 6));
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
