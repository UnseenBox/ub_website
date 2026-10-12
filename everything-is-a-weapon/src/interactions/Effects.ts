import { FIXED_DT } from '../core/constants';
import type { Game } from '../core/Game';
import type { Chain, DamageCause, DamageType, Thing } from '../core/types';
import { SOURCE_LEVEL, energizeObject, energizeWater } from '../hazards/Electricity';
import { exposeToFire, extinguishZone } from '../hazards/Fire';
import { spillWater } from '../hazards/Water';
import { extendChain, freshChain } from '../gameplay/Chain';
import type { EffectSpec, InteractionRule } from './InteractionRule';

export interface RuleContext {
  readonly game: Game;
  readonly rule: InteractionRule;
  readonly source: Thing;
  readonly target: Thing | null;
  readonly x: number;
  readonly y: number;
  /** Direction from source towards target. */
  readonly nx: number;
  readonly ny: number;
  readonly impulse: number;
  readonly approach: number;
  /** Seconds covered by this evaluation (overlap rules are ticked at a lower rate). */
  readonly seconds: number;
  readonly chain: Chain | null;
}

type EffectOf<T extends EffectSpec['type']> = Extract<EffectSpec, { type: T }>;
type EffectHandlers = { [T in EffectSpec['type']]: (ctx: RuleContext, spec: EffectOf<T>) => boolean };

function pick(ctx: RuleContext, who: 'source' | 'target'): Thing | null {
  return who === 'source' ? ctx.source : ctx.target;
}

function cause(ctx: RuleContext, type: DamageType, dirX = 0, dirY = 0): DamageCause {
  const chain = freshChain(ctx.source, ctx.game.time) ?? ctx.chain;
  return { type, source: ctx.source, chain, label: ctx.source.label, dirX, dirY };
}

/** The thrown object vanishes from the room and reappears on the intruder for a while. */
function putOn(ctx: RuleContext, duration: number, word: string): boolean {
  const { source, target, game } = ctx;
  if (!target || target.kind !== 'enemy' || source.kind !== 'object' || target.plunged > 0 || target.defeated) return false;
  target.wearing = source.def.id;
  target.plunged = duration;
  target.confuse = duration;
  source.destroy(game);
  game.fx.burst(word, target.body.x, target.body.y - 40, 1, '#ff7b54', true);
  game.audio.play('plop', 1);
  game.bus.emit({ type: 'ENEMY_STUNNED', enemy: target });
  return true;
}

function chainWith(ctx: RuleContext, label: string): Chain | null {
  return ctx.chain ? extendChain(ctx.chain, label) : null;
}

