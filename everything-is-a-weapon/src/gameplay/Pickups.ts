import { bubblePop, patchUp, rageEnd, rageShout, rageStart, snoozeChime, tinOpen } from '../audio/CompanionSounds';
import type { Game } from '../core/Game';
import type { Enemy } from '../entities/Enemy';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { doorPosition, type RoomTheme } from './Room';

/** How long a ghost pepper lasts. */
export const RAGE_SECONDS = 60;
/** What rage does to the hero's numbers (read by entities/Player.ts). */
export const RAGE_SPEED = 1.3;
export const RAGE_THROW = 1.3;
export const RAGE_CHARGE = 2.4;
/** Hits a roll of bubble wrap soaks up. */
export const ARMOR_HITS = 2;
const SNOOZE_SECONDS = 5;

const RAM_DAMAGE = 9;
const RAM_EVERY = 0.6;
const SHOUTS = ['GET OUT!', 'MY FLAT!', 'RAAAGH!', 'I PAY RENT HERE!', 'NOT THE SOFA!', 'IT IS 3 A.M.!', 'OUT! OUT! OUT!'] as const;

/** What each pet's owner says when the treat comes out. */
const TREAT_BANNERS: Readonly<Record<string, readonly [string, string]>> = {
  tuna: ['DINNER TIME', 'the cat is not hiding any more'],
  bone: ['FETCH', 'the dog has found an ankle'],
  cracker: ['POLLY WANTS A WORD', 'the parrot is coming in low'],
  seeds: ['BOWLING NIGHT', 'the hamster ball has got bigger'],
};

/** Extra throwables scattered in each kind of room, on top of what the room data places. */
const THEME_EXTRAS: Readonly<Record<RoomTheme, readonly string[]>> = {
  bedroom: ['piggybank', 'globe', 'guitar', 'lavalamp', 'trophy', 'cactus'],
  office: ['cactus', 'globe', 'trophy', 'pizza', 'kettle', 'dumbbell'],
  bathroom: ['cactus', 'lavalamp', 'piggybank', 'dumbbell'],
  living: ['guitar', 'lavalamp', 'pizza', 'trophy', 'cactus', 'globe', 'piggybank'],
  kitchen: ['kettle', 'syrup', 'pizza', 'cactus', 'syrup'],
  garage: ['dumbbell', 'guitar', 'trophy', 'pizza', 'kettle'],
};
const BONUS_PICKUPS = ['plasters', 'bubblewrap', 'snooze'] as const;

const rammed = new WeakMap<Enemy, number>();
let steamTimer = 0;
let shoutTimer = 0;

/**
 * Called when the hero's hand closes on something. Returns true if it was used up there
 * and then instead of being picked up.
 */
export function consumePickup(game: Game, object: PhysicsObject): boolean {
  const kind = object.def.consume;
  const b = object.body;
  const player = game.player;
  const pb = player.body;
  switch (kind) {
    case 'rage':
      player.rage = RAGE_SECONDS;
      steamTimer = 0;
      shoutTimer = 2.5;
      rageStart(game.audio);
      game.fx.burst('RAAAGH!', pb.x, pb.y - 62, 1.5, '#ff5a4e', true);
      game.fx.flash('#ff3b2f', 0.45);
      game.fx.ring(pb.x, pb.y, 10, 150, 0.5, 'rgba(255,90,78,0.95)', 6);
      game.particles.burst('ember', pb.x, pb.y - 30, 26, 380);
      game.particles.burst('steam', pb.x, pb.y - 44, 12, 200);
      game.camera.addShake(0.7);
      game.camera.punchZoom(0.05);
      game.hitStop(0.12);
      game.hud.banner('SEEING RED', 'rage: 60s', 2);
      game.discoveries.unlock('hot_head');
      break;

    case 'treat': {
      const pet = game.pet;
      // somebody else's pet food: just a thing to throw
      if (!pet || pet.treat !== object.def.id) return false;
      tinOpen(game.audio);
      game.particles.burst('star', b.x, b.y - 8, 6, 160);
      pet.feed(game);
      game.camera.addShake(0.3);
      const words = TREAT_BANNERS[object.def.id];
      if (words) game.hud.banner(words[0], words[1], 2);
      break;
    }

    case 'heal':
      if (player.hp >= player.maxHp) {
        game.popup('not hurt', b.x, b.y - 24, '#fff3d6', 13, 0.8);
        return false;
      }
      player.hp = Math.min(player.maxHp, player.hp + 2);
      patchUp(game.audio);
      game.fx.burst('+2', pb.x, pb.y - 60, 1, '#9be564');
      game.fx.ring(pb.x, pb.y, 8, 70, 0.4, 'rgba(155,229,100,0.9)', 4);
      game.particles.burst('confetti', pb.x, pb.y - 30, 12, 200, { color: '#9be564' });
      break;

    case 'armor':
      player.armor = ARMOR_HITS;
      bubblePop(game.audio, 0.8);
      game.fx.burst('WRAPPED!', pb.x, pb.y - 60, 0.95, '#bfe9ff');
      game.fx.ring(pb.x, pb.y, 8, 60, 0.35, 'rgba(191,233,255,0.95)', 4);
      game.particles.burst('bubble', pb.x, pb.y - 24, 12, 160);
      game.discoveries.unlock('bubble_wrapped');
      break;

    case 'snooze': {
      let frozen = 0;
      for (const enemy of game.enemies) {
        if (enemy.defeated) continue;
        enemy.stun = Math.max(enemy.stun, SNOOZE_SECONDS);
        enemy.squash = 0.6;
        game.popup('z z z', enemy.body.x, enemy.body.y - 52, '#c9b6ff', 16, 2.2);
        frozen++;
      }
      snoozeChime(game.audio);
      game.fx.flash('#c9b6ff', 0.3);
      game.fx.burst('SNOOZE!', pb.x, pb.y - 62, 1.2, '#c9b6ff', true);
      game.hud.banner('FIVE MORE MINUTES', frozen > 0 ? 'all movers snooze' : '', 2);
      if (frozen > 0) game.discoveries.unlock('snoozed');
      break;
    }

    default:
      return false;
  }
  object.alive = false;
  game.analytics.track('object_grab', { object: object.def.id });
  return true;
}

