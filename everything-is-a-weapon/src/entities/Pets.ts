import { bark, hamsterSqueak, squawk } from '../audio/PetVoices';
import type { Game } from '../core/Game';
import type { HeroId } from '../core/Hero';
import { Cat, FRENZY_SECONDS, heightAt } from './Cat';
import type { Enemy } from './Enemy';

export type Species = 'cat' | 'dog' | 'parrot' | 'hamster';

/**
 * Shared legs for the pets that came after the cat. Like the cat, none of them is a physics
 * body: nothing can hit them, they walk over the furniture, and what they do to the movers
 * they do by calling the same methods a thrown shoe would.
 */
abstract class Critter {
  readonly kind = 'pet' as const;
  abstract readonly species: Species;
  /** Object id of the pickup that sets it off, and the word shown on its countdown. */
  abstract readonly treat: string;
  abstract readonly treatLabel: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  z = 0;
  prevZ = 0;
  vx = 0;
  vy = 0;
  protected vz = 0;
  facing = 1;
  walkPhase = 0;
  frenzy = 0;
  idle = 0;
  sitting = false;
  /** True while it is attached to a mover rather than standing on the floor. */
  riding = false;
  state = 'follow';
  readonly seed = Math.random() * 100;
  protected target: Enemy | null = null;
  protected lastTarget: Enemy | null = null;
  protected timer = 0;

  constructor(x: number, y: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }

  get depth(): number {
    return this.y;
  }

  abstract update(game: Game, dt: number): void;
  abstract feed(game: Game): void;

  protected begin(dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = this.z;
    this.idle += dt;
  }

  protected threats(game: Game): number {
    let n = 0;
    for (const enemy of game.enemies) if (!enemy.defeated) n++;
    return n;
  }

  protected nearest(game: Game, range: number, skip: Enemy | null = null): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const enemy of game.enemies) {
      if (enemy.defeated || enemy === skip) continue;
      const d = Math.hypot(enemy.body.x - this.x, enemy.body.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    return best;
  }

  /** The next mover to go for: not the one it has just finished with, if there is a choice. */
  protected pickTarget(game: Game): Enemy | null {
    return this.nearest(game, Infinity, this.threats(game) > 1 ? this.lastTarget : null);
  }

  protected moveTo(tx: number, ty: number, speed: number, dt: number, grip = 14): number {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.min(speed, d * 9);
    const k = Math.min(1, grip * dt);
    this.vx += ((dx / d) * want - this.vx) * k;
    this.vy += ((dy / d) * want - this.vy) * k;
    return d;
  }

  protected brake(dt: number): void {
    this.vx *= Math.exp(-12 * dt);
    this.vy *= Math.exp(-12 * dt);
  }

  /** Moves, stays inside the walls and (for walkers) hops onto whatever is underfoot. */
  protected step(game: Game, dt: number, walks = true): void {
    if (!this.riding) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const def = game.room.def;
      this.x = Math.min(def.width - 14, Math.max(14, this.x));
      this.y = Math.min(def.height - 10, Math.max(20, this.y));
      if (walks) {
        const ground = heightAt(game, this.x, this.y);
        this.vz -= 1500 * dt;
        this.z += this.vz * dt;
        if (this.z <= ground) {
          this.z = ground - this.z > 3 && this.vz <= 0 ? this.z + (ground - this.z) * Math.min(1, 16 * dt) : ground;
          this.vz = Math.max(0, this.vz);
        }
      }
    }
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 12) {
      this.walkPhase += speed * dt * 0.11;
      if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;
      this.idle = 0;
    }
  }

  /** Trots along just behind the hero and sits when they stop. */
  protected heel(game: Game, dt: number, speed: number): void {
    const p = game.player;
    const pb = p.body;
    const side = (this.x - pb.x) * -p.aimY + (this.y - pb.y) * p.aimX >= 0 ? 1 : -1;
    const tx = pb.x - p.aimX * 30 - p.aimY * 18 * side;
    const ty = pb.y - p.aimY * 30 + p.aimX * 18 * side + 6;
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > (this.sitting ? 46 : 12)) {
      this.sitting = false;
      this.moveTo(tx, ty, speed, dt);
    } else {
      this.brake(dt);
      if (this.idle > 0.6) this.sitting = true;
      if (pb.x !== this.x) this.facing = pb.x > this.x ? 1 : -1;
    }
  }

  /** Counts the treat down. Returns true on the tick it runs out. */
  protected digest(dt: number): boolean {
    if (this.frenzy <= 0) return false;
    this.frenzy -= dt;
    if (this.frenzy > 0) return false;
    this.frenzy = 0;
    this.riding = false;
    this.target = null;
    return true;
  }

  protected startFrenzy(game: Game, word: string, color: string): void {
    this.frenzy = FRENZY_SECONDS;
    this.target = null;
    this.sitting = false;
    this.vz = 240;
    this.z = Math.max(this.z, 1);
    game.fx.burst(word, this.x, this.y - this.z - 30, 1.15, color, true);
    game.fx.ring(this.x, this.y, 6, 60, 0.35, 'rgba(255,255,255,0.9)', 4);
    game.particles.burst('star', this.x, this.y - this.z - 8, 10, 240);
  }
}

