import { hiss, meow, purr, scratch } from '../audio/PetVoices';
import type { Game } from '../core/Game';
import { doorPosition } from '../gameplay/Room';
import type { Enemy } from './Enemy';
import type { PhysicsObject } from './PhysicsObject';

export type CatState = 'follow' | 'startle' | 'flee' | 'hide' | 'swipe' | 'hunt' | 'maul' | 'smug';

/** How long a tin of tuna keeps the cat brave. */
export const FRENZY_SECONDS = 15;

const TROT = 300;
const FLEE = 350;
const HUNT = 470;
const SWIPE_RANGE = 62;
const SWIPE_DAMAGE = 7;
const SWIPE_COOLDOWN = 4.5;
const MAUL_SECONDS = 1.5;
const SCRATCH_EVERY = 0.24;
const SCRATCH_DAMAGE = 5;
const FIGHT_WORDS = ['SCRATCH!', 'HISS!', 'MRROW!', 'FFT!', 'RIP!'] as const;

/** How high the top of whatever is at (x, y) stands, so the cat can walk over the furniture. */
export function heightAt(game: Game, x: number, y: number, pad = 0): number {
  let top = 0;
  for (const o of game.objects) {
    if (!o.alive || o.held || o.restingOn || o.def.consume || o.def.height < 8 || o.body.z > 4 || o.tipProgress >= 0) continue;
    const b = o.body;
    const dx = x - b.x;
    const dy = y - b.y;
    const s = b.shape;
    let inside: boolean;
    if (s.kind === 'circle') {
      inside = dx * dx + dy * dy < (s.r + pad) * (s.r + pad);
    } else {
      const c = Math.cos(b.angle);
      const sn = Math.sin(b.angle);
      inside = Math.abs(dx * c + dy * sn) < s.hw + pad && Math.abs(-dx * sn + dy * c) < s.hh + pad;
    }
    if (!inside) continue;
    const h = o.def.tip && !o.standing ? 12 : o.def.height;
    if (h > top) top = h;
  }
  return top;
}

/**
 * BISCUIT — the flatmate's cat. Not a fighter: it trots after her while the flat is quiet,
 * and the moment a mover comes through the door it is on top of the tallest piece of
 * furniture it can find, shaking. Corner it and it lashes out. Open a tin of tuna and,
 * for fifteen seconds, it is the most dangerous thing in the building.
 *
 * It is not a physics body: nothing can hit it, and it walks over furniture rather than
 * round it (its height follows whatever is underneath).
 */
export class Cat {
  readonly kind = 'pet' as const;
  readonly species = 'cat' as const;
  readonly treat = 'tuna';
  readonly treatLabel = 'TUNA';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Height above the floor: on a table, on a fridge, on somebody's face. */
  z = 0;
  prevZ = 0;
  private vz = 0;
  vx = 0;
  vy = 0;
  /** -1 looking left, 1 looking right. */
  facing = 1;
  state: CatState = 'follow';
  timer = 0;
  /** Seconds of tuna courage left. */
  frenzy = 0;
  target: Enemy | null = null;
  perch: PhysicsObject | null = null;
  walkPhase = 0;
  /** 0..1, eased: how frightened it looks. */
  fear = 0;
  sitting = false;
  /** Seconds since it last did anything; drives the idle fidgets. */
  idle = 0;
  readonly seed = Math.random() * 100;

  private hideX = 0;
  private hideY = 0;
  private avoid: PhysicsObject | null = null;
  private lastTarget: Enemy | null = null;
  private swipeCooldown = 0;
  private scratchTimer = 0;
  private scratches = 0;
  private think = 0;
  private hadThreats = false;
  private meowTimer = 4;

  constructor(x: number, y: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }

  /** True while it is on a mover's face rather than on the floor. */
  get riding(): boolean {
    return this.state === 'maul';
  }

  /** Where the renderer should sort it: on top of whatever it is standing on. */
  get depth(): number {
    if (this.state === 'maul' && this.target) return this.target.body.y + 2;
    if (this.perch && this.state === 'hide') return this.perch.body.y + this.perch.body.extY + 1;
    return this.y;
  }

