import { FIXED_DT } from '../core/constants';
import type { Game } from '../core/Game';
import type { GameEvent, GameEventType } from '../core/Events';
import { WALL_THING, type Thing } from '../core/types';
import type { Contact } from '../physics/CollisionResolver';
import type { RigidBody } from '../physics/RigidBody';
import type { Zone } from '../hazards/Zone';
import { freshChain, passChain } from '../gameplay/Chain';
import { runEffect, type RuleContext } from './Effects';
import type { InteractionRule } from './InteractionRule';

function matches(thing: Thing, query: readonly string[]): boolean {
  for (let i = 0; i < query.length; i++) {
    const tag = query[i]!;
    if (tag.charCodeAt(0) === 33 /* ! */) {
      if (thing.tags.has(tag.slice(1))) return false;
    } else if (!thing.tags.has(tag)) {
      return false;
    }
  }
  return true;
}

/**
 * True if `source` was travelling into the contact. An intruder stumbling into a broom on the
 * floor produces an impulse too, but that is not being hit by a broom.
 */
function movingInto(source: Thing, nx: number, ny: number, approach: number): boolean {
  if (source.kind !== 'object') return true;
  const b = source.body;
  const towards = ((b.x - b.prevX) * nx + (b.y - b.prevY) * ny) / FIXED_DT;
  return towards >= Math.max(110, approach * 0.35);
}

function thingOf(body: RigidBody): Thing {
  return body.owner ?? WALL_THING;
}

/**
 * Evaluates the data-driven interaction rules against what the simulation produced:
 * physical contacts, zone overlaps and gameplay events.
 */
export class InteractionSystem {
  /** Rules fired during the last overlap pass, for the debug overlay. */
  firedLastPass = 0;

  private readonly impactRules: InteractionRule[] = [];
  private readonly overlapRules: InteractionRule[] = [];
  private readonly eventRules = new Map<GameEventType, InteractionRule[]>();
  private readonly cooldowns = new Map<string, number>();
  private readonly nearby: RigidBody[] = [];

  constructor(private readonly game: Game, rules: readonly InteractionRule[]) {
    for (const rule of rules) this.addRule(rule);
  }

  addRule(rule: InteractionRule): void {
    if (rule.trigger === 'impact') {
      this.impactRules.push(rule);
    } else if (rule.trigger === 'overlap') {
      this.overlapRules.push(rule);
    } else if (rule.event) {
      let list = this.eventRules.get(rule.event);
      if (!list) {
        list = [];
        this.eventRules.set(rule.event, list);
        this.game.bus.on(rule.event, (event) => this.handleEvent(event));
      }
      list.push(rule);
    }
  }

  reset(): void {
    this.cooldowns.clear();
  }

  handleContact(contact: Contact): void {
    const a = thingOf(contact.a);
    const b = thingOf(contact.b);
    this.runImpact(a, b, contact, 1);
    this.runImpact(b, a, contact, -1);
  }

  private runImpact(source: Thing, target: Thing, contact: Contact, sign: number): void {
    for (let i = 0; i < this.impactRules.length; i++) {
      const rule = this.impactRules[i]!;
      if (rule.minImpulse !== undefined && contact.impulse < rule.minImpulse) continue;
      if (!matches(source, rule.source) || (rule.target && !matches(target, rule.target))) continue;
      // An earlier rule on this same contact may have used the object up.
      if (source.kind === 'object' && !source.alive) return;
      if (rule.moving && !movingInto(source, contact.nx * sign, contact.ny * sign, contact.approach)) continue;
      this.fire(rule, source, target, contact.px, contact.py, contact.nx * sign, contact.ny * sign, contact.impulse, contact.approach, 0);
    }
  }

  private handleEvent(event: GameEvent): void {
    if (!('object' in event)) return;
    const rules = this.eventRules.get(event.type);
    if (!rules) return;
    const source = event.object;
    // For a landing, `minImpulse` is read as the speed it came down at.
    const speed = event.type === 'OBJECT_LANDED' ? event.speed : 0;
    for (const rule of rules) {
      if (!matches(source, rule.source)) continue;
      if (rule.minImpulse !== undefined && event.type === 'OBJECT_LANDED' && speed < rule.minImpulse) continue;
      this.fire(rule, source, null, source.body.x, source.body.y, 0, 0, 0, 0, 0);
    }
  }