// ───────────────────────── the dog ─────────────────────────

const DOG_BITE_SECONDS = 2.3;
const DOG_BITE_EVERY = 0.4;
const DOG_BITE_DAMAGE = 7;

/**
 * WAFFLE — the tenant's sausage dog. All bark: it stands behind its owner and shouts at the
 * movers, which now and then makes one of them come over to see what the noise is about.
 * Give it a bone and it finds an ankle and does not let go.
 */
export class Dog extends Critter {
  readonly species = 'dog' as const;
  readonly treat = 'bone';
  readonly treatLabel = 'BONE';
  /** 0..1 just after a bark: the mouth is open and the body jumps. */
  barking = 0;
  private barkTimer = 1.2;
  private barks = 0;
  private biteTimer = 0;

  feed(game: Game): void {
    this.state = 'chase';
    this.startFrenzy(game, 'GRRRR!', '#ffd9a0');
    bark(game.audio, true);
  }

  update(game: Game, dt: number): void {
    this.begin(dt);
    this.barking = Math.max(0, this.barking - dt * 4);
    const threats = this.threats(game);
    if (this.digest(dt)) {
      this.state = 'follow';
      game.popup('...', this.x, this.y - 24, '#fff3d6', 14, 0.9);
    }

    if (this.frenzy > 0) this.hunt(game, dt);
    else if (threats === 0) {
      this.state = 'follow';
      this.heel(game, dt, 290);
    } else {
      this.state = 'bark';
      this.standGuard(game, dt);
    }
    this.step(game, dt);
  }

  /** Behind the owner, facing the trouble, barking. */
  private standGuard(game: Game, dt: number): void {
    const pb = game.player.body;
    const enemy = this.nearest(game, Infinity);
    if (!enemy) return;
    const ex = pb.x - enemy.body.x;
    const ey = pb.y - enemy.body.y;
    const ed = Math.hypot(ex, ey) || 1;
    this.sitting = false;
    if (this.moveTo(pb.x + (ex / ed) * 42, pb.y + (ey / ed) * 42 + 4, 300, dt) < 14) this.facing = enemy.body.x > this.x ? 1 : -1;

    this.barkTimer -= dt;
    if (this.barkTimer > 0) return;
    this.barkTimer = 6.5 + Math.random() * 2.5;
    this.barks++;
    this.barking = 1;
    this.vz = 150;
    this.z = Math.max(this.z, 1);
    bark(game.audio, false);
    game.fx.burst(this.barks % 2 === 0 ? 'WOOF!' : 'YAP!', this.x + this.facing * 14, this.y - this.z - 26, 0.7, '#fff3d6');
    // every other bark is convincing enough to turn a head
    if (this.barks % 2 === 0 && Math.hypot(enemy.body.x - this.x, enemy.body.y - this.y) < 340 && enemy.lure(this.x, this.y, 1.5)) {
      game.popup('?', enemy.body.x, enemy.body.y - 50, '#fff3d6', 18, 0.8);
      game.discoveries.unlock('good_boy');
    }
  }

