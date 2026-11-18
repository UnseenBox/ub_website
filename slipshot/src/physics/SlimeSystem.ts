import * as planck from 'planck';
import { SLIME } from '../config';
import { randRange } from '../util/math';
import type { Effects } from '../render/Effects';
import type { Ragdoll } from './Ragdoll';
import type { PhysicsObject } from './PhysicsObject';
import type { PartName } from './rig';
import type { Tag } from './tags';

export const SLIME_COLOR = '#8dff5a';
const SLIME_SHINE = '#e9ffd6';

/**
 * A puddle on a surface. It is a real fixture on a static body whose friction is
 * `friction`: slime puddles are slippery, glue puddles grip. The fixture is removed
 * when the puddle expires.
 */
export interface Puddle {
  body: planck.Body;
  fixture: planck.Fixture | null;
  x: number;
  y: number;
  halfW: number;
  life: number;
  maxLife: number;
  friction: number;
  glue: boolean;
  seed: number;
  alive: boolean;
}

/**
 * Slime that stuck to an enemy: a soft blob welded to one body part. It jiggles
 * with the enemy, and fades out after its lifetime.
 */
export interface Gum {
  body: planck.Body;
  host: Ragdoll;
  part: PartName;
  radius: number;
  life: number;
  seed: number;
  /** Wobble energy, 1 on impact, decaying toward 0. A new hit on the blob sets it back to 1. */
  jiggle: number;
  prevX: number;
  prevY: number;
  alive: boolean;
}

export class SlimeSystem {
  readonly puddles: Puddle[] = [];
  readonly gums: Gum[] = [];
  private readonly effects: Effects;

  constructor(effects: Effects) {
    this.effects = effects;
  }

  /**
   * Create a puddle on a static surface whose top is at point.y. Call outside
   * the physics step. `friction` defaults to slime; glue passes a high value.
   */
  addPuddle(
    body: planck.Body,
    point: planck.Vec2Value,
    radius: number,
    lifetime: number,
    friction: number = SLIME.puddleFriction,
    glue = false,
  ): void {
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
      friction,
      glue,
      seed: Math.random() * 10,
      alive: true,
    };
    const tag: Tag = { kind: 'puddle', puddle };
    const center = body.getLocalPoint({ x: point.x, y: point.y + hy });
    puddle.fixture = body.createFixture(new planck.Box(halfW, hy, center, 0), {
      friction,
      restitution: 0,
      userData: tag,
    });
    this.puddles.push(puddle);
    this.effects.ring(point.x, point.y, glue ? '#ffe0a0' : SLIME_SHINE, 6);
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
    for (const g of this.gums.slice()) {
      g.life -= dt;
      g.jiggle *= Math.exp(-2.2 * dt);
      if (g.life <= 0) this.removeGum(g);
    }
  }

  /**
   * Stick a gum blob to one of an enemy's parts, at a world point. Call outside
   * the physics step. The blob cannot collide with its own character, and the weld
   * is soft, so the blob wobbles instead of sitting rigid.
   */
  addGum(host: Ragdoll, part: PartName, at: planck.Vec2Value, radius: number, lifetime: number): void {
    const partBody = host.parts.get(part)?.body;
    if (!partBody) return;
    while (this.gums.length >= SLIME.maxGums) this.removeGum(this.gums[0]);

    const world = partBody.getWorld();
    const body = world.createBody({
      type: 'dynamic',
      position: { x: at.x, y: at.y },
      linearDamping: 1.5,
      angularDamping: 2,
    });
    const gum: Gum = {
      body,
      host,
      part,
      radius,
      life: lifetime,
      seed: Math.random() * 10,
      jiggle: 1,
      prevX: at.x,
      prevY: at.y,
      alive: true,
    };
    const tag: Tag = { kind: 'gum', gum };
    body.createFixture(new planck.Circle(radius), {
      density: 1.5,
      friction: 0.9,
      restitution: 0.05,
      filterGroupIndex: -host.id,
      userData: tag,
    });
    world.createJoint(new planck.WeldJoint({ frequencyHz: 5, dampingRatio: 0.35 }, partBody, body, at));
    this.gums.push(gum);
  }

  removeGum(g: Gum): void {
    if (!g.alive) return;
    g.alive = false;
    g.body.getWorld().destroyBody(g.body);
    const i = this.gums.indexOf(g);
    if (i >= 0) this.gums.splice(i, 1);
  }

  /** Remember where each gum blob was, so the renderer can blend between physics steps. */
  snapshot(): void {
    for (const g of this.gums) {
      const p = g.body.getPosition();
      g.prevX = p.x;
      g.prevY = p.y;
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
