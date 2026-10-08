import { CURSOR, PLAYER, VIEW } from '../core/Tuning';
import { Rng, clamp, dist, rectsOverlap, type Rect } from '../core/Mathx';
import type { EventBus } from '../core/EventBus';
import type { CursorController } from '../cursor/CursorController';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { WorldObject } from '../world/WorldObject';
import type { PatternMemory } from '../gameplay/PatternMemory';
import type { ParticleSystem } from '../particles/ParticleSystem';
import type { NoiseSystem } from './NoiseSystem';

export interface InteractionStats {
  clicks: number;
  usefulClicks: number;
  interactions: number;
  decoysUsed: number;
  distractionsUsed: number;
  brokenObjects: number;
  hidesUsed: number;
}

export interface InteractionContext {
  room: Room;
  player: Player;
  cursor: CursorController;
  noise: NoiseSystem;
  particles: ParticleSystem;
  bus: EventBus;
  patterns: PatternMemory;
  stats: InteractionStats;
  rng: Rng;
  /** Called when a discovery is earned, so the book fills in through play. */
  discover: (id: string) => void;
}

export type ObjectBehavior = (obj: WorldObject, ctx: InteractionContext) => void;

/** Raised when the player tried something the world would not allow. */
export type RefusalReason = 'out-of-reach' | 'locked' | 'spent';

/**
 * Behaviour table. One entry per prop that does something interesting; props
 * without an entry fall back to a plain state toggle plus their noise.
 *
 * A consequence is the point of every one of these. Nothing is "click to win":
 * the light switch that hides you also announces you, the phone that saves you
 * puts a creature on a path, and the bottle that distracts is also irreversible.
 */