  /** The tuna has been opened. */
  feed(game: Game): void {
    this.frenzy = FRENZY_SECONDS;
    this.target = null;
    this.perch = null;
    this.state = 'hunt';
    this.vz = 260;
    this.z = Math.max(this.z, 1);
    meow(game.audio, 'war');
    game.fx.burst('MRRROW!', this.x, this.y - this.z - 30, 1.15, '#ffb84d', true);
    game.fx.ring(this.x, this.y, 6, 60, 0.35, 'rgba(255,184,77,0.9)', 4);
    game.particles.burst('star', this.x, this.y - this.z - 8, 10, 240);
  }

  update(game: Game, dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = this.z;
    // Cat Frenzy doubles the tuna-time attack rate; duplicate cards only stack damage.
    const frenzyRate = this.frenzy > 0 && game.edges.stacks('cat_frenzy') > 0 ? 2 : 1;
    this.swipeCooldown -= dt * frenzyRate;
    this.idle += dt;

    let threats = 0;
    for (const enemy of game.enemies) if (!enemy.defeated) threats++;
    const scaredNow = this.state === 'startle' || this.state === 'flee' || this.state === 'hide' || this.state === 'swipe';
    this.fear += ((scaredNow ? 1 : 0) - this.fear) * Math.min(1, 8 * dt);

    if (this.frenzy > 0) {
      this.frenzy -= dt;
      if (this.frenzy <= 0) this.calmDown(game, threats);
    }

    switch (this.state) {
      case 'follow':
        if (threats > 0) this.startle(game);
        else this.follow(game, dt);
        break;

      case 'startle':
        this.vx *= Math.exp(-10 * dt);
        this.vy *= Math.exp(-10 * dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.pickHide(game);
          this.state = 'flee';
        }
        break;

      case 'flee': {
        if (threats === 0) {
          this.relax(game);
          break;
        }
        if (this.perch && !this.goodPerch(this.perch)) this.pickHide(game);
        if (this.perch) {
          this.hideX = this.perch.body.x;
          this.hideY = this.perch.body.y;
        }
        if (this.moveTo(this.hideX, this.hideY, FLEE, dt) < 9) {
          this.state = 'hide';
          this.think = 0.4;
        }
        break;
      }

      case 'hide':
        if (threats === 0) {
          this.relax(game);
          break;
        }
        if (this.perch) {
          if (!this.goodPerch(this.perch)) {
            // its hiding place just fell over
            this.startle(game);
            break;
          }
          this.x += (this.perch.body.x - this.x) * Math.min(1, 12 * dt);
          this.y += (this.perch.body.y - this.y) * Math.min(1, 12 * dt);
        }
        this.vx = this.vy = 0;
        this.think -= dt;
        if (this.think <= 0) {
          this.think = 0.2;
          const near = this.nearestEnemy(game, SWIPE_RANGE + (this.z > 20 ? 14 : 0), null);
          if (near) {
            this.facing = near.body.x >= this.x ? 1 : -1;
            if (this.swipeCooldown <= 0) this.swipe(game, near);
          }
        }
        break;

      case 'swipe':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.avoid = this.perch;
          this.pickHide(game);
          this.state = 'flee';
        }
        break;

      case 'hunt': {
        if (!this.target || this.target.defeated || !this.target.alive) {
          this.target = this.nearestEnemy(game, Infinity, threats > 1 ? this.lastTarget : null);
        }
        const target = this.target;
        if (!target) {
          this.state = 'smug';
          this.idle = 0;
          break;
        }
        const d = this.moveTo(target.body.x, target.body.y, HUNT, dt);
        if (Math.random() < dt * 30) game.particles.burst('dust', this.x, this.y + 2, 1, 40);
        if (d < target.type.radius + 14) this.pounce(game, target);
        break;
      }

      case 'maul': {
        const target = this.target;
        if (!target || target.defeated || !target.alive) {
          if (target && target.defeated) game.discoveries.unlock('cat_burglar');
          this.leapOff();
          break;
        }
        const tb = target.body;
        this.x = tb.x;
        this.y = tb.y;
        this.vx = tb.vx;
        this.vy = tb.vy;
        const ride = target.type.radius * 1.7;
        this.z += (ride - this.z) * Math.min(1, 18 * dt);
        this.vz = 0;
        target.confuse = Math.max(target.confuse, 0.5);
        this.scratchTimer -= dt;
        if (this.scratchTimer <= 0) {
          this.scratchTimer = SCRATCH_EVERY;
          this.scratches++;
          const a = Math.random() * Math.PI * 2;
          this.facing = -this.facing;
          target.squash = 0.7;
          scratch(game.audio);
          game.particles.burst('scrap', tb.x, tb.y - ride, 3, 230, { color: '#c9a070' });
          game.particles.burst('star', tb.x, tb.y - ride, 2, 200);
          if (this.scratches % 2 === 1) {
            const word = FIGHT_WORDS[Math.floor(Math.random() * FIGHT_WORDS.length)]!;
            game.fx.burst(word, tb.x + Math.cos(a) * 26, tb.y - ride - 14 + Math.sin(a) * 12, 0.62, '#fff3d6');
          }
          target.damage(game, SCRATCH_DAMAGE * game.petDamageMultiplier(), { type: 'impact', source: null, chain: null, label: 'BISCUIT', dirX: Math.cos(a), dirY: Math.sin(a) });
        }
        this.timer -= dt;
        if (this.timer <= 0 && this.state === 'maul') this.leapOff();
        break;
      }

      case 'smug':
        this.vx *= Math.exp(-10 * dt);
        this.vy *= Math.exp(-10 * dt);
        this.sitting = true;
        if (threats > 0) {
          this.sitting = false;
          this.state = 'hunt';
        }
        break;
    }

