import type { Game } from '../core/Game';
import type { Enemy } from '../entities/Enemy';
import type { PhysicsObject } from '../entities/PhysicsObject';

/** Room 1's lessons, in the order they are taught. */
export type Lesson = 'move' | 'grab' | 'throw' | 'power' | 'pet' | 'zap' | 'free';
export const LESSONS: readonly Lesson[] = ['move', 'grab', 'throw', 'power', 'pet', 'zap', 'free'];

/** Movers each lesson lets through the door. Room 1 lists exactly this many, in this order. */
/** throw and power send theirs in at once; pet and zap wait for the treat and the live puddle. */
const MOVERS: Readonly<Record<Lesson, number>> = { move: 0, grab: 0, throw: 1, power: 2, pet: 1, zap: 1, free: 3 };

export type GuideIcon = 'move' | 'grab' | 'throw' | 'power';

/**
 * What to show the player right now. The HUD turns `icon` into keycaps and a mouse, or
 * into thumbs on a phone; the renderer draws `line` on the floor. Text is `caption`
 * only, and only once somebody has been stuck for a while.
 */
export interface Guide {
  icon: GuideIcon | null;
  /** World anchor for the icon (desktop; a phone shows it where the thumb goes). */
  x: number;
  y: number;
  /** trail: footsteps to walk along. arc: a throw to copy. ring: point here. */
  line: 'none' | 'trail' | 'arc' | 'ring';
  tx: number;
  ty: number;
  caption: string;
}

const WAITING = Infinity;

/**
 * Room 1 as a staged lesson plan. One mechanic at a time, each started and finished by
 * something the player really did (bus events and world state, never a bare timer):
 * walk, grab, throw, the power, the pet's treat, water on a socket, then a free brawl.
 * The room's movers wait outside until the lesson that needs them, and nothing in a
 * guided lesson can knock the hero out. Progress is saved per lesson.
 */
export class Tutorial {
  /** Object to pulse so it reads as "this one". */
  focus: PhysicsObject | null = null;
  readonly guide: Guide = { icon: null, x: 0, y: 0, line: 'none', tx: 0, ty: 0, caption: '' };
  /** Lesson running now (null: not teaching). */
  step: Lesson | null = null;
  /** Where a restart of this room picks up. */
  resume: Lesson | null = null;

  private stepTime = 0;
  private misses = 0;
  private moved = 0;
  private passed = false;
  private released = false;
  private treat: PhysicsObject | null = null;
  private scent = 0;
  /** Later rooms: object ids worth a look on a first visit, and for how long. */
  private spot: readonly string[] = [];
  private spotLeft = 0;

  constructor(private readonly game: Game) {
    game.bus.on('OBJECT_GRABBED', (e) => {
      this.spotLeft = 0;
      if ((this.step === 'move' || this.step === 'grab') && e.object.def.throwable) this.enter('throw');
    });
    game.bus.on('OBJECT_THROWN', () => {
      if (this.step === 'throw' && !this.passed) this.misses++;
    });
    game.bus.on('ENEMY_HIT', (e) => {
      if (this.step === 'throw' && e.cause.type === 'impact' && e.cause.source?.kind === 'object') this.passed = true;
    });
    game.bus.on('PLAYER_HIT', () => {
      // A lesson is not the place to lose: the brawl at the end is.
      if (this.step && game.player.hp < 2) game.player.hp = 2;
    });
  }

  get active(): boolean {
    return this.step !== null;
  }

  /** True for anything the renderer should halo. */
  lit(object: PhysicsObject): boolean {
    return object === this.focus || (this.spotLeft > 0 && this.spot.includes(object.def.id));
  }

  /** Starts teaching the current room from `from`, or (null) not at all. */
  begin(from: Lesson | null): void {
    this.step = this.resume = null;
    this.focus = this.treat = null;
    this.spotLeft = 0;
    this.moved = 0;
    this.clearGuide();
    document.body.classList.remove('tutorial');
    if (!from) return;
    const room = this.game.room;
    let skipped = 0;
    for (const lesson of LESSONS) {
      if (lesson === from) break;
      skipped += MOVERS[lesson];
    }
    room.pending = room.pending.slice(skipped).map((spec) => ({ type: spec.type, delay: WAITING }));
    room.totalEnemies = room.pending.length;
    this.enter(from);
  }