const BEHAVIORS: Partial<Record<string, ObjectBehavior>> = {
  LIGHT_SWITCH: (obj, ctx) => {
    const turningOff = obj.state === 'on';
    obj.setState(turningOff ? 'off' : 'on');
    setLights(obj, ctx, !turningOff);
    ctx.discover('object-light-switch');
    if (turningOff) {
      ctx.discover('mechanic-darkness');
      ctx.bus.emit('TOAST', { text: 'HARDER TO SEE. HARDER TO BE SEEN.', tone: 'cool' });
    }
  },

  LAMP: (obj, ctx) => {
    const turningOff = obj.state === 'on';
    obj.setState(turningOff ? 'off' : 'on');
    setLights(obj, ctx, !turningOff);
    if (obj.lights.length === 0) {
      const own = ctx.room.findLight(`${obj.id}-light`);
      if (own) own.on = !turningOff;
    }
  },

  BREAKER: (obj, ctx) => {
    obj.setState('off');
    for (const l of ctx.room.lights) l.on = false;
    ctx.room.markGeometryDirty();
    ctx.discover('object-breaker');
    ctx.discover('mechanic-darkness');
    ctx.bus.emit('TOAST', { text: 'THE POWER IS OUT', tone: 'cool' });
    ctx.bus.emit('SHAKE', { amount: 2.5 });
  },

  DOOR: (obj, ctx) => {
    obj.setState(obj.state === 'open' ? 'closed' : 'open');
    ctx.room.markGeometryDirty();
  },

  EXIT: (obj, ctx) => {
    if (obj.requires && !ctx.player.inventory.has(obj.requires)) {
      ctx.bus.emit('OBJECT_BLOCKED', { objectId: obj.id, reason: 'locked' });
      return;
    }
    // An exit wired to a switch is operated by that switch, not by hand. This is
    // derived from the room data rather than flagged, so a designer who wires a
    // switch to a door cannot forget to lock the door.
    const wired = ctx.room.objects.some((o) => o !== obj && o.targets.includes(obj.id));
    if (wired && obj.state !== 'open') {
      ctx.bus.emit('OBJECT_BLOCKED', { objectId: obj.id, reason: 'locked' });
      ctx.bus.emit('TOAST', { text: 'IT OPENS FROM SOMEWHERE ELSE', tone: 'warm' });
      return;
    }
    obj.setState('open');
    ctx.room.markGeometryDirty();
  },

  VENT: (obj, ctx) => {
    obj.setState('open');
    ctx.room.markGeometryDirty();
    if (!obj.linkTo) return;
    const other = ctx.room.findObject(obj.linkTo);
    if (!other) return;
    other.setState('open');
    ctx.player.x = other.x;
    ctx.player.y = other.y + 18;
    ctx.particles.burst(other.x, other.y, 10, 'dust');
    ctx.discover('object-vent');
  },

  BUTTON: (obj, ctx) => {
    obj.setState(obj.state === 'on' ? 'off' : 'on');
    operateTargets(obj, ctx);
  },

  METAL_SWITCH: (obj, ctx) => {
    obj.setState(obj.state === 'on' ? 'off' : 'on');
    operateTargets(obj, ctx);
    ctx.discover('mechanic-loud-click');
  },

  ALARM: (obj, ctx) => {
    obj.setState('on');
    obj.stateTimer = 6;
    obj.revertTo = 'off';
    ctx.bus.emit('SHAKE', { amount: 5 });
    ctx.bus.emit('TOAST', { text: 'WHY WOULD YOU DO THAT', tone: 'hot' });
    ctx.discover('object-alarm');
  },

  PHONE: (obj, ctx) => {
    if (obj.state === 'ringing') {
      obj.setState('idle');
      obj.revertTo = null;
      obj.stateTimer = 0;
      return;
    }
    obj.setState('ringing');
    obj.stateTimer = 5.5;
    obj.revertTo = 'idle';
    ctx.stats.distractionsUsed++;
    ctx.patterns.note('distract:phone');
    ctx.discover('object-phone');
    ctx.discover('mechanic-distraction');
  },

  RADIO: (obj, ctx) => {
    const on = obj.state === 'on';
    obj.setState(on ? 'off' : 'on');
    if (!on) {
      ctx.stats.distractionsUsed++;
      ctx.patterns.note('distract:radio');
      ctx.discover('object-radio');
      ctx.discover('mechanic-distraction');
    }
  },

  CLOCK: (obj) => {
    obj.setState(obj.state === 'on' ? 'off' : 'on');
  },

  FAN: (obj, ctx) => {
    const on = obj.state === 'on';
    obj.setState(on ? 'off' : 'on');
    if (!on) {
      ctx.discover('object-fan');
      ctx.bus.emit('TOAST', { text: 'SOMETHING TO HIDE YOUR NOISE IN', tone: 'cool' });
    }
  },

  TELEVISION: (obj, ctx) => {
    const on = obj.state === 'on';
    obj.setState(on ? 'off' : 'on');
    setLights(obj, ctx, !on);
    if (on) {
      ctx.cursor.removeDecoysFrom(obj.id);
      return;
    }
    // A flickering screen reads as attention. The room lies for you.
    ctx.cursor.spawnDecoy({
      pattern: 'STATIC',
      x: obj.x,
      y: obj.y,
      duration: 999,
      potency: 0.55,
      noise: 0,
      radius: 6,
      sourceId: obj.id,
    });
    ctx.stats.decoysUsed++;
    ctx.patterns.note('decoy:screen');
    ctx.discover('mechanic-decoy');
  },

  COMPUTER: (obj, ctx) => {
    obj.setState('on');
    obj.stateTimer = 7;
    obj.revertTo = 'off';
    setLights(obj, ctx, true);
    ctx.cursor.spawnDecoy({
      pattern: 'CLICKING',
      x: obj.x,
      y: obj.y - 4,
      duration: 7,
      potency: 0.75,
      noise: 1,
      radius: 14,
      sourceId: obj.id,
    });
    ctx.stats.decoysUsed++;
    ctx.patterns.note('decoy:terminal');
    ctx.discover('object-computer');
    ctx.discover('mechanic-decoy');
  },

  PROJECTOR: (obj, ctx) => {
    obj.setState('on');
    obj.stateTimer = 8.5;
    obj.revertTo = 'off';
    setLights(obj, ctx, true);
    // Throw the fake cursor away from the player, deeper into the room.
    const towardCentre = ctx.player.x < VIEW.width * 0.5 ? 1 : -1;
    const tx = clamp(obj.x + towardCentre * 180, 70, VIEW.width - 70);
    const ty = clamp(obj.y + ctx.rng.range(-50, 50), 70, VIEW.height - 70);
    ctx.cursor.spawnDecoy({
      pattern: 'MOVING',
      x: tx,
      y: ty,
      duration: 8.5,
      potency: 1,
      noise: 0,
      radius: 76,
      sourceId: obj.id,
    });
    ctx.stats.decoysUsed++;
    ctx.patterns.note('decoy:projector');
    ctx.discover('object-projector');
    ctx.discover('mechanic-decoy');
    ctx.bus.emit('TOAST', { text: 'IT IS WATCHING SOMETHING ELSE', tone: 'cool' });
  },

  MIRROR: (obj, ctx) => {
    obj.setState(obj.state === 'on' ? 'off' : 'on');
    if (obj.state === 'off') {
      ctx.cursor.removeDecoysFrom(obj.id);
      return;
    }
    // Angled light throws a reflection that something might mistake for you.
    ctx.cursor.spawnDecoy({
      pattern: 'STATIC',
      x: obj.x + (obj.x < VIEW.width * 0.5 ? 120 : -120),
      y: obj.y + 10,
      duration: 10,
      potency: 0.65,
      noise: 0,
      radius: 4,
      sourceId: obj.id,
    });
    ctx.stats.decoysUsed++;
    ctx.patterns.note('decoy:mirror');
    ctx.discover('object-mirror');
  },

  KEY: (obj, ctx) => {
    takePickup(obj, ctx);
    ctx.player.inventory.add('key');
    ctx.bus.emit('TOAST', { text: 'KEY', tone: 'cool' });
  },

  BOOK: (obj, ctx) => {
    takePickup(obj, ctx);
    ctx.discover('secret-notebook');
    ctx.bus.emit('TOAST', { text: 'SOMEONE ELSE TRIED THIS', tone: 'warm' });
  },

  TOY: (obj, ctx) => {
    takePickup(obj, ctx);
    ctx.discover('secret-toy');
  },

  DRAWER: (obj, ctx) => {
    obj.setState(obj.state === 'open' ? 'closed' : 'open');
    revealContents(obj, ctx);
  },

  CABINET: (obj, ctx) => {
    obj.setState(obj.state === 'open' ? 'closed' : 'open');
    ctx.room.markGeometryDirty();
    revealContents(obj, ctx);
  },

  LOCKER: (obj, ctx) => {
    obj.setState(obj.state === 'open' ? 'closed' : 'open');
    ctx.room.markGeometryDirty();
    revealContents(obj, ctx);
    if (obj.state === 'open') ctx.discover('mechanic-hiding');
  },

  TABLE: (_obj, ctx) => {
    ctx.discover('mechanic-hiding');
    ctx.bus.emit('TOAST', { text: 'SPACE TO GET UNDER IT', tone: 'cool' });
  },

  BOTTLE: breakGlass,
  CUP: breakGlass,

  BOX: shove,
  CHAIR: shove,
};