  /** Zone-vs-thing and zone-vs-zone triggers. Called at a reduced rate; `seconds` is the time since the last call. */
  updateOverlaps(seconds: number): void {
    const game = this.game;
    const zones = game.zones.zones;
    this.firedLastPass = 0;

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]!;
      if (!zone.alive) continue;

      this.nearby.length = 0;
      game.world.queryCircle(zone.x, zone.y, zone.r, (body) => this.nearby.push(body));
      for (let n = 0; n < this.nearby.length; n++) {
        const body = this.nearby[n]!;
        const owner = body.owner;
        if (!owner || owner === zone.attached || !owner.alive) continue;
        // The zone has to cover a good part of the thing, not just clip its edge.
        if (!body.containsPoint(zone.x, zone.y, zone.r * 0.75)) continue;
        // A candle does not set fire to the table it is standing on.
        if (zone.attached && zone.attached.kind === 'object' && zone.attached.restingOn === owner) continue;
        // You do not get burned or zapped by the thing you are deliberately carrying.
        if (owner.kind === 'player' && zone.attached !== null && zone.attached === owner.held) continue;
        this.runOverlap(zone, owner, seconds);
      }

      for (let j = 0; j < zones.length; j++) {
        if (i === j) continue;
        const other = zones[j]!;
        if (!other.alive || !zone.alive) continue;
        const d = Math.hypot(other.x - zone.x, other.y - zone.y);
        if (d > zone.r + other.r - 6) continue;
        this.runOverlap(zone, other, seconds);
      }
    }

    if (this.cooldowns.size > 400) {
      for (const [key, until] of this.cooldowns) if (until < game.time) this.cooldowns.delete(key);
    }
  }

  private runOverlap(zone: Zone, target: Thing, seconds: number): void {
    for (let r = 0; r < this.overlapRules.length; r++) {
      const rule = this.overlapRules[r]!;
      if (!zone.alive) return;
      if (!matches(zone, rule.source) || (rule.target && !matches(target, rule.target))) continue;
      this.fire(rule, zone, target, zone.x, zone.y, 0, 0, 0, 0, seconds);
    }
  }

  private fire(
    rule: InteractionRule,
    source: Thing,
    target: Thing | null,
    x: number,
    y: number,
    nx: number,
    ny: number,
    impulse: number,
    approach: number,
    seconds: number,
  ): void {
    const game = this.game;
    let cooldownKey = '';
    if (rule.cooldown !== undefined) {
      cooldownKey = `${rule.id}|${source.uid}|${target ? target.uid : 0}`;
      const until = this.cooldowns.get(cooldownKey);
      if (until !== undefined && until > game.time) return;
    }

    // A zone carried by an object (a banana's slipperiness, a candle's flame) has no history
    // of its own: whoever threw the object is the cause.
    const origin: Thing =
      source.kind === 'zone' && source.attached && !freshChain(source, game.time) ? source.attached : source;

    const ctx: RuleContext = {
      game,
      rule,
      source,
      target,
      x,
      y,
      nx,
      ny,
      impulse,
      approach,
      seconds,
      chain: freshChain(origin, game.time) ?? freshChain(target, game.time),
    };

    let meaningful = false;
    for (let i = 0; i < rule.effects.length; i++) {
      try {
        if (runEffect(ctx, rule.effects[i]!)) meaningful = true;
      } catch (error) {
        console.error(`[interactions] effect "${rule.effects[i]!.type}" of rule "${rule.id}" failed`, error);
      }
    }
    if (!meaningful) return;

    this.firedLastPass++;
    if (cooldownKey) this.cooldowns.set(cooldownKey, game.time + (rule.cooldown ?? 0));
    if (target && !rule.noChain) passChain(origin, target, game.time);
    if (rule.discovery) game.discoveries.unlock(rule.discovery);
    if (rule.trigger !== 'overlap') {
      game.bus.emit({ type: 'RULE_FIRED', rule, source, target, x, y });
    }
  }
}