  /** A first visit to a later room: its new toys glow until one is picked up. */
  spotlight(ids: readonly string[]): void {
    this.spot = ids;
    this.spotLeft = 9;
  }

  /** "I know all this": everyone still outside comes in, and the room is just a room. */
  skip(): void {
    if (!this.step) return;
    this.grantPower(false);
    const room = this.game.room;
    let n = 0;
    room.pending = room.pending.map((spec) =>
      spec.delay === WAITING ? { type: spec.type, delay: room.elapsed + 1 + 3.5 * n++ } : spec,
    );
    this.finish();
    this.resume = null;
  }

  update(dt: number): void {
    this.clearGuide();
    this.focus = null;
    if (this.spotLeft > 0) this.spotLeft -= dt;
    const step = this.step;
    if (!step) return;
    this.stepTime += dt;
    if (this.released && this.roomQuiet()) {
      this.enter(LESSONS[LESSONS.indexOf(step) + 1] ?? 'free');
      return;
    }

    const game = this.game;
    const g = this.guide;
    const player = game.player;
    const pb = player.body;
    const touch = game.input.touch;
    const overHead = (): void => {
      g.x = pb.x;
      g.y = pb.y - 78;
    };

    switch (step) {
      case 'move':
      case 'grab': {
        const target = this.weapon();
        if (!target) break;
        if (step === 'move') {
          if (pb.speed() > 60) this.moved += dt;
          this.focus = target;
          this.trailTo(target.body.x, target.body.y);
          // The keys fade the moment they have been used; the footsteps stay.
          if (this.moved < 0.6) {
            g.icon = 'move';
            overHead();
          }
          if (this.inReach(target)) this.enter('grab');
        } else {
          this.pointAt(target);
          if (this.stepTime > 8 && g.icon) g.caption = touch ? 'TAP' : 'CLICK IT';
        }
        break;
      }

      case 'throw': {
        if (this.passed) break;
        if (!player.held) {
          const target = this.weapon();
          if (target) this.pointAt(target);
          break;
        }
        const enemy = this.nearestEnemy();
        if (!enemy) break;
        g.icon = 'throw';
        overHead();
        g.line = 'arc';
        g.tx = enemy.body.x;
        g.ty = enemy.body.y;
        if (this.misses >= 2) {
          // Two misses: it stands still while you line it up, and the words come out.
          enemy.stun = Math.max(enemy.stun, 0.3);
          g.caption = touch ? 'HOLD, THEN LET GO' : 'HOLD, AIM, LET GO';
        }
        break;
      }

      case 'power': {
        if (!game.abilities.ready('blast')) break;
        let n = 0;
        let cx = 0;
        let cy = 0;
        for (const enemy of game.enemies) {
          if (enemy.defeated) continue;
          cx += enemy.body.x;
          cy += enemy.body.y;
          n++;
        }
        if (n === 0) break;
        g.icon = 'power';
        overHead();
        g.line = 'ring';
        g.tx = cx / n;
        g.ty = cy / n;
        if (this.stepTime > 10) g.caption = touch ? 'TAP POWER' : 'POINT AT THEM, PRESS 1';
        break;
      }

      case 'pet': {
        const pet = game.pet;
        if (!pet) {
          this.enter('zap');
          return;
        }
        if (pet.frenzy > 0 && !this.released) {
          // Fed first, then the knock at the door: there is no missing what the treat did.
          game.camera.focus(pet.x, pet.y, 1.1, 1.12);
          this.release();
        }
        if (this.released) break;
        if (!this.treat || !this.treat.alive) this.treat = this.dropNear(pet.treat);
        const treat = this.treat;
        if (!treat) break;
        this.pointAt(treat);
        this.scent -= dt;
        if (this.scent <= 0) {
          this.scent = 0.28;
          game.particles.burst('steam', treat.body.x, treat.body.y - 10, 1, 46, { dirX: 0, dirY: -1, spread: 0.5 });
          game.particles.burst('star', treat.body.x, treat.body.y - 6, 1, 70);
        }
        if (this.stepTime > 10) g.caption = `${pet.treatLabel} FOR YOUR PET`;
        break;
      }

      case 'zap': {
        let live = false;
        let socket = null;
        for (const zone of game.zones.zones) {
          if (!zone.alive) continue;
          if (zone.zone === 'water' && zone.tags.has('energized')) live = true;
          else if (zone.tags.has('outlet')) socket = zone;
        }
        if (live || !socket) {
          // The floor is live: now somebody walks in to find out.
          if (!this.released) this.release();
          break;
        }
        let bottle = player.held && player.held.def.id === 'bottle' ? player.held : null;
        if (!bottle) bottle = game.objects.find((o) => o.alive && o.def.id === 'bottle') ?? null;
        if (!bottle) {
          bottle = this.dropNear('bottle');
          this.misses++;
        }
        if (!bottle) break;
        if (player.held === bottle) {
          g.icon = 'throw';
          overHead();
          g.line = 'arc';
          g.tx = socket.x + 16;
          g.ty = socket.y + 22;
        } else if (!player.held) {
          this.pointAt(bottle);
        } else {
          this.focus = bottle;
        }
        if (this.misses >= 2 || this.stepTime > 14) g.caption = 'WATER ON THE SOCKET';
        break;
      }

      case 'free':
        break;
    }
  }