/** Bubble wrap takes the hit instead. Returns true if there was any left to take it. */
export function absorbHit(game: Game): boolean {
  const player = game.player;
  if (player.armor <= 0) return false;
  player.armor--;
  player.invulnerable = 0.7;
  bubblePop(game.audio, 1);
  game.fx.burst('POP!', player.body.x, player.body.y - 58, 0.95, '#bfe9ff');
  game.particles.burst('bubble', player.body.x, player.body.y - 24, 14, 220);
  game.camera.addShake(0.2);
  return true;
}

/** A clear bit of floor, away from the hero's feet and the door the movers come through. */
function freeSpot(game: Game, out: { x: number; y: number }): boolean {
  const def = game.room.def;
  const door = doorPosition(def, def.entrance, 24);
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = game.rng.range(60, def.width - 60);
    const y = game.rng.range(70, def.height - 50);
    if (Math.hypot(x - def.playerStart.x, y - def.playerStart.y) < 130) continue;
    if (Math.hypot(x - door.x, y - door.y) < 150) continue;
    let clear = true;
    game.world.queryCircle(x, y, 26, () => (clear = false));
    if (!clear) continue;
    out.x = x;
    out.y = y;
    return true;
  }
  return false;
}

/**
 * Drops this room's pickups and a couple of extra throwables. Uses the room's own seeded
 * RNG, so a retry finds them in the same places. The first room is left alone: it is the
 * tutorial and the menu backdrop.
 */
export function placePickups(game: Game): void {
  const room = game.room;
  if (room.def.tutorial || (room.index === 0 && !room.daily)) return;
  const rng = game.rng;
  const spot = { x: 0, y: 0 };
  const drop = (id: string): void => {
    if (freeSpot(game, spot)) game.spawnObject(id, spot.x, spot.y, rng.range(0, Math.PI * 2));
  };

  // Always in the second room, so everyone meets it once; a coin toss after that.
  if (room.index === 1 || rng.next() < 0.5) drop('chili');
  const pet = game.pet;
  if (pet) {
    const treats = room.index >= 6 || room.daily ? 2 : 1;
    for (let i = 0; i < treats; i++) drop(pet.treat);
  }
  if (room.index >= 2 && rng.next() < 0.6) drop(rng.pick(BONUS_PICKUPS));

  const extras = room.def.theme ? THEME_EXTRAS[room.def.theme] : THEME_EXTRAS.living;
  const count = room.index >= 5 ? 3 : 2;
  for (let i = 0; i < count; i++) drop(rng.pick(extras));
}

/** Per fixed step while the hero is alive: steam, shouting, shoulder-barging, and the comedown. */
export function updateRage(game: Game, dt: number): void {
  const player = game.player;
  if (player.rage <= 0) return;
  const pb = player.body;
  if (!player.alive) {
    player.rage = 0;
    return;
  }
  player.rage -= dt;
  if (player.rage <= 0) {
    player.rage = 0;
    rageEnd(game.audio);
    game.particles.burst('steam', pb.x, pb.y - 40, 16, 150);
    game.popup('...phew', pb.x, pb.y - 62, '#fff3d6', 16, 1.4);
    return;
  }

  // steam out of both ears
  steamTimer -= dt;
  if (steamTimer <= 0) {
    steamTimer = 0.09;
    for (const side of [-1, 1]) {
      game.particles.burst('steam', pb.x + side * 13, pb.y - 40, 1, 70, { dirX: side, dirY: -0.5, spread: 0.5 });
    }
  }

  shoutTimer -= dt;
  if (shoutTimer <= 0) {
    shoutTimer = 3.2 + Math.random() * 3;
    rageShout(game.audio);
    game.popup(SHOUTS[Math.floor(Math.random() * SHOUTS.length)]!, pb.x, pb.y - 66, '#ff8b7a', 18, 1.1);
  }

  // Walking into a mover is an attack now.
  const speed = pb.speed();
  if (speed < 90) return;
  for (const enemy of game.enemies) {
    if (enemy.defeated) continue;
    const dx = enemy.body.x - pb.x;
    const dy = enemy.body.y - pb.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > enemy.type.radius + pb.boundR + 7) continue;
    if (game.time - (rammed.get(enemy) ?? -9) < RAM_EVERY) continue;
    rammed.set(enemy, game.time);
    enemy.stun = Math.max(enemy.stun, 0.5 * enemy.type.staggerFactor);
    enemy.squash = 1;
    enemy.body.vx += (dx / d) * 420 * enemy.type.staggerFactor;
    enemy.body.vy += (dy / d) * 420 * enemy.type.staggerFactor;
    game.audio.impact('soft', 0.9, 30);
    game.fx.burst('RAM!', enemy.body.x, enemy.body.y - 40, 0.85, '#ff5a4e', true);
    enemy.damage(game, RAM_DAMAGE, { type: 'impact', source: player, chain: null, label: 'SHOULDER', dirX: dx / d, dirY: dy / d });
    if (enemy.defeated) game.discoveries.unlock('road_rage');
  }
}