function breakGlass(obj: WorldObject, ctx: InteractionContext): void {
  obj.setState('broken');
  obj.usesLeft = 0;
  ctx.stats.brokenObjects++;
  ctx.stats.distractionsUsed++;
  ctx.particles.burst(obj.x, obj.y, 16, 'glass');
  ctx.patterns.note('distract:glass');
  ctx.bus.emit('OBJECT_BROKEN', { objectId: obj.id, kind: obj.kind });
  ctx.discover('object-glass');
  ctx.discover('mechanic-distraction');
}

function shove(obj: WorldObject, ctx: InteractionContext): void {
  const dx = obj.x - ctx.player.x;
  const dy = obj.y - ctx.player.y;
  const d = Math.hypot(dx, dy) || 1;
  obj.vx += (dx / d) * 140;
  obj.vy += (dy / d) * 140;
  ctx.room.markGeometryDirty();
  ctx.discover('object-push');
}

function takePickup(obj: WorldObject, ctx: InteractionContext): void {
  obj.taken = true;
  obj.setState('taken');
  ctx.player.inventory.add(obj.id);
  ctx.particles.burst(obj.x, obj.y, 7, 'spark');
  ctx.room.markGeometryDirty();
}

function setLights(obj: WorldObject, ctx: InteractionContext, on: boolean): void {
  for (const id of obj.lights) {
    const light = ctx.room.findLight(id);
    if (light) light.on = on;
  }
}

