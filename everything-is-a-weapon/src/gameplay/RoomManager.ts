import { WALL } from '../core/constants';
import type { Game } from '../core/Game';
import { hashString } from '../core/Random';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { Layer, RigidBody } from '../physics/RigidBody';
import { SOURCE_LEVEL } from '../hazards/Electricity';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Enemy } from '../entities/Enemy';
import { CAMPAIGN_ROOMS, FINAL_ROOM_INDEX } from './Campaign';
import { doorPosition, type RoomDefinition, type RoomEnemySpec, type RoomTheme } from './Room';
import { ANCHOR_ROOMS, HANDCRAFTED_ROOMS } from './RoomDefinitions';
import { depthFor, generateRoom } from './RoomGenerator';
import { INCIDENT_WALK_LEAD, type IncidentSpec, type PendingEnemy } from './Incidents';

export interface RoomRuntime {
  readonly def: RoomDefinition;
  readonly index: number;
  readonly daily: boolean;
  /** Intruders that have not walked in yet, soonest first. */
  pending: PendingEnemy[];
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
  /** The incident's heavy footsteps have already played. */
  footsteps: boolean;
  /** 0..1 while the entrance door is being hammered on. */
  entranceRattle: number;
  /** A Headliner walks in this room. */
  hasBoss: boolean;
  /** Which Headliner walks in, when hasBoss is set. */
  bossType: RoomEnemySpec['type'] | null;
  /** The room's one incident, if it has one. */
  incidentSpec: IncidentSpec | null;
  incidentEnemy: Enemy | null;
  bossReleased: boolean;
  heatEnabled: boolean;
  hasEnforcer: boolean;
  /** Survival rooms: seconds to outlast (null: kill everything). */
  survive: number | null;
}

/**
 * The generated half of the campaign. The eight handcrafted bosses already
 * occupy rooms 2-9; these eleven unique bosses fill the late tour, and the
 * King of Cardboard waits behind the last door.
 */
const LATE_BOSS_SLOTS: readonly number[] = [11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41];
const LATE_BOSSES: ReadonlyArray<RoomEnemySpec['type']> = [
  'vacuumasaurus', 'hydra', 'fan', 'popcorn', 'cables',
  'cooker', 'train', 'junk', 'clock', 'toybox', 'dishwasher',
];

/** The boss in a room, if it has one. Handcrafted/final definitions win over the schedule. */
export function campaignBossType(index: number, def?: RoomDefinition): RoomEnemySpec['type'] | null {
  if (def?.boss) return def.boss;
  const slot = LATE_BOSS_SLOTS.indexOf(index);
  return slot >= 0 ? LATE_BOSSES[slot]! : null;
}

/** Every boss room in the campaign, in play order. Exactly one slot per boss. */
export function campaignBossSlots(): ReadonlyArray<{ type: RoomEnemySpec['type']; index: number }> {
  const slots: Array<{ type: RoomEnemySpec['type']; index: number }> = [];
  HANDCRAFTED_ROOMS.forEach((def, index) => {
    if (def.boss) slots.push({ type: def.boss, index });
  });
  LATE_BOSS_SLOTS.forEach((index, k) => slots.push({ type: LATE_BOSSES[k]!, index }));
  slots.push({ type: 'cardboard', index: FINAL_ROOM_INDEX });
  return slots;
}

/** Temporary adapter for the old tester wall; removed when the room wall shows the campaign. */
export function depthsBossSlots(): ReadonlyArray<{ type: RoomEnemySpec['type']; index: number }> {
  return campaignBossSlots().filter(({ index }) => index >= HANDCRAFTED_ROOMS.length);
}

/**
 * When the boss walks in: after the regular crew has arrived. Returns null for
 * non-boss rooms and the daily challenge.
 */
export function bossSpecFor(index: number, daily: boolean, def: RoomDefinition): RoomEnemySpec | null {
  if (daily) return null;
  const type = campaignBossType(index, def);
  if (!type) return null;
  const latest = def.enemies.reduce((max, spec) => Math.max(max, spec.delay), 0);
  return { type, delay: latest + 5 };
}

/** Campaign rooms cycle through every theme so the tour keeps changing shape. */
const CAMPAIGN_THEMES: readonly RoomTheme[] = [
  'living', 'kitchen', 'bathroom', 'bedroom', 'office', 'garage',
  'basement', 'garden', 'pool', 'jail', 'porch',
];

/** Resolves room indices to definitions and builds the physical room from data. */
export class RoomManager {
  private readonly generated = new Map<number, RoomDefinition>();

  get handcraftedCount(): number {
    return HANDCRAFTED_ROOMS.length;
  }

  get roomCount(): number {
    return CAMPAIGN_ROOMS;
  }

