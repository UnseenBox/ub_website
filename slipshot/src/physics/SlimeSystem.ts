import * as planck from 'planck';
import { SLIME } from '../config';
import { randRange } from '../util/math';
import type { Effects } from '../render/Effects';
import type { Ragdoll } from './Ragdoll';
import type { PhysicsObject } from './PhysicsObject';
import type { Tag } from './tags';

export const SLIME_COLOR = '#8dff5a';
const SLIME_SHINE = '#e9ffd6';

/**
 * A slippery puddle. It is a real fixture on a static body whose friction is
 * SLIME.puddleFriction, so contacts with it are slippery through the engine.
 * The fixture is removed when the puddle expires.
 */
export interface Puddle {
  body: planck.Body;
  fixture: planck.Fixture | null;
  x: number;
  y: number;
  halfW: number;
  life: number;
  maxLife: number;
  seed: number;
  alive: boolean;
}

export class SlimeSystem {
  readonly puddles: Puddle[] = [];
  private readonly effects: Effects;

  constructor(effects: Effects) {
    this.effects = effects;
  }

  /** Create a puddle on a static surface whose top is at point.y. Call outside the step. */
  addPuddle(body: planck.Body, point: planck.Vec2Value, radius: number, lifetime: number): void {
    while (this.puddles.length >= SLIME.maxPuddles) this.removePuddle(this.puddles[0]);

    const halfW = Math.max(0.3, radius * randRange(0.75, 1.0));
    const hy = SLIME.puddleThickness / 2;
    const puddle: Puddle = {
      body,
      fixture: null,
      x: point.x,
      y: point.y,
      halfW,
      life: lifetime,
      maxLife: lifetime,
      seed: Math.random() * 10,
      alive: true,
    };
    const tag: Tag = { kind: 'puddle', puddle };
    const center = body.getLocalPoint({ x: point.x, y: point.y + hy });
    puddle.fixture = body.createFixture(new planck.Box(halfW, hy, center, 0), {
      friction: SLIME.puddleFriction,
      restitution: 0,
      userData: tag,
    });
    this.puddles.push(puddle);
    this.effects.ring(point.x, point.y, SLIME_SHINE, 6);
  }

  removePuddle(p: Puddle): void {
    if (!p.alive) return;
    p.alive = false;
    if (p.fixture) p.body.destroyFixture(p.fixture);
    p.fixture = null;
    const i = this.puddles.indexOf(p);
    if (i >= 0) this.puddles.splice(i, 1);
  }

  update(dt: number): void {
    for (const p of this.puddles.slice()) {
      p.life -= dt;
      if (p.life <= 0) this.removePuddle(p);
    }
  }

  /**
   * Splat at a point: spray droplets, coat characters and objects within the
   * splat radius. `skip` is a character already coated by a direct hit.
   */
  splat(
    point: planck.Vec2Value,
    normal: planck.Vec2Value,
    radius: number,
    coatDuration: number,
    ragdolls: Ragdoll[],
    objects: PhysicsObject[],
    skip: Ragdoll | null,
  ): void {
    this.effects.burst(point.x, point.y, SLIME_COLOR, 22, 7.5, -normal.x, -normal.y);
    this.effects.burst(point.x, point.y, SLIME_SHINE, 6, 4, -normal.x, -normal.y);

    for (const r of ragdolls) {
      if (r === skip || !r.alive) continue;
      let near = false;
      for (const part of r.parts.values()) {
        const p = part.body.getPosition();
        if (Math.hypot(p.x - point.x, p.y - point.y) <= radius + 0.3) {
          near = true;
          break;
        }
      }
      if (near) r.coat(coatDuration);
    }
    for (const o of objects) {
      const p = o.body.getPosition();
      if (Math.hypot(p.x - point.x, p.y - point.y) <= radius + o.size) o.coat(coatDuration);
    }
  }
}