const handlers: EffectHandlers = {
  impactDamage(ctx, spec) {
    const { target, source, game } = ctx;
    if (!target) return false;
    if (target.kind === 'enemy') {
      if (source.kind === 'object') {
        // The object has to be what was moving. An intruder stumbling into a plank on the
        // floor produces an impulse too, but that is not being hit by a plank.
        const b = source.body;
        const towards = ((b.x - b.prevX) * ctx.nx + (b.y - b.prevY) * ctx.ny) / FIXED_DT;
        if (towards < Math.max(80, ctx.approach * 0.25)) return false;
      }
      return target.takeImpact(game, ctx.impulse, source, ctx.nx, ctx.ny, spec.scale, freshChain(source, game.time)) > 0;
    }
    // Only something genuinely flying at you hurts; walking into furniture does not.
    if (target.kind === 'player') return ctx.approach > 380 && target.hurt(game, 1, source.label);
    return false;
  },

  structuralDamage(ctx, spec) {
    const { target, game } = ctx;
    if (!target || target.kind !== 'object' || target.tipProgress >= 0) return false;
    // A standing lamp should topple first and shatter when it lands.
    const standingFactor = target.standing ? 0.25 : 1;
    return target.applyDamage(game, ctx.impulse * spec.scale * target.material.fragility * standingFactor);
  },

  slamDamage(ctx, spec) {
    const victim = pick(ctx, spec.to);
    if (!victim || victim.kind !== 'enemy' || ctx.approach < spec.minSpeed) return false;
    // Only a body that is out of control counts: knocked back, skating on a wet floor, or already defeated.
    // An intruder lunging under its own power does not hurt itself on the wall.
    const mover = ctx.source;
    if (mover.kind !== 'enemy' || !(mover.defeated || mover.stun > 0 || mover.slip > 0)) return false;
    const other = spec.to === 'source' ? ctx.target : ctx.source;
    const dir = spec.to === 'source' ? -1 : 1;
    victim.stun = Math.max(victim.stun, 0.5);
    victim.squash = 1;
    victim.damage(ctx.game, (ctx.approach - spec.minSpeed) * spec.scale + 4, {
      type: 'slam',
      source: other,
      chain: freshChain(victim, ctx.game.time) ?? freshChain(other, ctx.game.time),
      label: other?.label ?? 'WALL',
      dirX: ctx.nx * dir,
      dirY: ctx.ny * dir,
    });
    return true;
  },

  tip(ctx) {
    const { target } = ctx;
    if (!target || target.kind !== 'object' || !target.def.tip) return false;
    if (ctx.impulse < target.def.tip.minImpulse) return false;
    return target.tip(ctx.game, ctx.nx, ctx.ny);
  },

  boost(ctx, spec) {
    const { target, source } = ctx;
    if (!target || target.kind !== 'object' || source.kind !== 'object') return false;
    if (source.body.speed() < 200 && ctx.approach < 260) return false;
    const b = target.body;
    b.vx *= spec.factor;
    b.vy *= spec.factor;
    b.vz = Math.max(b.vz, 170);
    b.z = Math.max(b.z, 2);
    b.wake();
    return b.speed() > 260;
  },

  detonate(ctx, spec) {
    const thing = pick(ctx, spec.to);
    if (!thing || thing.kind !== 'object' || !thing.alive) return false;
    if (ctx.chain && !freshChain(thing, ctx.game.time)) {
      thing.chain = extendChain(ctx.chain, thing.label);
      thing.chainAt = ctx.game.time;
    }
    thing.breakApart(ctx.game);
    return true;
  },

  mark() {
    return true;
  },

  slam(ctx) {
    const { source, game } = ctx;
    if (source.kind !== 'object' || !source.def.tip) return false;
    const spec = source.def.tip;
    const b = source.body;
    const cx = b.x + Math.cos(b.angle) * source.headOffset;
    const cy = b.y + Math.sin(b.angle) * source.headOffset;
    const chain = freshChain(source, game.time);
    let hitCreature = false;
    game.world.queryCircle(cx, cy, spec.slamRadius, (body) => {
      const owner = body.owner;
      if (!owner || owner === source) return;
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (owner.kind === 'enemy' && !owner.defeated) {
        owner.stun = Math.max(owner.stun, 0.9);
        owner.squash = 1;
        body.vx += (dx / d) * 160;
        body.vy += (dy / d) * 160;
        owner.damage(game, spec.slamDamage, { type: 'slam', source, chain, label: source.label, dirX: dx / d, dirY: dy / d });
        hitCreature = true;
      } else if (owner.kind === 'player' && spec.slamDamage >= 60) {
        owner.hurt(game, 1, source.label);
      } else if (owner.kind === 'object') {
        owner.applyDamage(game, spec.slamDamage * 0.5);
        body.applyImpulse((dx / d) * 90 * Math.min(body.mass, 8), (dy / d) * 90 * Math.min(body.mass, 8));
        if (chain && !freshChain(owner, game.time)) {
          owner.chain = extendChain(chain, owner.label);
          owner.chainAt = game.time;
        }
      }
    });
    game.particles.burst('dust', cx, cy, 14, 150);
    game.camera.addShake(spec.slamDamage >= 60 ? 0.6 : 0.3);
    game.audio.impact(source.material.sound, spec.slamDamage >= 60 ? 1 : 0.6);
    game.noise(cx, cy, 1);
    return hitCreature;
  },

  spawnZone(ctx, spec) {
    const { game, source } = ctx;
    let x = ctx.x;
    let y = ctx.y;
    let offset = 0;
    if (source.kind === 'object') {
      offset = source.headOffset;
      x = source.body.x + Math.cos(source.body.angle) * offset;
      y = source.body.y + Math.sin(source.body.angle) * offset;
    }
    const attached = spec.attach && source.kind === 'object' && source.alive ? source : null;
    const zone = game.zones.spawn(game, spec.zone, x, y, spec.radius, {
      ttl: spec.ttl,
      attached,
      offset: attached ? offset : 0,
      chain: chainWith(ctx, spec.zone === 'electric' ? 'ELECTRICITY' : spec.zone.toUpperCase()),
      level: spec.zone === 'electric' ? SOURCE_LEVEL : 0,
    });
    if (spec.zone === 'electric') {
      if (attached) attached.electricZone = zone;
      game.particles.burst('spark', x, y, 16, 260);
      game.audio.play('zap', 0.9);
    } else if (spec.zone === 'foam') {
      game.particles.burst('foam', x, y, 26, 200);
      game.audio.play('hiss', 1);
    } else if (spec.zone === 'dirt') {
      game.particles.burst('dirt', x, y, 16, 160);
    }
    return true;
  },

  spill(ctx, spec) {
    spillWater(ctx.game, ctx.x, ctx.y, spec.radius, chainWith(ctx, 'WATER'));
    ctx.game.audio.play('splash', 0.8);
    return true;
  },

  spawnObject(ctx, spec) {
    const { game, source } = ctx;
    let spawned = false;
    for (let i = 0; i < spec.count; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const object = game.spawnObject(spec.object, ctx.x + Math.cos(a) * 10, ctx.y + Math.sin(a) * 10, a);
      if (!object) continue;
      const speed = game.rng.range(120, 300);
      object.body.vx = Math.cos(a) * speed;
      object.body.vy = Math.sin(a) * speed;
      object.body.vz = game.rng.range(120, 260);
      object.body.z = 6;
      object.body.w = game.rng.range(-12, 12);
      if (source.kind === 'object') {
        object.body.ignoreId = source.body.id;
        object.body.ignoreTimer = 0.3;
      }
      if (ctx.chain) {
        object.chain = extendChain(ctx.chain, object.label);
        object.chainAt = game.time;
      }
      spawned = true;
    }
    return spawned;
  },

  rocket(ctx, spec) {
    return ctx.source.kind === 'object' && ctx.source.startRocket(ctx.game, spec.duration);
  },

  explode(ctx, spec) {
    const where = spec.at === 'target' ? ctx.target : null;
    if (where && where.kind === 'zone') {
      ctx.game.explode(where.x, where.y, spec.radius, spec.damage, spec.force, chainWith(ctx, 'EXPLOSION'), ctx.source, spec.style);
      return true;
    }
    ctx.game.explode(ctx.x, ctx.y, spec.radius, spec.damage, spec.force, chainWith(ctx, 'EXPLOSION'), ctx.source, spec.style);
    return true;
  },

  energize(ctx) {
    const { source, target, game } = ctx;
    if (!target || source.kind !== 'zone') return false;
    const level = source.zone === 'electric' ? source.level || SOURCE_LEVEL : source.level;
    if (target.kind === 'zone') return target.zone === 'water' && energizeWater(game, target, level);
    if (target.kind === 'object') return energizeObject(game, target, level);
    return false;
  },

  shock(ctx, spec) {
    const { target, game } = ctx;
    if (!target) return false;
    if (target.kind === 'enemy') return target.shock(game, spec.damage, spec.stun, cause(ctx, 'shock'));
    if (target.kind === 'player') {
      const hurt = target.hurt(game, 1, 'ELECTRICITY');
      if (hurt) {
        game.audio.play('zap', 1);
        game.particles.burst('spark', target.body.x, target.body.y - 8, 12, 240);
      }
      return hurt;
    }
    return false;
  },

  ignite(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'object') return false;
    return exposeToFire(ctx.game, target, spec.rate, ctx.seconds, ctx.chain);
  },

  burn(ctx, spec) {
    const { target, game } = ctx;
    if (!target) return false;
    if (target.kind === 'enemy') return target.igniteFor(game, spec.duration, ctx.chain);
    if (target.kind === 'player') return target.hurt(game, 1, 'FIRE');
    return false;
  },

  extinguish(ctx) {
    const { target } = ctx;
    return target !== null && target.kind === 'zone' && extinguishZone(ctx.game, target);
  },

  hazardDamage(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'enemy' || target.defeated) return false;
    target.damage(ctx.game, spec.amount, cause(ctx, spec.cause));
    return true;
  },

  slow(ctx, spec) {
    const { target } = ctx;
    if (!target || (target.kind !== 'enemy' && target.kind !== 'player')) return false;
    target.slowTimer = spec.duration;
    target.slowFactor = spec.factor;
    return target.kind === 'enemy';
  },

  slip(ctx) {
    const { target } = ctx;
    if (!target || (target.kind !== 'enemy' && target.kind !== 'player')) return false;
    target.slip = 0.3;
    // Only an intruder visibly skating counts as having discovered the wet floor.
    return target.kind === 'enemy' && target.body.speed() > 60;
  },

  confuse(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'enemy') return false;
    target.confuse = spec.duration;
    return true;
  },

  push(ctx, spec) {
    const { source, target } = ctx;
    if (!target || target.kind !== 'object' || source.kind !== 'zone' || target.restingOn) return false;
    const b = target.body;
    if (spec.force * b.invMass <= b.groundFriction * 1.05) return false;
    b.fx += source.dirX * spec.force;
    b.fy += source.dirY * spec.force;
    b.wake();
    return b.speed() > 90;
  },

  grow(ctx) {
    const { target } = ctx;
    if (!target || target.kind !== 'zone' || target.zone !== 'fire') return false;
    const before = target.r;
    target.r = Math.min(target.r + ctx.seconds * 22, 74);
    if (Number.isFinite(target.ttl)) target.ttl += ctx.seconds * 0.8;
    return target.r > before;
  },

  transform(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'zone') return false;
    target.retype(spec.zone);
    ctx.game.particles.burst('dirt', target.x, target.y, 10, 100);
    return true;
  },

  remove(ctx, spec) {
    const thing = pick(ctx, spec.to);
    if (!thing || thing.kind !== 'zone') return false;
    thing.alive = false;
    return true;
  },

  trip(ctx, spec) {
    const victim = pick(ctx, spec.to ?? 'target');
    if (!victim) return false;
    if (victim.kind === 'player') {
      victim.slip = 0.5;
      return false;
    }
    if (victim.kind !== 'enemy') return false;
    const other = spec.to === 'source' ? ctx.target : ctx.source;
    // A banana's slick zone has no name of its own; credit the banana.
    const culprit = other && other.kind === 'zone' && other.attached ? other.attached : other;
    return victim.trip(ctx.game, {
      type: 'slam',
      source: culprit,
      chain: ctx.chain,
      label: culprit?.label ?? 'THE FLOOR',
      dirX: 0,
      dirY: 0,
    });
  },

  blaze(ctx, spec) {
    const { target, game } = ctx;
    // Anything lying about that burns in one go: oil, a cloud of feathers.
    if (!target || target.kind !== 'zone' || target.zone === 'fire') return false;
    target.retype('fire');
    target.ttl = spec.seconds;
    target.age = 0;
    if (ctx.chain) {
      target.chain = extendChain(ctx.chain, 'FIRE');
      target.chainAt = game.time;
    }
    game.particles.burst('ember', target.x, target.y, 24, 260);
    game.particles.burst('smoke', target.x, target.y - 10, 10, 90);
    game.fx.burst('FWOOMPH!', target.x, target.y - 30, 1.25, '#ff9f1c', true);
    game.fx.ring(target.x, target.y, 10, target.r * 1.2, 0.4, 'rgba(255,159,28,0.9)', 4);
    game.camera.addShake(0.3);
    game.audio.play('ignite', 1);
    return true;
  },

  stick(ctx, spec) {
    return putOn(ctx, spec.duration, 'PLOP!');
  },

  wear(ctx, spec) {
    if (spec.minSpeed !== undefined && ctx.approach < spec.minSpeed) return false;
    return putOn(ctx, spec.duration, spec.word);
  },

  pull(ctx, spec) {
    const { source, target } = ctx;
    if (!target || target.kind !== 'object' || source.kind !== 'zone') return false;
    // In your hands it would drag a toolbox into your face; it only works once it is put down.
    const carrier = source.attached;
    if (carrier && carrier.kind === 'object' && carrier.held) return false;
    const b = target.body;
    if (b.type !== 'dynamic' || b.mass > spec.maxMass) return false;
    const dx = source.x - b.x;
    const dy = source.y - b.y;
    const d = Math.hypot(dx, dy);
    // Close enough to be stuck to it: stop pulling, or the pile shoves the magnet round the room.
    const reach = b.boundR + (carrier ? carrier.body.boundR : 0) + 8;
    if (d < reach) {
      b.vx *= 0.5;
      b.vy *= 0.5;
      return false;
    }
    if (target.restingOn) target.leaveSurface();
    const along = (b.vx * dx + b.vy * dy) / d;
    if (along > 620) return false;
    const kick = spec.accel * ctx.seconds * Math.min(1, (d - reach) / 50 + 0.35);
    b.vx += (dx / d) * kick;
    b.vy += (dy / d) * kick;
    b.wake();
    if (Math.random() < 0.35) ctx.game.particles.burst('spark', b.x, b.y - 6, 1, 80);
    return true;
  },

  unhelmet(ctx) {
    const { source, target, game } = ctx;
    if (!target || target.kind !== 'enemy' || target.defeated) return false;
    // A magnet pulls the pan towards itself; a spanner knocks it onwards.
    let dx = ctx.nx;
    let dy = ctx.ny;
    if (source.kind === 'zone') {
      dx = source.x - target.body.x;
      dy = source.y - target.body.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
    }
    const pan = target.loseHelmet(game, dx, dy);
    if (!pan) return false;
    if (ctx.chain) {
      pan.chain = extendChain(ctx.chain, pan.label);
      pan.chainAt = game.time;
    }
    target.stun = Math.max(target.stun, 0.5);
    game.audio.play('gong', 0.8, 1.3);
    game.fx.burst('YOINK!', target.body.x, target.body.y - 48, 0.95, '#cfd8ea', true);
    return true;
  },

  snap(ctx, spec) {
    const { source, target, game } = ctx;
    if (source.kind !== 'zone' || !source.attached || source.attached.kind !== 'object') return false;
    if (!target || target.kind !== 'enemy' || target.defeated) return false;
    const trap = source.attached;
    trap.spring();
    trap.chainAt = game.time;
    source.alive = false;
    target.stun = Math.max(target.stun, spec.stun * target.type.staggerFactor + 0.15);
    target.squash = 1;
    if (spec.hold) {
      target.slowTimer = spec.hold;
      target.slowFactor = 0.12;
    }
    game.audio.play('snap', 1);
    game.fx.burst(spec.word, target.body.x, target.body.y - 42, 1, '#ffe36e', true);
    game.particles.burst('splinter', trap.body.x, trap.body.y - 4, 5, 160);
    game.camera.addShake(0.2);
    game.bus.emit({ type: 'ENEMY_STUNNED', enemy: target });
    target.damage(game, spec.damage, { type: 'slam', source: trap, chain: ctx.chain, label: trap.label, dirX: 0, dirY: 0 });
    return true;
  },

  fuse(ctx, spec) {
    const thing = pick(ctx, spec.to);
    if (!thing || thing.kind !== 'object') return false;
    if (!thing.lightFuse(ctx.game, spec.seconds, spec.rocket ?? 0)) return false;
    if (ctx.chain && !freshChain(thing, ctx.game.time)) {
      thing.chain = extendChain(ctx.chain, thing.label);
      thing.chainAt = ctx.game.time;
    }
    if (spec.whistle) thing.startRinging(spec.seconds, 'kettle');
    return true;
  },

  tag(ctx, spec) {
    const thing = pick(ctx, spec.to);
    if (!thing || thing.kind !== 'object' || !thing.alive) return false;
    const had = thing.tags.has(spec.tag);
    if (spec.seconds !== undefined) thing.tagFor(spec.tag, spec.seconds);
    else thing.tags.add(spec.tag);
    if (had) return false;
    thing.squash = 0.8;
    if (spec.word) ctx.game.fx.burst(spec.word, thing.body.x, thing.body.y - thing.def.height - 26, 0.85, '#9be564', true);
    return true;
  },

  untag(ctx, spec) {
    const thing = pick(ctx, spec.to);
    return thing !== null && thing.kind === 'object' && thing.tags.delete(spec.tag);
  },

  lure(ctx, spec) {
    const { game } = ctx;
    if (spec.sound) game.audio.play(spec.sound, 1);
    game.fx.ring(ctx.x, ctx.y, 8, spec.radius * 0.45, 0.45, 'rgba(255,227,110,0.9)', 3);
    return game.lure(ctx.x, ctx.y, spec.radius, spec.seconds) > 0;
  },

  stagger(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'enemy' || target.defeated) return false;
    target.stun = Math.max(target.stun, spec.seconds * target.type.staggerFactor);
    return true;
  },

  ricochet(ctx, spec) {
    const { source, game } = ctx;
    if (source.kind !== 'object' || ctx.approach < 220) return false;
    const b = source.body;
    const speed = b.speed();
    if (speed < 120) return false;
    const next = Math.min(1500, speed * spec.factor);
    b.vx *= next / speed;
    b.vy *= next / speed;
    b.vz = Math.max(b.vz, 120);
    b.z = Math.max(b.z, 2);
    source.squash = 1;
    source.tagFor('ricochet', 2.5);
    source.chainAt = game.time;
    game.audio.play('boing', 1, Math.min(1.6, 0.8 + speed / 1500));
    game.fx.ring(ctx.x, ctx.y, 4, 34, 0.25, 'rgba(255,90,138,0.9)', 3);
    return true;
  },

  ring(ctx, spec) {
    const { target } = ctx;
    return target !== null && target.kind === 'object' && target.startRinging(spec.duration);
  },

  shoot(ctx, spec) {
    const { target } = ctx;
    if (!target || target.kind !== 'object') return false;
    const b = target.body;
    b.vx = ctx.nx * spec.speed;
    b.vy = ctx.ny * spec.speed;
    b.w += (Math.random() - 0.5) * 8;
    b.wake();
    return true;
  },
};

export function runEffect(ctx: RuleContext, spec: EffectSpec): boolean {
  const handler = handlers[spec.type] as (ctx: RuleContext, spec: EffectSpec) => boolean;
  return handler(ctx, spec);
}
