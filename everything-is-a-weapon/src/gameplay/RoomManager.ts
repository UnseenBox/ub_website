import { WALL } from '../core/constants';
import type { Game } from '../core/Game';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { Layer, RigidBody } from '../physics/RigidBody';
import { SOURCE_LEVEL } from '../hazards/Electricity';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { doorPosition, type RoomDefinition, type RoomEnemySpec, type WallSpec } from './Room';
import { HANDCRAFTED_ROOMS } from './RoomDefinitions';
import { generateRoom } from './RoomGenerator';

/** A live interior wall: static partition, or sliding machinery (kinematic). */
export interface WallRuntime {
  readonly spec: WallSpec;
  readonly body: RigidBody;
  x: number;
  y: number;
  hw: number;
  hh: number;
  /** Seconds since the room started (drives sliding walls). */
  t: number;
}

export interface RoomRuntime {
  readonly def: RoomDefinition;
  readonly index: number;
  readonly daily: boolean;
  /** Intruders that have not walked in yet, soonest first. */
  pending: RoomEnemySpec[];
  elapsed: number;
  totalEnemies: number;
  cleared: boolean;
  clearTimer: number;
  failTimer: number;
  /** 0..1 door animation values. */
  entranceOpen: number;
  exitOpen: number;
  /** The next intruder has already knocked. */
  knocked: boolean;
  /** 0..1 while the entrance door is being hammered on. */
  entranceRattle: number;
  /** A Landlord walks in this room (every third room). */
  hasBoss: boolean;
  /** Which boss walks in, when hasBoss is set. */
  bossType: RoomEnemySpec['type'] | null;
}

/**
 * Every third room ends with the Landlord himself, a while after the regular
 * crew has arrived. Returns null for other rooms and the daily challenge.
 */
/** The generated depths rotate through the full boss roster every third room. */
const DEPTH_BOSSES: ReadonlyArray<RoomEnemySpec['type']> = [
  'chairman', 'flusher', 'kraken', 'fridgezilla', 'piano', 'mower',
  'vacuumasaurus', 'hydra', 'fan', 'popcorn', 'cables', 'cooker', 'train',
  'junk', 'house', 'clock', 'toybox', 'dishwasher', 'cardboard',
];

export function bossSpecFor(index: number, daily: boolean, def: RoomDefinition): RoomEnemySpec | null {
  if (daily || (index + 1) % 3 !== 0) return null;
  const latest = def.enemies.reduce((max, spec) => Math.max(max, spec.delay), 0);
  const type = DEPTH_BOSSES[Math.floor(index / 3) % DEPTH_BOSSES.length]!;
  return { type, delay: latest + 5 };
}

/** Resolves room indices to definitions and builds the physical room from data. */
export class RoomManager {
  private readonly generatedSeeds = new Map<number, number>();

  get handcraftedCount(): number {
    return HANDCRAFTED_ROOMS.length;
  }

  definition(index: number): RoomDefinition {
    const handcrafted = HANDCRAFTED_ROOMS[index];
    if (handcrafted) return handcrafted;
    // A generated room keeps its seed for the session, so Retry gives the same layout.
    let seed = this.generatedSeeds.get(index);
    if (seed === undefined) {
      seed = Math.floor(Math.random() * 0xffffffff);
      this.generatedSeeds.set(index, seed);
    }
    return generateRoom(index, seed);
  }

  forgetGenerated(index: number): void {
    this.generatedSeeds.delete(index);
  }