function operateTargets(obj: WorldObject, ctx: InteractionContext): void {
  for (const id of obj.targets) {
    const target = ctx.room.findObject(id);
    if (!target) continue;
    if (target.kind === 'DOOR' || target.kind === 'EXIT' || target.kind === 'VENT') {
      target.setState(target.state === 'open' ? 'closed' : 'open');
      ctx.room.markGeometryDirty();
    } else if (target.def.createsLight) {
      const next = target.state === 'on' ? 'off' : 'on';
      target.setState(next);
      setLights(target, ctx, next === 'on');
    } else {
      target.setState(target.state === 'on' ? 'off' : 'on');
    }
  }
}

function revealContents(obj: WorldObject, ctx: InteractionContext): void {
  if (obj.state !== 'open') return;
  for (const other of ctx.room.objects) {
    if (other.hiddenIn !== obj.id || other.revealed) continue;
    other.revealed = true;
    ctx.particles.burst(other.x, other.y, 6, 'dust');
    ctx.bus.emit('TOAST', { text: 'SOMETHING IN THERE', tone: 'cool' });
  }
}

/**
 * Turns player intent into world change, and every world change into a noise.
 *
 * The rule that makes the game tick: a click is a tap on the world at the cursor.
 * Clicking nothing is still a sound. There is no free input.
 */
export class InteractionSystem {
  /** The object the cursor is currently over, for hover feedback. */
  hovered: WorldObject | null = null;
  /** The object a timed interaction is running on. */
  busyObject: WorldObject | null = null;
  /** Reason the last attempt failed, for a one-line nudge in the HUD. */
  lastRefusal: { reason: RefusalReason; at: number } | null = null;

  constructor(private readonly ctx: InteractionContext) {}

  get stats(): InteractionStats {
    return this.ctx.stats;
  }

  /** Left click: act on whatever is under the cursor, or disturb empty air. */
  handleClick(x: number, y: number, button: number): void {
    const ctx = this.ctx;
    ctx.stats.clicks++;
    const target = ctx.room.objectAt(x, y);

    ctx.bus.emit('CURSOR_CLICKED', {
      x,
      y,
      button,
      onObject: target ? target.kind : null,
    });

    if (button === 2) {
      // Right click cancels a timed interaction. That is all it does, on purpose.
      this.cancelBusy();
      return;
    }

    if (!target) {
      // A click on nothing is still a sound at the cursor. This is the rule that
      // makes players flinch before they click.
      ctx.cursor.registerClick(CURSOR.emptyClickNoise);
      ctx.noise.emit(x, y, CURSOR.emptyClickNoise, 'tick', true);
      ctx.discover('mechanic-click-noise');
      return;
    }

    this.tryInteract(target, 'cursor');
  }

