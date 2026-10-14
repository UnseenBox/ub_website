import type { Game } from '../core/Game';
import { angleDiff } from '../core/math';
import { freshChain } from '../gameplay/Chain';
import type { BehaviorSpec } from '../objects/ObjectDefinitions';
import type { Enemy } from './Enemy';
import type { PhysicsObject } from './PhysicsObject';

type SpecOf<K extends BehaviorSpec['kind']> = Extract<BehaviorSpec, { kind: K }>;

const SEEK_RANGE = 460;
const CATCH_DISTANCE = 34;

/** Drives at a steady speed along a heading, the way a wheeled or wound-up thing does. */
function drive(o: PhysicsObject, dirX: number, dirY: number, speed: number, dt: number): void {
  const b = o.body;
  const k = Math.min(1, 30 * dt);
  b.vx += (dirX * speed - b.vx) * k;
  b.vy += (dirY * speed - b.vy) * k;
  b.w = angleDiff(b.angle, Math.atan2(dirY, dirX)) * 7;
  b.wake();
}

/** Out of the player's hands, on the floor, in one piece and not already going somewhere fast. */
function freeToMove(o: PhysicsObject, topSpeed: number): boolean {
  const b = o.body;
  return !o.held && !o.restingOn && o.structural !== 'broken' && o.rocketLeft <= 0 && b.z <= 0.5 && b.speed() < topSpeed * 3;
}

function wander(game: Game, o: PhysicsObject, spec: SpecOf<'wander'>, dt: number): void {
  if (!freeToMove(o, spec.speed)) {
    o.stall = 0;
    return;
  }
  const b = o.body;
  o.motorTimer -= dt;
  o.stall = b.speed() < spec.speed * 0.4 ? o.stall + dt : 0;
  const blocked = o.stall > 0.4;
  if (o.motorTimer <= 0 || blocked) {
    // Bumped into something: turn well away from it. Otherwise just drift onto a new line.
    const turn = blocked ? Math.PI * game.rng.range(0.55, 1.45) : game.rng.range(-1, 1);
    const heading = Math.atan2(o.motorY, o.motorX || 1) + turn;
    o.motorX = Math.cos(heading);
    o.motorY = Math.sin(heading);
    o.motorTimer = game.rng.range(1.8, 3.6);
    o.stall = 0;
  }
  drive(o, o.motorX, o.motorY, spec.speed, dt);
}

function nearestEnemy(game: Game, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range;
  for (const enemy of game.enemies) {
    if (enemy.defeated) continue;
    const d = Math.hypot(enemy.body.x - x, enemy.body.y - y);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best;
}

function seek(game: Game, o: PhysicsObject, spec: SpecOf<'seek'>, dt: number): void {
  if (o.active <= 0) return;
  if (o.held) {
    // Picking them up again stops the clockwork.
    o.active = 0;
    return;
  }
  o.biteTimer -= dt;
  const b = o.body;
  if (!freeToMove(o, spec.speed)) return;
  o.active -= dt;
  const target = nearestEnemy(game, b.x, b.y, SEEK_RANGE);
  if (!target) {
    // Nobody to chase: chatter round in a circle.
    const a = b.angle + 2.4 * dt;
    drive(o, Math.cos(a), Math.sin(a), spec.speed * 0.5, dt);
    return;
  }
  const dx = target.body.x - b.x;
  const dy = target.body.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  drive(o, dx / d, dy / d, spec.speed, dt);
  if (d > target.type.radius + b.boundR + 7 || o.biteTimer > 0) return;

  o.biteTimer = spec.every;
  o.squash = 1;
  o.chainAt = game.time;
  target.slowTimer = Math.max(target.slowTimer, 0.5);
  target.slowFactor = 0.55;
  game.audio.play('chomp', 1);
  game.fx.burst('CHOMP!', b.x, b.y - 26, 0.7, '#fbf6e9');
  target.damage(game, spec.bite, {
    type: 'impact', source: o, chain: freshChain(o, game.time), label: o.label, dirX: dx / d, dirY: dy / d,
  });
  if (spec.discovery) game.discoveries.unlock(spec.discovery);
}

function boomerang(game: Game, o: PhysicsObject, spec: SpecOf<'boomerang'>, dt: number): void {
  if (o.active <= 0) return;
  if (o.held || !o.alive) {
    o.active = 0;
    return;
  }
  const b = o.body;
  o.active -= dt;
  const age = spec.seconds - o.active;
  // It stays in the air for the whole trip, spinning.
  b.z = Math.max(b.z, 12);
  b.vz = 0;
  b.w = 17;
  b.wake();
  o.chainAt = game.time;
  if (age < 0.3) return;

  const player = game.player;
  const dx = player.body.x - b.x;
  const dy = player.body.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = Math.max(520, b.speed());
  const k = Math.min(1, 4.6 * dt);
  b.vx += ((dx / d) * speed - b.vx) * k;
  b.vy += ((dy / d) * speed - b.vy) * k;

  if (d < CATCH_DISTANCE) {
    o.active = 0;
    if (player.alive && !player.held) {
      player.catchObject(game, o);
      game.fx.burst('CAUGHT!', player.body.x, player.body.y - 54, 0.8, '#9be564');
      if (spec.discovery) game.discoveries.unlock(spec.discovery);
    }
  }
}

function flop(game: Game, o: PhysicsObject, _spec: SpecOf<'flop'>, dt: number): void {
  if (o.active <= 0 || o.held) return;
  const b = o.body;
  o.active -= dt;
  o.motorTimer -= dt;
  if (b.z > 0 || o.motorTimer > 0 || o.restingOn) return;
  o.motorTimer = game.rng.range(0.3, 0.7);
  const a = game.rng.range(0, Math.PI * 2);
  const hop = game.rng.range(70, 150);
  b.vx += Math.cos(a) * hop;
  b.vy += Math.sin(a) * hop;
  b.z = 1;
  b.vz = game.rng.range(130, 200);
  b.w += game.rng.range(-10, 10);
  b.wake();
}

function trap(game: Game, o: PhysicsObject, spec: SpecOf<'trap'>, dt: number): void {
  const b = o.body;
  if (o.held) {
    // Picking it up resets it; it sets again once it has been put down.
    o.sprung = false;
    o.armTimer = 0;
    o.tags.delete('armed');
    return;
  }
  if (o.sprung) {
    if (spec.rearm <= 0) return;
    o.armTimer += dt;
    if (o.armTimer >= spec.rearm) {
      o.sprung = false;
      o.armTimer = 0;
    }
    return;
  }
  const still = b.z <= 0 && b.speed() < 25 && !o.restingOn && !o.burning;
  if (o.tags.has('armed')) {
    if (!still && (b.z > 0 || b.speed() > 140)) o.tags.delete('armed');
    return;
  }
  o.armTimer = still ? o.armTimer + dt : 0;
  if (o.armTimer < 0.45) return;
  o.armTimer = 0;
  o.tags.add('armed');
  if (game.time > 1) game.audio.play('click', 0.5);
}

/** Runs whatever an object does of its own accord. Called once per fixed step. */
export function updateBehavior(game: Game, o: PhysicsObject, spec: BehaviorSpec, dt: number): void {
  switch (spec.kind) {
    case 'wander':
      wander(game, o, spec, dt);
      break;
    case 'seek':
      seek(game, o, spec, dt);
      break;
    case 'boomerang':
      boomerang(game, o, spec, dt);
      break;
    case 'flop':
      flop(game, o, spec, dt);
      break;
    case 'trap':
      trap(game, o, spec, dt);
      break;
  }
}