    this.hadThreats = threats > 0;
    this.integrate(game, dt);
  }

  private integrate(game: Game, dt: number): void {
    if (this.state !== 'maul') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const def = game.room.def;
      this.x = Math.min(def.width - 14, Math.max(14, this.x));
      this.y = Math.min(def.height - 10, Math.max(20, this.y));

      // Hop up onto, and down off, whatever is underfoot.
      const ground = heightAt(game, this.x, this.y);
      this.vz -= 1500 * dt;
      this.z += this.vz * dt;
      if (this.z <= ground) {
        if (ground - this.z > 3 && this.vz <= 0) {
          // a wall of furniture in the way: spring onto it
          this.z += (ground - this.z) * Math.min(1, 16 * dt);
        } else {
          this.z = ground;
        }
        this.vz = Math.max(0, this.vz);
      }
    }
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 12) {
      this.walkPhase += speed * dt * 0.11;
      if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;
      this.idle = 0;
    }
  }

  /** Steers towards a point; returns the distance left. */
  private moveTo(tx: number, ty: number, speed: number, dt: number): number {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.min(speed, d * 9);
    const k = Math.min(1, 14 * dt);
    this.vx += ((dx / d) * want - this.vx) * k;
    this.vy += ((dy / d) * want - this.vy) * k;
    return d;
  }

  private follow(game: Game, dt: number): void {
    const p = game.player;
    const pb = p.body;
    // a spot just behind her heels, on whichever side it already is
    const side = (this.x - pb.x) * -p.aimY + (this.y - pb.y) * p.aimX >= 0 ? 1 : -1;
    const tx = pb.x - p.aimX * 30 - p.aimY * 16 * side;
    const ty = pb.y - p.aimY * 30 + p.aimX * 16 * side + 6;
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > (this.sitting ? 46 : 12)) {
      this.sitting = false;
      this.moveTo(tx, ty, TROT, dt);
    } else {
      this.vx *= Math.exp(-12 * dt);
      this.vy *= Math.exp(-12 * dt);
      if (this.idle > 0.6) this.sitting = true;
      if (pb.x !== this.x) this.facing = pb.x > this.x ? 1 : -1;
    }
    this.meowTimer -= dt;
    if (this.meowTimer <= 0 && game.state === 'playing') {
      this.meowTimer = 7 + Math.random() * 9;
      meow(game.audio, 'hello');
      game.popup('meow', this.x + this.facing * 10, this.y - this.z - 24, '#fff3d6', 13, 0.9);
    }
  }

  private startle(game: Game): void {
    this.state = 'startle';
    this.timer = 0.34;
    this.sitting = false;
    this.perch = null;
    this.vz = 300;
    this.z = Math.max(this.z, 1);
    if (!this.hadThreats || this.swipeCooldown < SWIPE_COOLDOWN - 1) {
      meow(game.audio, 'scared');
      game.fx.burst('!', this.x, this.y - this.z - 30, 0.8, '#fff3d6');
    }
  }

  private relax(game: Game): void {
    this.state = 'follow';
    this.perch = null;
    this.avoid = null;
    this.sitting = false;
    this.meowTimer = 2.5;
    if (game.state === 'playing') purr(game.audio);
  }

  private calmDown(game: Game, threats: number): void {
    this.frenzy = 0;
    this.target = null;
    this.sitting = false;
    if (this.state === 'maul') {
      this.vz = 260;
      this.vx = -this.facing * 160;
    }
    game.popup('...', this.x, this.y - this.z - 26, '#fff3d6', 14, 0.9);
    if (threats > 0) this.startle(game);
    else this.state = 'follow';
  }

  private goodPerch(o: PhysicsObject): boolean {
    return o.alive && !o.held && o.tipProgress < 0 && !(o.def.tip && !o.standing) && o.structural !== 'broken' && !o.burning;
  }

  private nearestEnemy(game: Game, range: number, skip: Enemy | null): Enemy | null {
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

  /** Distance from a point to whatever is most worth being far away from. */
  private danger(game: Game, x: number, y: number): number {
    let d = Infinity;
    for (const enemy of game.enemies) {
      if (!enemy.defeated) d = Math.min(d, Math.hypot(enemy.body.x - x, enemy.body.y - y));
    }
    const door = doorPosition(game.room.def, game.room.def.entrance, 24);
    return Math.min(d, Math.hypot(door.x - x, door.y - y) * 1.15);
  }

  /** Up high if there is anything tall and solid; otherwise the corner furthest from trouble. */
  private pickHide(game: Game): void {
    let best: PhysicsObject | null = null;
    let bestScore = 150;
    for (const o of game.objects) {
      if (o === this.avoid || o.def.height < 18 || !(o.def.fixed || o.body.mass >= 40) || !this.goodPerch(o)) continue;
      const score = this.danger(game, o.body.x, o.body.y) + o.def.height * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    this.perch = best;
    if (best) {
      this.hideX = best.body.x;
      this.hideY = best.body.y;
      return;
    }
    const def = game.room.def;
    let cornerScore = -1;
    for (const cx of [26, def.width - 26]) {
      for (const cy of [34, def.height - 22]) {
        const score = this.danger(game, cx, cy);
        if (score > cornerScore) {
          cornerScore = score;
          this.hideX = cx;
          this.hideY = cy;
        }
      }
    }
  }

  /** Cornered: one panicked swipe, then somewhere else to hide. */
  private swipe(game: Game, enemy: Enemy): void {
    const dx = enemy.body.x - this.x;
    const dy = enemy.body.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.state = 'swipe';
    this.timer = 0.32;
    this.swipeCooldown = SWIPE_COOLDOWN;
    hiss(game.audio);
    scratch(game.audio);
    game.fx.burst('HISS!', this.x, this.y - this.z - 28, 0.8, '#fff3d6');
    game.particles.burst('scrap', enemy.body.x, enemy.body.y - 16, 4, 200, { color: '#c9a070' });
    enemy.stun = Math.max(enemy.stun, 0.45 * enemy.type.staggerFactor);
    enemy.body.vx += (dx / d) * 190 * enemy.type.staggerFactor;
    enemy.body.vy += (dy / d) * 190 * enemy.type.staggerFactor;
    enemy.damage(game, SWIPE_DAMAGE * game.petDamageMultiplier(), { type: 'impact', source: null, chain: null, label: 'BISCUIT', dirX: dx / d, dirY: dy / d });
    game.discoveries.unlock('scaredy_cat');
    if (enemy.defeated) game.discoveries.unlock('cat_burglar');
  }

  private pounce(game: Game, enemy: Enemy): void {
    this.state = 'maul';
    this.timer = MAUL_SECONDS;
    this.scratchTimer = 0.05;
    this.scratches = 0;
    this.lastTarget = enemy;
    hiss(game.audio);
    game.fx.ring(enemy.body.x, enemy.body.y, 6, 46, 0.25, 'rgba(255,255,255,0.85)', 3);
    game.particles.burst('dust', enemy.body.x, enemy.body.y - 12, 8, 150);
    game.discoveries.unlock('cat_fight');
  }

  private leapOff(): void {
    this.state = this.frenzy > 0 ? 'hunt' : 'follow';
    this.target = null;
    this.vz = 280;
    const a = Math.random() * Math.PI * 2;
    this.vx = Math.cos(a) * 220;
    this.vy = Math.sin(a) * 220;
  }
}