  /** E key: act on the nearest thing, without putting the cursor anywhere near it. */
  handleKeyInteract(): void {
    const ctx = this.ctx;
    const near = ctx.room.nearestInteractable(ctx.player.x, ctx.player.y, PLAYER.reach + 10);
    if (!near) return;
    ctx.discover('mechanic-blind-reach');
    this.tryInteract(near, 'key');
  }

  tryInteract(obj: WorldObject, via: 'cursor' | 'key'): boolean {
    const ctx = this.ctx;
    if (!obj.def.interactable || !obj.revealed || obj.taken) return false;

    if (obj.def.requiresProximity && !ctx.player.canReach(obj.x, obj.y, obj.def.reachBonus)) {
      this.refuse(obj, 'out-of-reach');
      return false;
    }
    if (obj.requires && !ctx.player.inventory.has(obj.requires)) {
      this.refuse(obj, 'locked');
      return false;
    }
    if (obj.spent) {
      this.refuse(obj, 'spent');
      return false;
    }
    if (obj.cooldown > 0 || obj.busy) return false;

    if (via === 'cursor') ctx.stats.usefulClicks++;

    if (obj.def.interactionTime > 0) {
      obj.busy = true;
      obj.progress = 0;
      this.busyObject = obj;
      return true;
    }

    this.complete(obj);
    return true;
  }

  private refuse(obj: WorldObject, reason: RefusalReason): void {
    this.lastRefusal = { reason, at: performance.now() };
    this.ctx.bus.emit('OBJECT_BLOCKED', { objectId: obj.id, reason });
    if (reason === 'out-of-reach') {
      // The cursor reached, the body did not. Still a sound where you pointed.
      this.ctx.noise.emit(this.ctx.cursor.x, this.ctx.cursor.y, CURSOR.emptyClickNoise, 'tick', true);
      this.ctx.cursor.registerClick(CURSOR.emptyClickNoise);
      this.ctx.discover('mechanic-reach');
    }
  }

  private complete(obj: WorldObject): void {
    const ctx = this.ctx;
    obj.busy = false;
    obj.progress = 0;
    this.busyObject = null;
    obj.cooldown = obj.def.cooldown;
    if (obj.usesLeft > 0) obj.usesLeft--;

    const behavior = BEHAVIORS[obj.kind];
    if (behavior) behavior(obj, ctx);
    else obj.setState(obj.state === 'on' ? 'off' : 'on');

    ctx.stats.interactions++;
    ctx.patterns.note(`interact:${obj.kind}`);

    const level = obj.def.clickNoise;
    if (level > 0) {
      ctx.cursor.registerClick(Math.min(level, 6));
      ctx.noise.emit(obj.x, obj.y, level, obj.def.noiseKind, true);
    }
    if (level >= 5) ctx.discover('mechanic-loud-click');

    ctx.bus.emit('OBJECT_INTERACTED', {
      objectId: obj.id,
      kind: obj.kind,
      state: obj.state,
    });
  }

  cancelBusy(): void {
    if (!this.busyObject) return;
    this.busyObject.busy = false;
    this.busyObject.progress = 0;
    this.busyObject = null;
  }

  /** SPACE: duck into or out of cover. */
  toggleHide(): void {
    const ctx = this.ctx;
    if (ctx.player.hidden) {
      const spot = ctx.room.findObject(ctx.player.hiddenIn!);
      if (spot) spot.occupied = false;
      ctx.player.leaveHiding();
      ctx.noise.emit(ctx.player.x, ctx.player.y, 2, 'object', true);
      ctx.bus.emit('PLAYER_UNHIDDEN', { objectId: spot?.id ?? '' });
      return;
    }

    const playerRect: Rect = {
      x: ctx.player.x - PLAYER.radius,
      y: ctx.player.y - PLAYER.radius,
      w: PLAYER.radius * 2,
      h: PLAYER.radius * 2,
    };
    for (const o of ctx.room.objects) {
      if (!o.def.hideSpot || o.occupied) continue;
      const near = rectsOverlap(playerRect, o.rect) || dist(ctx.player.x, ctx.player.y, o.x, o.y) < 34;
      if (!near) continue;
      if (o.kind === 'LOCKER' && o.state !== 'open') continue;
      o.occupied = true;
      ctx.player.enterHiding(o.id);
      ctx.player.x = o.x;
      ctx.player.y = o.y + (o.kind === 'TABLE' ? 4 : 10);
      ctx.stats.hidesUsed++;
      ctx.patterns.note(`hide:${o.id}`);
      ctx.noise.emit(o.x, o.y, 2, 'object', true);
      ctx.discover('mechanic-hiding');
      ctx.bus.emit('PLAYER_HIDDEN', { objectId: o.id });
      return;
    }
  }

