import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';

/**
 * Development-only scripting surface (`window.__t`) for driving the game without a human:
 * it feeds the same RawInput the keyboard/mouse adapter writes to, then advances fixed steps.
 * Used for automated play-testing; never bundled in production.
 */
export function installTestHooks(game: Game): void {
  const raw = game.input.raw;
  const point = { x: 0, y: 0 };
  const render = (): void => (game as unknown as { frame(alpha: number, dt: number): void }).frame(1, 1 / 60);

  const t = {
    step(ticks = 1): void {
      game.stepManually(ticks);
      render();
    },
    aim(x: number, y: number): void {
      game.camera.worldToScreen(x, y, point);
      raw.pointerX = point.x;
      raw.pointerY = point.y;
    },
    press(): void {
      raw.primaryDown = true;
      raw.primaryPresses++;
    },
    release(): void {
      raw.primaryDown = false;
      raw.primaryReleases++;
    },
    drop(): void {
      raw.secondaryPresses++;
      t.step(1);
    },
    dodge(): void {
      raw.dodgePresses++;
    },
    walkTo(x: number, y: number, maxTicks = 900, tolerance = 8): number {
      const body = game.player.body;
      let n = 0;
      for (; n < maxTicks; n++) {
        const dx = x - body.x;
        const dy = y - body.y;
        const d = Math.hypot(dx, dy);
        if (d < tolerance) break;
        raw.moveX = dx / d;
        raw.moveY = dy / d;
        game.stepManually(1);
      }
      raw.moveX = raw.moveY = 0;
      render();
      return n;
    },
    object(id: string): PhysicsObject | undefined {
      return game.objects.find((o) => o.def.id === id && o.alive && !o.held);
    },
    /** Walks next to an object and grabs it. */
    fetch(id: string): boolean {
      const object = t.object(id);
      if (!object) return false;
      const b = object.body;
      const p = game.player.body;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const stand = b.boundR + 34;
      t.walkTo(b.x + (dx / d) * stand, b.y + (dy / d) * stand, 900, 10);
      t.aim(b.x, b.y - b.z);
      t.step(2);
      t.press();
      t.step(1);
      t.release();
      t.step(2);
      return game.player.held === object;
    },
    throwAt(x: number, y: number, chargeTicks = 90): void {
      t.aim(x, y);
      t.step(3);
      t.press();
      t.step(chargeTicks);
      t.release();
      t.step(1);
    },
    /** Crude auto-player: grab the nearest throwable, throw it at the nearest intruder, repeat. */
    bot(maxSeconds: number): number {
      const end = game.time + maxSeconds;
      let throws = 0;
      for (let guard = 0; game.state === 'playing' && game.time < end && guard < 4000; guard++) {
        const p = game.player.body;
        const near = (x: number, y: number): number => Math.hypot(x - p.x, y - p.y);
        const enemy = game.enemies
          .filter((e) => !e.defeated)
          .sort((a, b) => near(a.body.x, a.body.y) - near(b.body.x, b.body.y))[0];
        if (!enemy) {
          t.step(30);
          continue;
        }
        if (!game.player.held) {
          const candidates = game.objects
            .filter((o) => o.alive && o.def.throwable && !o.burning)
            .sort((a, b) => near(a.body.x, a.body.y) - near(b.body.x, b.body.y));
          const object = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * 2))];
          if (!object) {
            t.step(30);
            continue;
          }
          const b = object.body;
          const d = near(b.x, b.y) || 1;
          const stand = b.boundR + 32;
          t.walkTo(b.x + ((p.x - b.x) / d) * stand, b.y + ((p.y - b.y) / d) * stand, 200, 10);
          t.aim(b.x, b.y - b.z);
          t.step(2);
          t.press();
          t.step(1);
          t.release();
          t.step(2);
          if (!game.player.held) {
            t.step(10);
            continue;
          }
        }
        t.throwAt(enemy.body.x + enemy.body.vx * 0.2, enemy.body.y + enemy.body.vy * 0.2, 50);
        throws++;
        t.step(30);
      }
      return throws;
    },
    info(): object {
      return {
        time: +game.time.toFixed(2),
        state: game.state,
        room: game.room.index + 1,
        hp: game.player.hp,
        score: game.score.score,
        combo: game.score.combo,
        held: game.player.held?.def.id ?? null,
        pending: game.room.pending.length,
        enemies: game.enemies.map((e) => ({
          type: e.type.id, hp: +e.hp.toFixed(1), ai: e.ai, defeated: e.defeated,
          x: Math.round(e.body.x), y: Math.round(e.body.y),
        })),
        zones: game.zones.zones.map((z) => `${z.zone}${z.energized ? '*' : ''}@${Math.round(z.x)},${Math.round(z.y)} r${Math.round(z.r)}`),
        discoveries: game.save.data.discoveries.length,
      };
    },
  };

  const log: object[] = [];
  game.bus.on('ENEMY_HIT', (e) =>
    log.push({ t: +game.time.toFixed(2), ev: 'hit', enemy: e.enemy.type.id, dmg: +e.damage.toFixed(1), cause: e.cause.type, by: e.cause.label, chain: e.cause.chain?.steps.join('>') ?? '' }),
  );
  game.bus.on('ENEMY_DEFEATED', (e) => log.push({ t: +game.time.toFixed(2), ev: 'defeated', enemy: e.enemy.type.id, cause: e.cause.type, by: e.cause.label }));
  game.bus.on('OBJECT_BROKEN', (e) => log.push({ t: +game.time.toFixed(2), ev: 'broken', object: e.object.def.id }));
  game.bus.on('OBJECT_FALLEN', (e) => log.push({ t: +game.time.toFixed(2), ev: 'fallen', object: e.object.def.id }));
  game.bus.on('DISCOVERY', (e) => log.push({ t: +game.time.toFixed(2), ev: 'discovery', id: e.id }));
  game.bus.on('EXPLOSION', () => log.push({ t: +game.time.toFixed(2), ev: 'explosion' }));
  game.bus.on('PLAYER_HIT', (e) => log.push({ t: +game.time.toFixed(2), ev: 'player_hit', by: e.cause }));

  const w = window as unknown as { __t: typeof t; __log: object[] };
  w.__t = t;
  w.__log = log;
}