  definition(index: number): RoomDefinition {
    const campaignIndex = Math.max(0, Math.min(FINAL_ROOM_INDEX, Math.floor(index)));
    const handcrafted = HANDCRAFTED_ROOMS[campaignIndex];
    if (handcrafted) return handcrafted;
    // Pinned signature rooms punctuate the generated campaign floors.
    const anchor = ANCHOR_ROOMS[campaignIndex];
    if (anchor) return anchor;
    const cached = this.generated.get(campaignIndex);
    if (cached) return cached;

    // A stable seed means the 50-room campaign is the same tour every session.
    const seed = hashString(`bonk-campaign-room-${campaignIndex}`);
    const theme = campaignIndex === FINAL_ROOM_INDEX
      ? 'garage'
      : CAMPAIGN_THEMES[(campaignIndex - HANDCRAFTED_ROOMS.length) % CAMPAIGN_THEMES.length]!;
    let room = generateRoom(campaignIndex, seed, undefined, theme);
    if (campaignIndex === FINAL_ROOM_INDEX) {
      room = {
        ...room,
        id: 'final-49',
        name: 'THE LAST DOOR',
        boss: 'cardboard',
        objective: undefined,
        challenge: 'environment_only',
        teaser: 'the lease ends here',
      };
    }
    this.generated.set(campaignIndex, room);
    return room;
  }

  forgetGenerated(index: number): void {
    this.generated.delete(index);
  }

  build(
    game: Game,
    def: RoomDefinition,
    index: number,
    daily: boolean,
    incident: IncidentSpec | null = null,
  ): RoomRuntime {
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

    const pending: PendingEnemy[] = def.enemies.map((spec) => ({ type: spec.type, delay: spec.delay }));
    if (incident) pending.push({ type: incident.baseType, delay: Number.POSITIVE_INFINITY, incident });
    pending.sort((a, b) => a.delay - b.delay);

    return {
      def,
      index,
      daily,
      pending,
      elapsed: 0,
      totalEnemies: pending.length,
      cleared: false,
      clearTimer: 0,
      failTimer: 0,
      entranceOpen: 0,
      exitOpen: 0,
      knocked: false,
      footsteps: false,
      entranceRattle: 0,
      hasBoss: incident?.kind === 'headliner',
      bossType: incident?.baseType ?? null,
      incidentSpec: incident,
      incidentEnemy: null,
      bossReleased: false,
      heatEnabled: incident !== null || def.objective?.kind === 'survive',
      hasEnforcer: incident?.kind === 'enforcer',
      survive: def.objective?.kind === 'survive' ? def.objective.seconds : null,
    };
  }

  /** Brings in every intruder whose time has come. */
  updateSpawns(game: Game, room: RoomRuntime, dt: number): void {
    room.elapsed += dt;
    room.entranceOpen = Math.max(0, room.entranceOpen - dt * 0.9);
    room.entranceRattle = Math.max(0, room.entranceRattle - dt * 1.5);
    // Anticipation: whoever is next hammers on the door just before coming through it.
    const next = room.pending[0];
    // An incident takes the long way in: boots on the floor well before the knock.
    if (next?.incident && !room.footsteps && next.delay - room.elapsed < INCIDENT_WALK_LEAD) {
      room.footsteps = true;
      game.audio.play('bossWalk', 1);
    }
    if (next && !room.knocked && next.delay - room.elapsed < 0.75) {
      room.knocked = true;
      room.entranceRattle = 1;
      game.audio.play('knock', 1);
    }
    while (room.pending.length > 0 && room.pending[0]!.delay <= room.elapsed) {
      const spec = room.pending.shift()!;
      const door = doorPosition(room.def, room.def.entrance, 24);
      const lateral = game.rng.range(-14, 14);
      const x = door.x + door.dirY * lateral;
      const y = door.y + door.dirX * lateral;
      let enemy: Enemy;
      if (spec.incident?.kind === 'enforcer') {
        const base = ENEMY_TYPES[spec.type];
        const scaled = {
          ...base,
          name: spec.incident.name,
          hp: Math.round(base.hp * spec.incident.hpScale),
          speed: base.speed * spec.incident.speedScale,
        };
        enemy = game.spawnEnemyType(scaled, x, y, door.dirX, door.dirY);
      } else {
        enemy = game.spawnEnemy(spec.type, x, y, door.dirX, door.dirY);
        // Depths crew gets tougher with depth (Headliners stay exactly as designed).
        if (!spec.incident && room.index >= game.rooms.handcraftedCount) {
          const depth = depthFor(room.index);
          enemy.hp = Math.round(enemy.hp * Math.min(1.6, 1 + 0.07 * depth));
        }
      }
      if (spec.incident) {
        enemy.incident = spec.incident.kind;
        room.incidentEnemy = enemy;
        game.hud.incoming(spec.incident.kind.toUpperCase(), spec.incident.name, spec.incident.line, spec.type);
        game.audio.bossRoar(spec.type, enemy.type.voice);
        game.audio.setBossMusic(true);
        game.camera.addShake(spec.incident.kind === 'headliner' ? 0.5 : 0.3);
      }
      room.entranceOpen = 1;
      room.knocked = false;
      game.audio.play('door', 0.8);
      game.audio.voice('alert', enemy.type.voice, spec.type);
      game.particles.burst('dust', door.x, door.y, 10, 150, { dirX: door.dirX, dirY: door.dirY, spread: 0.9 });
      game.fx.ring(door.x, door.y, 8, 54, 0.3, 'rgba(255,255,255,0.7)', 3);
      game.camera.addShake(0.22);
      const bossType = ENEMY_TYPES[spec.type];
      if (!spec.incident && bossType.boss) {
        game.audio.bossRoar(spec.type, enemy.type.voice);
        game.audio.setBossMusic(true);
        game.hud.banner(bossType.bossBanner ?? bossType.name.toUpperCase(), '', 2.4);
        game.camera.addShake(0.5);
      }
    }
  }
}