  update(dt: number, cursorX: number, cursorY: number): void {
    const ctx = this.ctx;
    this.hovered = ctx.room.objectAt(cursorX, cursorY);

    // Timed interactions: a window during which you are committed and exposed.
    const busy = this.busyObject;
    if (busy) {
      if (!ctx.player.canReach(busy.x, busy.y, busy.def.reachBonus)) {
        this.cancelBusy();
      } else {
        busy.progress += dt / busy.def.interactionTime;
        if (busy.progress >= 1) this.complete(busy);
      }
    }

    // Continuous noise: a ringing phone or a radio keeps pulling attention.
    for (const o of ctx.room.objects) {
      const loop = o.def.loopNoise;
      if (!loop || o.state !== loop.state) {
        o.loopTimer = 0;
        continue;
      }
      o.loopTimer -= dt;
      if (o.loopTimer <= 0) {
        o.loopTimer = loop.interval;
        // A looping distraction is the object's own noise, not the player's, so
        // it does not count against a silent run.
        ctx.noise.emit(o.x, o.y, loop.level, loop.kind, false);
      }
    }

    this.updateProps(dt);
  }

  /** Light physics: shoved props slide, scrape and settle. */
  private updateProps(dt: number): void {
    const ctx = this.ctx;
    let moved = false;
    for (const o of ctx.room.objects) {
      if (!o.def.pushable) continue;

      // Walking into something light nudges it, and that makes a sound.
      const d = dist(o.x, o.y, ctx.player.x, ctx.player.y);
      const contact = PLAYER.radius + Math.max(o.w, o.h) * 0.5 + 2;
      if (d < contact && !ctx.player.hidden) {
        const speed = Math.hypot(ctx.player.vx, ctx.player.vy);
        if (speed > 20) {
          const inv = 1 / (d || 1);
          o.vx += (o.x - ctx.player.x) * inv * speed * 0.5 * dt * 14;
          o.vy += (o.y - ctx.player.y) * inv * speed * 0.5 * dt * 14;
        }
      }

      if (o.vx === 0 && o.vy === 0) continue;
      const before = { x: o.x, y: o.y };
      const damp = Math.exp(-5.5 * dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.x = clamp(o.x, o.w * 0.5, VIEW.width - o.w * 0.5);
      o.y = clamp(o.y, o.h * 0.5, VIEW.height - o.h * 0.5);
      o.vx *= damp;
      o.vy *= damp;
      if (Math.abs(o.vx) < 2 && Math.abs(o.vy) < 2) {
        o.vx = 0;
        o.vy = 0;
      }
      const travelled = dist(before.x, before.y, o.x, o.y);
      if (travelled > 0.3) {
        moved = true;
        o.animPhase += travelled * 0.05;
        this.scrapeAccum += travelled;
        if (this.scrapeAccum > 24) {
          this.scrapeAccum = 0;
          ctx.noise.emit(o.x, o.y, 3, 'object', true);
        }
      }
    }
    if (moved) ctx.room.markGeometryDirty();
  }

  private scrapeAccum = 0;

  reset(): void {
    this.hovered = null;
    this.busyObject = null;
    this.lastRefusal = null;
    this.scrapeAccum = 0;
  }
}
