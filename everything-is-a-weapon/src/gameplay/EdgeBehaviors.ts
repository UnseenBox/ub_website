import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';

/**
 * The Edges that change what a throw does rather than a number (RICOCHET, SHOCKWAVE, BOOMERANG).
 * They listen to the event bus and nudge the physics; the stack counts come from `game.edges`,
 * which is already capped at EDGE_STACK_CAP and is zero in daily rooms, so nothing here has to check.
 */

/** A ricochet looks for the next mover this far from the one just hit. */
export const RICOCHET_RANGE = 260;
/** Fraction of the throw's speed kept by the bounce (80% at three stacks). */
const RICOCHET_SPEED = [0, 0.6, 0.6, 0.8] as const;
/** Shockwave: a full-charge throw lands with a ring this big (px), growing per stack. */
export const SHOCKWAVE_MIN_CHARGE = 0.9;
export const SHOCKWAVE_RADIUS = 90;
const SHOCKWAVE_STEP = 25;
/** Boomerang: the first throw of a room comes back if it has hit nothing after this long. */
export const BOOMERANG_AFTER = 1.2;
const BOOMERANG_SPEED = 430;
const CATCH_DISTANCE = 34;

interface Flight {
  speed: number;
  charge: number;
  bounces: number;
  lastBounce: number;
  waved: boolean;
  hit: boolean;
  thrownAt: number;
}

export class EdgeBehaviors {
  private readonly flights = new WeakMap<PhysicsObject, Flight>();
  /** The first thrown object of this room, while it may still come home. */
  private returning: PhysicsObject | null = null;
  private firstThrowSpent = false;
  private homing = false;

  constructor(private readonly game: Game) {
    const bus = game.bus;
    bus.on('ROOM_START', () => {
      this.firstThrowSpent = false;
      this.returning = null;
      this.homing = false;
    });
    bus.on('OBJECT_THROWN', (e) => {
      const flight: Flight = {
        speed: Math.max(e.object.body.speed(), 200), charge: e.charge, bounces: 0, lastBounce: -9,
        waved: false, hit: false, thrownAt: game.time,
      };
      this.flights.set(e.object, flight);
      if (!this.firstThrowSpent) {
        this.firstThrowSpent = true;
        if (game.edges.stacks('boomerang') > 0) this.returning = e.object;
      }
    });
    bus.on('ENEMY_HIT', (e) => {
      const source = e.cause.source;
      if (e.cause.type !== 'impact' || !source || source.kind !== 'object') return;
      const flight = this.flights.get(source);
      if (!flight) return;
      flight.hit = true;
      this.ricochet(source, flight, e.enemy.body.x, e.enemy.body.y, e.enemy.uid);
      this.shockwave(source, flight);
    });
    bus.on('OBJECT_LANDED', (e) => {
      const flight = this.flights.get(e.object);
      if (flight) this.shockwave(e.object, flight);
    });
  }

  /** After a thrown object hits a mover it flies on to the nearest other one. */
  private ricochet(object: PhysicsObject, flight: Flight, x: number, y: number, hitUid: number): void {
    const game = this.game;
    const stacks = game.edges.stacks('ricochet');
    if (stacks === 0 || flight.bounces >= Math.min(2, stacks) || game.time - flight.lastBounce < 0.12) return;
    let best: { x: number; y: number } | null = null;
    let bestD = RICOCHET_RANGE;
    for (const enemy of game.enemies) {
      if (enemy.defeated || enemy.uid === hitUid) continue;
      const d = Math.hypot(enemy.body.x - x, enemy.body.y - y);
      if (d < bestD) {
        bestD = d;
        best = { x: enemy.body.x, y: enemy.body.y };
      }
    }
    if (!best) return;
    flight.bounces++;
    flight.lastBounce = game.time;
    const dx = best.x - object.body.x;
    const dy = best.y - object.body.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = flight.speed * (RICOCHET_SPEED[Math.min(3, stacks)] ?? 0.6);
    object.body.vx = (dx / len) * speed;
    object.body.vy = (dy / len) * speed;
    object.body.vz = Math.max(object.body.vz, 40);
    object.body.wake();
    game.fx.ring(x, y, 6, 34, 0.25, 'rgba(255,255,255,0.9)', 3);
    game.popup('RICOCHET!', x, y - 30, '#ffd23f', 20, 1.1);
  }

  /** A full-charge throw lands with a ring that staggers (never damages) everyone near it. */
  private shockwave(object: PhysicsObject, flight: Flight): void {
    const game = this.game;
    const stacks = game.edges.stacks('shockwave');
    if (stacks === 0 || flight.waved || flight.charge < SHOCKWAVE_MIN_CHARGE) return;
    flight.waved = true;
    const { x, y } = object.body;
    const radius = SHOCKWAVE_RADIUS + SHOCKWAVE_STEP * (stacks - 1);
    for (const enemy of game.enemies) {
      if (enemy.defeated) continue;
      const d = Math.hypot(enemy.body.x - x, enemy.body.y - y);
      if (d > radius + enemy.type.radius) continue;
      enemy.stun = Math.max(enemy.stun, 0.8 + 0.2 * stacks);
      enemy.squash = 1;
      const away = d > 1 ? 1 / d : 0;
      enemy.body.vx += (enemy.body.x - x) * away * 180;
      enemy.body.vy += (enemy.body.y - y) * away * 180;
    }
    game.fx.ring(x, y, 10, radius, 0.4, 'rgba(255,210,63,0.95)', 5);
    game.camera.addShake(0.25);
    game.audio.play('poof', 0.8);
  }

  /** Called every simulation tick: brings the first throw home when it has hit nothing. */
  update(): void {
    const object = this.returning;
    if (!object) return;
    const game = this.game;
    const flight = this.flights.get(object);
    if (!flight || flight.hit || !object.alive || game.edges.stacks('boomerang') === 0) {
      this.returning = null;
      this.homing = false;
      return;
    }
    if (!this.homing && game.time - flight.thrownAt >= BOOMERANG_AFTER) this.homing = true;
    if (!this.homing) return;
    const player = game.player;
    if (player.held) {
      // Hands full: it drops where it is and stays a normal object.
      this.returning = null;
      this.homing = false;
      return;
    }
    const dx = player.body.x - object.body.x;
    const dy = player.body.y - object.body.y;
    const d = Math.hypot(dx, dy);
    if (d < CATCH_DISTANCE) {
      player.catchObject(game, object);
      game.fx.ring(player.body.x, player.body.y, 6, 30, 0.25, 'rgba(255,255,255,0.9)', 3);
      this.returning = null;
      this.homing = false;
      return;
    }
    object.body.vx = (dx / d) * BOOMERANG_SPEED;
    object.body.vy = (dy / d) * BOOMERANG_SPEED;
    object.body.wake();
  }
}