  build(game: Game, def: RoomDefinition, index: number, daily: boolean): RoomRuntime {
    const world = game.world;
    world.clear();
    world.setBounds({ x0: 0, y0: 0, x1: def.width, y1: def.height }, WALL);

    const wall = (x: number, y: number, hw: number, hh: number): void => {
      world.add(
        new RigidBody({ type: 'static', shape: { kind: 'box', hw, hh }, x, y, layer: Layer.Wall, friction: 0.4, restitution: 0.1 }),
      );
    };
    const half = WALL / 2;
    wall(def.width / 2, -half, def.width / 2 + WALL, half);
    wall(def.width / 2, def.height + half, def.width / 2 + WALL, half);
    wall(-half, def.height / 2, half, def.height / 2 + WALL);
    wall(def.width + half, def.height / 2, half, def.height / 2 + WALL);

    game.nav.resize(def.width, def.height);
    game.camera.setRoom(def.width, def.height);

    const spawned: Array<PhysicsObject | null> = [];
    for (const spec of def.objects) {
      spawned.push(game.spawnObject(spec.type, spec.x, spec.y, spec.angle ?? 0));
    }
    def.objects.forEach((spec, i) => {
      if (spec.on === undefined) return;
      const item = spawned[i];
      const surface = spawned[spec.on];
      if (item && surface && surface.def.surface) item.placeOn(surface);
    });

    for (const zone of def.zones) {
      game.zones.spawn(game, zone.kind, zone.x, zone.y, zone.r, {
        level: zone.kind === 'electric' ? SOURCE_LEVEL : 0,
        extraTags: zone.outlet ? ['outlet'] : undefined,
      });
    }

    game.player.body.teleport(def.playerStart.x, def.playerStart.y);
    world.add(game.player.body);

    // Interior partitions: static colliders, or sliding machinery on a kinematic body.
    game.walls.length = 0;
    for (const spec of def.walls ?? []) {
      const sliding = spec.slide !== undefined;
      const body = new RigidBody({
        type: sliding ? 'kinematic' : 'static',
        shape: { kind: 'box', hw: spec.hw, hh: spec.hh },
        x: spec.x,
        y: spec.y,
        layer: Layer.Wall,
        friction: 0.4,
        restitution: 0.1,
      });
      world.add(body);
      game.walls.push({ spec, body, x: spec.x, y: spec.y, hw: spec.hw, hh: spec.hh, t: 0 });
    }

    return {
      def,
      index,
      daily,
      pending: [...def.enemies].sort((a, b) => a.delay - b.delay),
      elapsed: 0,
      totalEnemies: def.enemies.length,
      cleared: false,
      clearTimer: 0,
      failTimer: 0,
      entranceOpen: 0,
      exitOpen: 0,
      knocked: false,
      entranceRattle: 0,
      hasBoss: false,
      bossType: null,
    };
  }

  /**
   * Advances sliding walls. Runs before the physics step: the kinematic body is
   * velocity-driven so it shoves dynamics aside, while the analytic position
   * (what navigation and rendering read) never drifts.
   */
  updateWalls(game: Game, dt: number): void {
    for (const wall of game.walls) {
      const slide = wall.spec.slide;
      if (!slide) continue;
      wall.t += dt;
      const phase = (wall.t / slide.period) * Math.PI * 2;
      const offset = Math.sin(phase) * slide.range;
      const speed = Math.cos(phase) * ((Math.PI * 2 * slide.range) / slide.period);
      if (slide.axis === 'x') {
        wall.x = wall.spec.x + offset;
        wall.body.vx = speed;
        wall.body.vy = 0;
        if (Math.abs(wall.body.x - wall.x) > 3) {
          wall.body.teleport(wall.x, wall.body.y, wall.body.angle);
          wall.body.vx = speed;
        }
      } else {
        wall.y = wall.spec.y + offset;
        wall.body.vx = 0;
        wall.body.vy = speed;
        if (Math.abs(wall.body.y - wall.y) > 3) {
          wall.body.teleport(wall.body.x, wall.y, wall.body.angle);
          wall.body.vy = speed;
        }
      }
    }
  }

  /** Brings in every intruder whose time has come. */
  updateSpawns(game: Game, room: RoomRuntime, dt: number): void {
    room.elapsed += dt;
    room.entranceOpen = Math.max(0, room.entranceOpen - dt * 0.9);
    room.entranceRattle = Math.max(0, room.entranceRattle - dt * 1.5);
    // Anticipation: whoever is next hammers on the door just before coming through it.
    const next = room.pending[0];
    if (next && !room.knocked && next.delay - room.elapsed < 0.75) {
      room.knocked = true;
      room.entranceRattle = 1;
      game.audio.play('knock', 1);
    }
    while (room.pending.length > 0 && room.pending[0]!.delay <= room.elapsed) {
      const spec = room.pending.shift()!;
      const door = doorPosition(room.def, room.def.entrance, 24);
      const lateral = game.rng.range(-14, 14);
      const enemy = game.spawnEnemy(spec.type, door.x + door.dirY * lateral, door.y + door.dirX * lateral, door.dirX, door.dirY);
      room.entranceOpen = 1;
      room.knocked = false;
      game.audio.play('door', 0.8);
      game.audio.voice('alert', enemy.type.voice);
      game.particles.burst('dust', door.x, door.y, 10, 150, { dirX: door.dirX, dirY: door.dirY, spread: 0.9 });
      game.fx.ring(door.x, door.y, 8, 54, 0.3, 'rgba(255,255,255,0.7)', 3);
      game.camera.addShake(0.22);
      const bossType = ENEMY_TYPES[spec.type];
      if (bossType.boss) {
        game.hud.banner(bossType.bossBanner ?? bossType.name.toUpperCase(), bossType.bossBlurb ?? '', 2.8);
        game.camera.addShake(0.5);
      }
    }
  }
}