  private hunt(game: Game, dt: number): void {
    let target = this.target;
    if (!target || target.defeated || !target.alive) {
      if (target && target.defeated) game.discoveries.unlock('best_in_show');
      this.riding = false;
      target = this.target = this.pickTarget(game);
      this.state = 'chase';
    }
    if (!target) {
      this.state = 'follow';
      this.heel(game, dt, 290);
      return;
    }
    const tb = target.body;
    if (!this.riding) {
      const d = this.moveTo(tb.x, tb.y, 440, dt);
      if (Math.random() < dt * 30) game.particles.burst('dust', this.x, this.y + 2, 1, 40);
      if (d > target.type.radius + 13) return;
      this.riding = true;
      this.state = 'bite';
      this.timer = DOG_BITE_SECONDS;
      this.biteTimer = 0.05;
      this.lastTarget = target;
      game.audio.play('chomp', 1);
      game.fx.burst('CHOMP!', tb.x, tb.y - 30, 0.85, '#fff3d6');
      game.discoveries.unlock('ankle_biter_dog');
      return;
    }
    // clamped on behind it: the mover can barely move, and the dog flaps like a flag
    const back = target.facing + Math.PI;
    this.x = tb.x + Math.cos(back) * (target.type.radius + 4);
    this.y = tb.y + Math.sin(back) * (target.type.radius + 4) + 1;
    this.z = 5;
    this.vx = tb.vx;
    this.vy = tb.vy;
    this.facing = Math.cos(back) > 0 ? -1 : 1;
    target.slowTimer = Math.max(target.slowTimer, 0.2);
    target.slowFactor = 0.14;
    this.biteTimer -= dt;
    if (this.biteTimer <= 0) {
      this.biteTimer = DOG_BITE_EVERY;
      target.squash = 0.5;
      game.particles.burst('scrap', tb.x, tb.y - 8, 2, 180, { color: '#c9a070' });
      if (Math.random() < 0.4) game.fx.burst('GRRR!', this.x, this.y - 26, 0.6, '#fff3d6');
      target.damage(game, DOG_BITE_DAMAGE * game.petDamageMultiplier(), { type: 'impact', source: null, chain: null, label: 'WAFFLE', dirX: 0, dirY: 0 });
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.riding = false;
      this.target = null;
      this.vz = 200;
    }
  }
}

// ───────────────────────── the parrot ─────────────────────────

const INSULTS = [
  'WRONG ADDRESS!', 'RETURN TO SENDER!', "WHO'S A CARDBOARD BOY?", 'PIECES OF CRATE!', 'THIS WAY UP!', 'SQUAWK! RECYCLING!',
] as const;
const PECK_DAMAGE = 12;

/**
 * CAPTAIN — gran's parrot. Rides on her shoulder. With movers in the room it circles
 * out of reach, calls them names and occasionally drops something on one. A cracker turns
 * it into a dive bomber.
 */
export class Parrot extends Critter {
  readonly species = 'parrot' as const;
  readonly treat = 'cracker';
  readonly treatLabel = 'CRACKER';
  /** 0..1: wings out (flying) or folded (on a shoulder). */
  flying = 0;
  private orbit = Math.random() * 6;
  private squawkTimer = 2;
  private splatTimer = 5;
  private climb = 0;

  override get depth(): number {
    return this.y + 60;
  }

  feed(game: Game): void {
    this.state = 'dive';
    this.startFrenzy(game, 'SQUAWK!', '#ff7b6b');
    squawk(game.audio);
  }

  update(game: Game, dt: number): void {
    this.begin(dt);
    const threats = this.threats(game);
    if (this.digest(dt)) this.state = 'follow';
    let wantZ = 38;

    if (this.frenzy > 0 && threats > 0) {
      wantZ = this.dive(game, dt);
    } else if (threats === 0) {
      // back on the shoulder
      this.state = 'follow';
      const pb = game.player.body;
      const d = this.moveTo(pb.x + 9, pb.y + 1, 380, dt);
      this.flying += ((d > 16 ? 1 : 0) - this.flying) * Math.min(1, 8 * dt);
      if (d < 16) {
        this.x = pb.x + 9;
        this.y = pb.y + 1;
        this.vx = pb.vx;
        this.vy = pb.vy;
        this.facing = game.player.aimX >= 0 ? 1 : -1;
      }
      wantZ = d > 16 ? 52 : 37;
    } else {
      this.state = 'circle';
      wantZ = this.heckle(game, dt);
    }
    if (this.state !== 'follow') this.flying += (1 - this.flying) * Math.min(1, 8 * dt);
    this.z += (wantZ - this.z) * Math.min(1, 7 * dt);
    this.step(game, dt, false);
  }