  // ───────────── lessons ─────────────

  private enter(step: Lesson): void {
    const game = this.game;
    this.step = this.resume = step;
    this.stepTime = 0;
    this.misses = 0;
    this.passed = false;
    this.released = false;
    this.treat = null;
    game.save.data.tutorial = step;
    game.save.write();
    document.body.classList.add('tutorial');

    switch (step) {
      case 'throw':
        this.release();
        break;
      case 'power':
        this.grantPower(true);
        this.release();
        break;
      case 'free': {
        // The puddle by the door dries up, or nobody would ever get past it.
        for (const zone of game.zones.zones) {
          if (zone.alive && zone.zone === 'water' && !zone.attached) zone.ttl = Math.min(zone.ttl, 4);
        }
        if (game.pet) this.dropNear(game.pet.treat);
        if (!game.objects.some((o) => o.alive && o.def.id === 'bottle')) this.dropNear('bottle');
        // ...and nobody comes in until it has.
        this.release(3.5, 5);
        game.hud.banner('EVERYTHING CAN BE A WEAPON.', '', 2.4);
        this.finish();
        break;
      }
      default:
        break;
    }
  }

  private finish(): void {
    this.step = null;
    this.focus = null;
    this.clearGuide();
    this.game.save.data.tutorial = 'done';
    this.game.save.write();
    document.body.classList.remove('tutorial');
  }

  /** Opens the door to this lesson's movers. */
  private release(gap = 0.6, lead = 0.9): void {
    const room = this.game.room;
    const count = this.step ? MOVERS[this.step] : 0;
    let i = room.pending.findIndex((spec) => spec.delay === WAITING);
    for (let n = 0; i >= 0 && n < count && i < room.pending.length; n++, i++) {
      room.pending[i] = { type: room.pending[i]!.type, delay: room.elapsed + lead + n * gap };
    }
    this.released = true;
  }

  /** Nobody left standing and nobody on the way in. */
  private roomQuiet(): boolean {
    const game = this.game;
    for (const enemy of game.enemies) if (!enemy.defeated) return false;
    for (const spec of game.room.pending) if (spec.delay !== WAITING) return false;
    return true;
  }

