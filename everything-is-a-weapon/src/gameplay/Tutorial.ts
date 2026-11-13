import type { Game } from '../core/Game';
import type { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { LESSONS, TUTORIAL_ROOMS, tutorialRoom, type Lesson } from './TutorialRooms';

export { LESSONS };
export type { Lesson };

export type GuideIcon = 'move' | 'grab' | 'throw' | 'power' | 'dash';

/**
 * What to show the player right now. The HUD turns `icon` into keycaps and a mouse, or
 * into thumbs on a phone; the renderer draws `line` on the floor.
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

/** The card at the top of a lesson room: which lesson, and the one thing to do next. */
export interface LessonCard {
  n: number;
  of: number;
  title: string;
  text: string;
}

const WAITING = Infinity;
/** A lesson whose trigger never happens lets its movers in anyway after this long. */
const FALLBACK_RELEASE = 30;

/**
 * The opening: five tiny rooms, one idea each (gameplay/TutorialRooms.ts), then the campaign.
 * This class runs whichever lesson room is loaded: it points at what to do next, writes the
 * one line on the lesson card, and lets the room's movers in when the lesson is ready for
 * them. Clearing the room is what finishes a lesson (Game.advanceTutorial walks into the
 * next). Nothing in a lesson can knock the hero out. Progress is saved per lesson.
 */
export class Tutorial {
  /** Object to pulse so it reads as "this one". */
  focus: PhysicsObject | null = null;
  readonly guide: Guide = { icon: null, x: 0, y: 0, line: 'none', tx: 0, ty: 0, caption: '' };
  /** The lesson card for the HUD (null outside a lesson). */
  card: LessonCard | null = null;
  /** Lesson running now (null: not teaching). */
  step: Lesson | null = null;
  /** Where a restart of this room picks up. */
  resume: Lesson | null = null;
  /**
   * A first visit to a later room is a one-beat lesson: the new toys glow and the
   * teaser line rides under the icon until one is picked up, then the room is a room.
   */
  spotStep = false;

  private stepTime = 0;
  private misses = 0;
  private released = false;
  private dashed = false;
  private thrown = false;
  private treat: PhysicsObject | null = null;
  private scent = 0;
  private lastDrop = -99;
  /** Later rooms: object ids worth a look on a first visit, and for how long. */
  spot: readonly string[] = [];
  private spotLeft = 0;

  constructor(private readonly game: Game) {
    game.bus.on('OBJECT_GRABBED', () => {
      this.spotLeft = 0;
      if (this.spotStep) {
        // A first visit to a later room ends the beat the moment one of the new
        // toys is picked up; the room is then just a room.
        this.spotStep = false;
        this.spot = [];
        this.guide.caption = '';
      }
      // The sleeping box wakes up the moment you arm yourself.
      if (this.step === 'throw') this.wake();
    });
    game.bus.on('OBJECT_THROWN', () => {
      if (this.step === 'throw' || this.step === 'zap' || this.step === 'dash') {
        this.thrown = true;
        this.misses++;
      }
    });
    game.bus.on('ENEMY_HIT', (e) => {
      if (this.step === 'throw' && e.cause.type === 'impact' && e.cause.source?.kind === 'object') this.misses = 0;
    });
    game.bus.on('PLAYER_HIT', () => {
      // A lesson is not the place to lose.
      if (this.step && game.player.hp < 2) game.player.hp = 2;
    });
  }

  get active(): boolean {
    return this.step !== null;
  }

  private get touch(): boolean {
    return this.game.input.touch;
  }

  /** True for anything the renderer should halo. */
  lit(object: PhysicsObject): boolean {
    return object === this.focus || (this.spotLeft > 0 && this.spot.includes(object.def.id));
  }

  /** Starts the lesson in the room that has just loaded, or (null) no lesson at all. */
  begin(from: Lesson | null): void {
    const game = this.game;
    this.step = this.resume = null;
    this.card = null;
    this.focus = this.treat = null;
    this.spotLeft = 0;
    this.clearGuide();
    document.body.classList.remove('tutorial');
    if (!from) return;
    const spec = tutorialRoom(from);
    const room = game.room;
    // Everyone waits outside until the lesson needs them.
    room.pending = room.pending.map((p) => ({ type: p.type, delay: WAITING }));
    room.totalEnemies = room.pending.length + (spec.sleeper ? 1 : 0);
    this.step = this.resume = from;
    this.stepTime = 0;
    this.misses = 0;
    this.released = false;
    this.dashed = false;
    this.thrown = false;
    this.lastDrop = -99;
    game.save.data.tutorial = from;
    game.save.write();
    document.body.classList.add('tutorial');

    switch (from) {
      case 'throw': {
        // One beat of story before anything else: who is in the house and whose house it is.
        const pb = game.player.body;
        game.popup('3:07 A.M. THE GNOMES GOT IN.', pb.x + 60, pb.y - 70, '#fff4dc', 20, 2.6);
        const s = spec.sleeper;
        if (s) {
          // Awake only when you are armed: until then it just stands there.
          const sleeper = game.spawnEnemyType({ ...ENEMY_TYPES[s.type], awareness: 1 }, s.x, s.y, -1, 0);
          sleeper.ai = 'idle';
          sleeper.aware = false;
        }
        break;
      }
      case 'power':
        this.grantPower(true);
        break;
      case 'pet':
        if (game.pet) this.treat = this.dropNear(game.pet.treat);
        break;
      default:
        break;
    }
  }

  /** A first visit to a later room: its new toys glow until one is picked up, and the
     teaser line rides under the icon so the player learns one thing at a time. */
  spotlight(ids: readonly string[], teaser?: string): void {
    this.spot = ids;
    this.spotLeft = 9;
    this.spotStep = true;
    if (teaser) {
      const g = this.guide;
      g.caption = teaser;
      g.icon = null;
      g.line = 'none';
      g.tx = this.game.player.body.x;
      g.ty = this.game.player.body.y - 78;
    }
  }

  /** "I know all this": straight to the campaign, with the Power in the pocket. */
  skip(): void {
    if (!this.step) return;
    this.game.markTutorialSkipped();
    this.grantPower(false);
    this.step = this.resume = null;
    this.card = null;
    this.game.leaveTutorial();
  }

  update(dt: number): void {
    this.clearGuide();
    this.focus = null;
    if (this.spotLeft > 0) this.spotLeft -= dt;
    // A first visit to a later room: the teaser rides under the icon until one of
    // the new toys is picked up, then the room is just a room.
    if (this.spotStep && this.spotLeft <= 0) {
      this.spotStep = false;
      this.spot = [];
      this.guide.caption = '';
    }
    const step = this.step;
    if (!step) {
      this.card = null;
      return;
    }
    this.stepTime += dt;
    switch (step) {
      case 'throw':
        this.updateThrow();
        break;
      case 'zap':
        this.updateZap();
        break;
      case 'dash':
        this.updateDash();
        break;
      case 'power':
        this.updatePower();
        break;
      case 'pet':
        this.updatePet(dt);
        break;
    }
  }

  // ───────────── lessons ─────────────

  /** One line on the card. */
  private say(text: string): void {
    const i = Math.max(0, LESSONS.indexOf(this.step ?? 'throw'));
    const card = this.card;
    if (card && card.n === i + 1 && card.text === text) return;
    this.card = { n: i + 1, of: LESSONS.length, title: TUTORIAL_ROOMS[i]!.title, text };
  }

  private overHead(): void {
    const g = this.guide;
    const pb = this.game.player.body;
    g.x = pb.x;
    g.y = pb.y - 78;
  }

  /** 1. Pick it up, throw it at the box. */
  private updateThrow(): void {
    const game = this.game;
    const g = this.guide;
    const player = game.player;
    if (!player.held) {
      const target = this.weapon();
      if (target) this.pointAt(target);
      this.say(this.thrown ? 'PICK IT UP AGAIN' : this.touch ? 'TAP THE PAN TO PICK IT UP' : 'CLICK THE PAN TO PICK IT UP');
      return;
    }
    const enemy = this.nearestEnemy();
    if (!enemy) return;
    g.icon = 'throw';
    this.overHead();
    g.line = 'arc';
    g.tx = enemy.body.x;
    g.ty = enemy.body.y;
    this.say('HOLD, AIM AT THE GNOME, LET GO');
    // Two misses: it stands still while you line it up.
    if (this.misses >= 2) enemy.stun = Math.max(enemy.stun, 0.3);
  }

  /** 2. Water on a live socket. */
  private updateZap(): void {
    const game = this.game;
    const g = this.guide;
    const player = game.player;
    let live = false;
    let socket = null;
    for (const zone of game.zones.zones) {
      if (!zone.alive) continue;
      if (zone.zone === 'water' && zone.tags.has('energized')) live = true;
      else if (zone.tags.has('outlet')) socket = zone;
    }
    if (live || !socket || this.stepTime > FALLBACK_RELEASE) {
      // The floor is live: now somebody walks in to find out.
      if (!this.released) this.release(0.5, 0.6);
      this.say(live ? 'IT IS LIVE! WATCH THEM WALK INTO IT' : 'THROW SOMETHING AT THEM');
      this.armed();
      if (!player.held) {
        const weapon = this.weapon();
        if (weapon) this.pointAt(weapon);
      }
      return;
    }
    let bottle = player.held && player.held.def.id === 'bottle' ? player.held : null;
    if (!bottle) bottle = game.objects.find((o) => o.alive && o.def.id === 'bottle') ?? null;
    if (!bottle) bottle = this.dropNear('bottle');
    if (!bottle) return;
    if (player.held === bottle) {
      g.icon = 'throw';
      this.overHead();
      g.line = 'arc';
      g.tx = socket.x + 16;
      g.ty = socket.y + 22;
      this.say('THROW THE WATER AT THE SOCKET');
    } else {
      if (!player.held) this.pointAt(bottle);
      else this.focus = bottle;
      this.say(this.touch ? 'TAP THE BOTTLE TO PICK IT UP' : 'PICK UP THE BOTTLE');
    }
  }

  /** 3. Dash out of the way, then answer. */
  private updateDash(): void {
    const game = this.game;
    const g = this.guide;
    const player = game.player;
    if (!this.released) this.release(0.6, 1.2);
    if (player.dashTime > 0) this.dashed = true;
    this.armed();
    const enemy = this.nearestEnemy();
    if (!this.dashed) {
      if (enemy && Math.hypot(enemy.body.x - player.body.x, enemy.body.y - player.body.y) < 190) {
        g.icon = 'dash';
        this.overHead();
      }
      this.say(this.touch ? 'WHEN IT CHARGES, TAP DODGE' : 'WHEN IT CHARGES, PRESS SPACE TO DASH');
      return;
    }
    // The Trolley has had its charge dodged: anything you throw is enough to finish the lesson.
    if (enemy) enemy.hp = Math.min(enemy.hp, 15);
    if (player.held && enemy) {
      g.icon = 'throw';
      this.overHead();
      g.line = 'arc';
      g.tx = enemy.body.x;
      g.ty = enemy.body.y;
      this.say('NOW THROW IT BACK');
      return;
    }
    const target = this.weapon();
    if (target) this.pointAt(target);
    this.say('DASHED! NOW GRAB THE CHAIR');
  }

  /** 4. The BIG RED BUTTON on a crowd. */
  private updatePower(): void {
    const game = this.game;
    const g = this.guide;
    const player = game.player;
    if (!this.released) this.release(0.12, 0.6);
    this.armed();
    if (!game.abilities.ready('blast')) {
      this.say(game.enemies.some((e) => !e.defeated) ? 'NICE! FINISH THE REST' : 'ONE BUTTON, THE WHOLE CROWD');
      return;
    }
    this.say(this.touch ? 'WHEN THEY BUNCH UP, TAP POWER' : 'AIM AT THE CROWD, PRESS P');
    let n = 0;
    let cx = 0;
    let cy = 0;
    for (const enemy of game.enemies) {
      if (enemy.defeated) continue;
      cx += enemy.body.x;
      cy += enemy.body.y;
      n++;
    }
    if (n >= 3) {
      g.icon = 'power';
      g.x = player.body.x;
      g.y = player.body.y - 78;
      g.line = 'ring';
      g.tx = cx / n;
      g.ty = cy / n;
    }
  }

  /** 5. Feed the pet, then it gets to work. */
  private updatePet(dt: number): void {
    const game = this.game;
    const pet = game.pet;
    if (!pet) {
      if (!this.released) this.release(0.8, 0.8);
      return;
    }
    if (pet.frenzy > 0 && !this.released) {
      // Fed first, then the knock at the door: there is no missing what the treat did.
      game.camera.focus(pet.x, pet.y, 1.1, 1.12);
      this.release(0.9, 0.9);
    }
    if (this.released) {
      this.say('YOUR PET IS ON THE JOB');
      this.armed();
      return;
    }
    if (this.stepTime > FALLBACK_RELEASE) {
      this.release(0.9, 0.9);
      return;
    }
    if (!this.treat || !this.treat.alive) this.treat = this.dropNear(pet.treat);
    const treat = this.treat;
    if (!treat) return;
    this.pointAt(treat);
    this.scent -= dt;
    if (this.scent <= 0) {
      this.scent = 0.28;
      game.particles.burst('steam', treat.body.x, treat.body.y - 10, 1, 46, { dirX: 0, dirY: -1, spread: 0.5 });
      game.particles.burst('star', treat.body.x, treat.body.y - 6, 1, 70);
    }
    this.say(this.touch ? `TAP THE ${pet.treatLabel} TO FEED YOUR PET` : `PICK UP THE ${pet.treatLabel} TO FEED YOUR PET`);
  }

  /**
   * Whoever is still standing must always be answerable: when nothing is left to throw, a chair
   * turns up (and glows), so no lesson can strand the player with an enemy they cannot touch.
   */
  private armed(): void {
    const game = this.game;
    const player = game.player;
    if (player.held || this.stepTime - this.lastDrop < 4) return;
    if (!game.enemies.some((e) => !e.defeated) && game.room.pending.length === 0) return;
    const spare = game.objects.find((o) => o.alive && !o.held && !o.burning && o.def.throwable && !o.def.consume && o.def.id !== 'bottle');
    if (spare) return;
    this.lastDrop = this.stepTime;
    this.dropNear('chair');
  }

  /** Wakes whoever is standing about. */
  private wake(): void {
    for (const enemy of this.game.enemies) {
      if (enemy.defeated) continue;
      enemy.aware = true;
      enemy.aiTimer = 0;
    }
  }

  /** Lets this lesson's movers through the door. */
  private release(gap: number, lead: number): void {
    const room = this.game.room;
    let n = 0;
    room.pending = room.pending.map((spec) =>
      spec.delay === WAITING ? { type: spec.type, delay: room.elapsed + lead + gap * n++ } : spec,
    );
    this.released = true;
  }

  /** The BIG RED BUTTON: owned for good, and ready now. */
  grantPower(announce: boolean): void {
    const game = this.game;
    game.abilities.resetRoom();
    if (game.abilities.owned('blast')) return;
    game.save.data.abilities.push('blast');
    game.save.write();
    document.body.classList.add('has-powers');
    if (!announce) return;
    const pb = game.player.body;
    game.hud.unlock('NEW POWER', 'BIG RED BUTTON', 'boom where you point');
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