  /** Round and round above the nearest mover's head, being rude. */
  private heckle(game: Game, dt: number): number {
    const enemy = this.nearest(game, Infinity);
    if (!enemy) return 60;
    this.orbit += dt * 2.4;
    this.moveTo(enemy.body.x + Math.cos(this.orbit) * 50, enemy.body.y + Math.sin(this.orbit) * 30 - 6, 330, dt, 6);

    this.squawkTimer -= dt;
    if (this.squawkTimer <= 0) {
      this.squawkTimer = 3 + Math.random() * 2.5;
      squawk(game.audio);
      game.popup(INSULTS[Math.floor(Math.random() * INSULTS.length)]!, this.x, this.y - this.z - 18, '#fff3d6', 13, 1.3);
    }
    this.splatTimer -= dt;
    if (this.splatTimer <= 0 && Math.hypot(enemy.body.x - this.x, enemy.body.y - this.y) < 70) {
      this.splatTimer = 6 + Math.random() * 3;
      enemy.confuse = Math.max(enemy.confuse, 1.8);
      enemy.squash = 0.6;
      game.audio.play('plop', 1);
      game.particles.burst('foam', enemy.body.x, enemy.body.y - 30, 7, 120);
      game.fx.burst('SPLAT!', enemy.body.x, enemy.body.y - 48, 0.85, '#ffffff');
      game.discoveries.unlock('air_raid');
    }
    return 66;
  }

  /** Down onto one, peck, up and away to the next. */
  private dive(game: Game, dt: number): number {
    this.state = 'dive';
    if (this.climb > 0) {
      this.climb -= dt;
      return 70;
    }
    let target = this.target;
    if (!target || target.defeated || !target.alive) target = this.target = this.pickTarget(game);
    if (!target) return 60;
    const tb = target.body;
    const d = this.moveTo(tb.x, tb.y, 640, dt, 9);
    if (d > target.type.radius + 12) return d < 120 ? 20 : 62;
    const dx = this.vx;
    const dy = this.vy;
    const dl = Math.hypot(dx, dy) || 1;
    target.stun = Math.max(target.stun, 0.4 * target.type.staggerFactor);
    target.squash = 0.8;
    target.body.vx += (dx / dl) * 220 * target.type.staggerFactor;
    target.body.vy += (dy / dl) * 220 * target.type.staggerFactor;
    game.audio.impact('wood', 0.5, 1);
    game.particles.burst('feather', tb.x, tb.y - 22, 4, 180, { color: '#e5383b' });
    game.fx.burst('PECK!', tb.x, tb.y - 44, 0.75, '#ffd23f');
    target.damage(game, PECK_DAMAGE * game.petDamageMultiplier(), { type: 'impact', source: null, chain: null, label: 'CAPTAIN', dirX: dx / dl, dirY: dy / dl });
    game.discoveries.unlock('dive_bomber');
    if (target.defeated) game.discoveries.unlock('pieces_of_crate');
    this.lastTarget = target;
    this.target = null;
    this.climb = 0.3;
    return 70;
  }
}

// ───────────────────────── the hamster ─────────────────────────

const BOWL_DAMAGE = 17;

/**
 * NUGGET — the kid's hamster, in its exercise ball. It rolls after its owner, rolls away
 * from movers, and any mover that steps on the ball goes over. A packet of sunflower seeds
 * and the ball is suddenly twice the size and coming straight down the middle.
 */
export class Hamster extends Critter {
  readonly species = 'hamster' as const;
  readonly treat = 'seeds';
  readonly treatLabel = 'SEEDS';
  /** 1 normally; grows while the seeds last. */
  size = 1;
  /** How far the ball has turned. */
  roll = 0;
  private tripCooldown = 0;
  private squeakTimer = 3;
  private readonly struck = new WeakMap<Enemy, number>();

  feed(game: Game): void {
    this.state = 'bowl';
    this.startFrenzy(game, 'SQUEEEAK!', '#ffd23f');
    hamsterSqueak(game.audio, true);
  }