  /** The BIG RED BUTTON is what room 1 pays out: owned for good, and ready now. */
  private grantPower(announce: boolean): void {
    const game = this.game;
    game.abilities.resetRoom();
    if (game.abilities.owned('blast')) return;
    game.save.data.abilities.push('blast');
    game.save.write();
    document.body.classList.add('powers');
    if (!announce) return;
    const pb = game.player.body;
    game.hud.unlock('NEW POWER', 'BIG RED BUTTON', 'a detonation wherever you point');
    game.audio.play('discovery', 1);
    game.fx.flash('#ffd23f', 0.35);
    game.fx.ring(pb.x, pb.y, 10, 140, 0.5, 'rgba(255,210,63,0.95)', 6);
    game.particles.burst('confetti', pb.x, pb.y - 30, 28, 380);
  }

  // ───────────── helpers ─────────────

  private clearGuide(): void {
    const g = this.guide;
    g.icon = null;
    g.line = 'none';
    g.caption = '';
  }

  private trailTo(x: number, y: number): void {
    const g = this.guide;
    g.line = 'trail';
    g.tx = x;
    g.ty = y;
  }

  /** A grab would get it right now: under the thumb's auto-pick on a phone, in arm's reach with a mouse. */
  private inReach(object: PhysicsObject): boolean {
    const player = this.game.player;
    if (this.game.input.touch) return player.hover === object;
    const b = object.body;
    return Math.hypot(b.x - player.body.x, b.y - player.body.y) < 136 + b.boundR;
  }

  /** "Pick this up": halo, then the grab icon once a grab would work, footsteps until it would. */
  private pointAt(object: PhysicsObject): void {
    const g = this.guide;
    const b = object.body;
    this.focus = object;
    if (!this.inReach(object)) {
      this.trailTo(b.x, b.y);
      return;
    }
    g.icon = 'grab';
    g.x = b.x;
    // Clear of the name tag that comes up once the cursor is on it.
    g.y = b.y - b.z - object.def.height - (this.game.player.hover === object ? 84 : 44);
  }

  /** Nearest thing worth throwing, with a soft spot for the frying pan. */
  private weapon(): PhysicsObject | null {
    const hover = this.game.player.hover;
    // On a phone a tap takes whatever is highlighted, so that is the one to point at.
    if (this.game.input.touch && hover && hover.def.throwable && !hover.def.consume) return hover;
    const pb = this.game.player.body;
    let best: PhysicsObject | null = null;
    let bestD = Infinity;
    for (const object of this.game.objects) {
      if (!object.alive || object.held || object.burning || !object.def.throwable || object.def.consume) continue;
      let d = Math.hypot(object.body.x - pb.x, object.body.y - pb.y);
      if (object.def.id === 'pan') d *= 0.4;
      if (d < bestD) {
        bestD = d;
        best = object;
      }
    }
    return best;
  }

  private nearestEnemy(): Enemy | null {
    const pb = this.game.player.body;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const enemy of this.game.enemies) {
      if (enemy.defeated) continue;
      const d = Math.hypot(enemy.body.x - pb.x, enemy.body.y - pb.y);
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    return best;
  }

  /** Puts something on the floor a few steps from the hero, towards the middle of the room. */
  private dropNear(id: string): PhysicsObject | null {
    const game = this.game;
    const def = game.room.def;
    const pb = game.player.body;
    const dx = def.width / 2 - pb.x;
    const dy = def.height / 2 - pb.y;
    const d = Math.hypot(dx, dy);
    // Standing dead centre: any direction will do.
    const ux = d > 20 ? dx / d : 1;
    const uy = d > 20 ? dy / d : 0;
    const x = Math.min(def.width - 50, Math.max(50, pb.x + ux * 90));
    const y = Math.min(def.height - 50, Math.max(70, pb.y + uy * 90));
    const object = game.spawnObject(id, x, y, game.rng.range(0, Math.PI * 2));
    if (object) {
      game.audio.play('poof', 0.6);
      game.fx.ring(x, y, 4, 36, 0.3, 'rgba(255,255,255,0.85)', 3);
      game.particles.burst('dust', x, y, 6, 90);
    }
    return object;
  }
}