  update(game: Game, dt: number): void {
    this.begin(dt);
    this.tripCooldown -= dt;
    const threats = this.threats(game);
    if (this.digest(dt)) this.state = 'follow';
    this.size += ((this.frenzy > 0 ? 2.2 : 1) - this.size) * Math.min(1, 6 * dt);
    this.sitting = false;

    if (this.frenzy > 0 && threats > 0) this.bowl(game, dt);
    else if (threats === 0) {
      this.state = 'follow';
      this.heel(game, dt, 270);
      this.squeakTimer -= dt;
      if (this.squeakTimer <= 0 && game.state === 'playing') {
        this.squeakTimer = 6 + Math.random() * 8;
        hamsterSqueak(game.audio);
      }
    } else {
      this.state = 'flee';
      this.keepAway(game, dt);
    }
    this.step(game, dt);
    this.roll += Math.hypot(this.vx, this.vy) * dt * 0.09 * this.facing;
  }

  private keepAway(game: Game, dt: number): void {
    const enemy = this.nearest(game, Infinity);
    if (!enemy) return;
    const dx = this.x - enemy.body.x;
    const dy = this.y - enemy.body.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 150) {
      // straight away from it, bending along the wall rather than stopping in a corner
      const def = game.room.def;
      const cx = (def.width / 2 - this.x) * 0.004;
      const cy = (def.height / 2 - this.y) * 0.004;
      this.moveTo(this.x + (dx / d + cx) * 80, this.y + (dy / d + cy) * 80, 310, dt, 8);
    } else {
      const pb = game.player.body;
      this.moveTo(pb.x - 30, pb.y + 26, 230, dt, 6);
    }
    if (this.tripCooldown > 0 || d > enemy.type.radius + 12 || this.z > 6) return;
    if (enemy.trip(game, { type: 'impact', source: null, chain: null, label: 'NUGGET', dirX: -dx / d, dirY: -dy / d })) {
      this.tripCooldown = 3;
      this.vx = (dx / d) * 420;
      this.vy = (dy / d) * 420;
      hamsterSqueak(game.audio, true);
      game.discoveries.unlock('hamster_trip');
    }
  }

  private bowl(game: Game, dt: number): void {
    this.state = 'bowl';
    let target = this.target;
    if (!target || target.defeated || !target.alive) target = this.target = this.pickTarget(game);
    if (!target) return;
    // loose steering from a distance, so it overshoots and swings back through; tight up close, so it connects
    const far = Math.hypot(target.body.x - this.x, target.body.y - this.y) > 110;
    this.moveTo(target.body.x + target.body.vx * 0.15, target.body.y + target.body.vy * 0.15, 620, dt, far ? 4.5 : 12);
    if (Math.random() < dt * 30) game.particles.burst('dust', this.x, this.y + 3, 1, 50);
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 150) return;
    for (const enemy of game.enemies) {
      if (enemy.defeated) continue;
      const dx = enemy.body.x - this.x;
      const dy = enemy.body.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > enemy.type.radius + 26) continue;
      if (game.time - (this.struck.get(enemy) ?? -9) < 0.8) continue;
      this.struck.set(enemy, game.time);
      enemy.stun = Math.max(enemy.stun, 0.7 * enemy.type.staggerFactor);
      enemy.squash = 1;
      enemy.body.vx += (this.vx / speed) * 520 * enemy.type.staggerFactor;
      enemy.body.vy += (this.vy / speed) * 520 * enemy.type.staggerFactor;
      game.audio.impact('plastic', 1, 8);
      game.camera.addShake(0.2);
      game.fx.burst('STRIKE!', enemy.body.x, enemy.body.y - 46, 0.95, '#ffd23f', true);
      enemy.damage(game, BOWL_DAMAGE * game.petDamageMultiplier(), { type: 'impact', source: null, chain: null, label: 'NUGGET', dirX: this.vx / speed, dirY: this.vy / speed });
      game.discoveries.unlock('bowling_night');
      if (enemy.defeated) game.discoveries.unlock('ten_pin');
      if (enemy === target) {
        this.lastTarget = enemy;
        this.target = null;
      }
    }
  }
}

export type Pet = Cat | Dog | Parrot | Hamster;

export function createPet(hero: HeroId, x: number, y: number): Pet {
  switch (hero) {
    case 'tenant':
      return new Dog(x, y);
    case 'flatmate':
      return new Cat(x, y);
    case 'gran':
      return new Parrot(x, y);
    case 'kid':
      return new Hamster(x, y);
  }
}
