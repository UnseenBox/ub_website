import type { Game } from '../core/Game';
import type { Enemy } from '../entities/Enemy';
import type { PhysicsObject } from '../entities/PhysicsObject';

/**
 * THE CELLAR, 3 A.M.: the director of the very first room.
 *
 * Not a lesson and not a wave list: three set-pieces, each a different kind of bad idea,
 * each one answered by the room itself.
 *
 *   TIMBER      A conga of five walks down an aisle of tall shelving. Throw anything at them and the
 *               shelves come down in a wave, crushing the line from both sides. (If nobody throws,
 *               the shelves go on their own as the lead reaches the end: the moment always happens.)
 *   DANCE FLOOR A radio on the floor switches itself on. Three movers walk into the music, start
 *               to dance, and stumble through the junk laid out in front of them (a rake, a
 *               mousetrap, a banana). Free slapstick; pick them off with anything.
 *   THE FOREMAN Too heavy to hit head-on, behind a shield. Two pairs of shelves are still standing
 *               in his way. Nobody tells you what to do except a glow and, if you are slow, a nudge.
 *
 * The same verb (knock the shelves over) is taught in the first act and tested in the third.
 */

type Phase = 'off' | 'timber' | 'dance' | 'big';

/** Where the aisle starts (towards you) and ends (the door). */
const HALL_X0 = 374;
const LANE_Y = 180;
/** The three pairs that come down on the conga, entrance end first. */
const TIMBER_X: readonly number[] = [840, 740, 640];
/** The two pairs kept for the Foreman, door end first. */
const FOREMAN_X: readonly number[] = [520, 420];
/** When nobody has thrown anything, the first trap springs as the lead mover reaches this x. */
const TIMBER_FALLBACK_X = 560;
/** The Foreman is slow; his trap springs a little earlier, once he is this far down the aisle. */
const FOREMAN_FALLBACK_X = 600;
/** A shelf falls when a mover is between (x - BEHIND) and (x + AHEAD), so it lands on him. */
const BEHIND = 40;
const AHEAD = 130;
/** Seconds between neighbouring pairs, so the fall reads as a wave. */
const WAVE_STAGGER = 0.12;
/** Seconds a pair that has not found a mover waits after the trap springs before it falls anyway. */
const WAVE_PATIENCE = 4.5;
/** Breather between one set-piece ending and the next beginning. */
const BREATHER = 1.4;
/** A fallen shelf crumbles this long after it lands, so the aisle clears for what comes next. */
const CRUMBLE_AFTER = 2.2;
/**
 * The Foreman's health. One falling shelf does 70, whatever his shield is doing, so one shelf
 * is the answer; without it he is a shield of 95 and 70 health to wear down by hand.
 */
const FOREMAN_HP = 70;

interface Pair {
  x: number;
  north: PhysicsObject;
  south: PhysicsObject;
  tipped: boolean;
}

export interface OpeningHooks {
  /** Hands over the BIG RED BUTTON (and says so). */
  givePower(): void;
  /** Makes every object of these ids glow for a moment (called every frame while it should). */
  glow(ids: readonly string[], seconds: number): void;
}

export class Opening {
  phase: Phase = 'off';
  /** The last set-piece is over and the room is empty. */
  done = false;

  private t = 0;
  private quietFor = 0;
  private pairs: Pair[] = [];
  private active: number[] = [];
  private sprung = false;
  private sprungAt = 0;
  private thrown = false;
  private said = new Set<string>();
  private crushed = 0;
  /** Shelves that have landed, and the game time they did. */
  private fallen: Array<{ shelf: PhysicsObject; at: number }> = [];
  private tuned = new WeakSet<Enemy>();

  constructor(private readonly game: Game, private readonly hooks: OpeningHooks) {
    // Whoever throws something while the movers are in the aisle brings the shelves down on them:
    // the throw itself is the trigger, so it never depends on how good the aim is.
    game.bus.on('OBJECT_THROWN', () => {
      if (this.phase !== 'timber' && this.phase !== 'big') return;
      if (game.enemies.some((e) => !e.defeated && e.body.x > HALL_X0 - 20)) this.thrown = true;
    });
    game.bus.on('ENEMY_DEFEATED', (e) => {
      if (this.phase === 'off') return;
      if (e.cause.type !== 'slam') return;
      this.crushed++;
      const b = e.enemy.body;
      // The movers have the last word, once per set-piece.
      const line = e.enemy.type.id === 'bulwark' ? 'THAT IS NOT IN THE CONTRACT.' : 'OSHA WILL HEAR ABOUT THIS.';
      if (!this.said.has('c:' + this.phase)) {
        this.said.add('c:' + this.phase);
        game.popup(line, b.x, b.y - 52, '#fff3d6', 17, 2.4);
      }
    });
    game.bus.on('OBJECT_FALLEN', (e) => {
      if (e.object.def.id === 'bookshelf') this.fallen.push({ shelf: e.object, at: game.time });
    });
  }

  /** Starts a set-piece. `dance` and `big` are also where a resumed or replayed room picks up. */
  start(phase: Exclude<Phase, 'off'>): void {
    const game = this.game;
    this.phase = phase;
    this.done = false;
    this.t = 0;
    this.quietFor = 0;
    this.sprung = false;
    this.thrown = false;
    this.crushed = 0;
    this.said.clear();
    this.findShelves();
    this.guardForeman(phase !== 'big');
    switch (phase) {
      case 'timber':
        this.active = TIMBER_X.slice();
        this.release([1.2, 1.65, 2.1, 2.55, 3]);
        game.popup('3:07 A.M.', game.player.body.x, game.player.body.y - 70, '#fff3d6', 22, 1.8);
        break;
      case 'dance': {
        this.active = [];
        const radio = game.objects.find((o) => o.alive && o.def.id === 'boombox');
        if (radio) {
          // It switches itself on: the music zone does the rest.
          radio.tagFor('playing', 120);
          game.audio.play('boombox', 1);
          game.popup('*CLICK*', radio.body.x, radio.body.y - 24, '#fff3d6', 18, 1.4);
        }
        this.release([1.6, 2.8, 4]);
        break;
      }
      case 'big':
        this.active = FOREMAN_X.slice();
        this.hooks.givePower();
        this.release([1.5, 5, 5.8]);
        break;
    }
  }

  stop(): void {
    this.phase = 'off';
  }

  update(dt: number): void {
    this.crumble();
    if (this.phase === 'off') return;
    this.t += dt;
    const game = this.game;
    const live = game.enemies.filter((e) => !e.defeated);

    this.speak(live);
    if (this.active.length > 0) this.updateShelves(live);
    if (this.phase === 'big') this.updateForeman(live);

    // A set-piece ends when everyone it let in is gone and nobody else is on the way.
    const waiting = game.room.pending.some((spec) => spec.delay !== Infinity);
    if (live.length === 0 && !waiting) {
      this.quietFor += dt;
      if (this.quietFor >= BREATHER) this.next();
    } else {
      this.quietFor = 0;
    }
    // Never stall: a mover stuck somewhere does not stop the show forever.
    if (this.t > 60 && this.phase !== 'big' && !waiting) this.next();
  }

  /** Fallen shelves break apart a couple of seconds after they land. */
  private crumble(): void {
    if (this.fallen.length === 0) return;
    const game = this.game;
    this.fallen = this.fallen.filter((f) => {
      if (!f.shelf.alive) return false;
      if (game.time - f.at < CRUMBLE_AFTER) return true;
      f.shelf.breakApart(game);
      return false;
    });
  }

  /** The aisle's shelving, paired north and south by x. */
  private findShelves(): void {
    const byX = new Map<number, Partial<Pair>>();
    for (const o of this.game.objects) {
      if (!o.alive || o.def.id !== 'bookshelf' || !o.standing) continue;
      const x = Math.round(o.body.x / 10) * 10;
      const entry = byX.get(x) ?? { x, tipped: false };
      if (o.body.y < LANE_Y) entry.north = o;
      else entry.south = o;
      byX.set(x, entry);
    }
    this.pairs = [...byX.values()].filter((p): p is Pair => !!p.north && !!p.south);
  }

  /** Until the Foreman's turn his shelves cannot be knocked over by stray throws (they stay for him). */
  private guardForeman(guard: boolean): void {
    for (const pair of this.pairs) {
      if (!FOREMAN_X.includes(pair.x)) continue;
      for (const shelf of [pair.north, pair.south]) {
        if (guard) shelf.tags.delete('standing');
        else if (shelf.standing) shelf.tags.add('standing');
      }
    }
  }

  private next(): void {
    const game = this.game;
    if (this.phase === 'timber') this.start('dance');
    else if (this.phase === 'dance') this.start('big');
    else {
      this.phase = 'off';
      this.done = true;
      game.hud.hint('THAT WAS THE WARM-UP', '', 3.4);
      // Somebody is knocking at the door: whatever is next is bigger.
      game.audio.play('knock', 1);
    }
  }

  /** Lets the next movers in: one delay per mover, seconds from now. */
  private release(delays: readonly number[]): void {
    const room = this.game.room;
    let k = 0;
    for (let i = 0; i < room.pending.length && k < delays.length; i++) {
      if (room.pending[i]!.delay !== Infinity) continue;
      room.pending[i] = { type: room.pending[i]!.type, delay: room.elapsed + delays[k++]! };
    }
  }

  private updateShelves(live: readonly Enemy[]): void {
    const lead = live.reduce((x, e) => Math.min(x, e.body.x), Infinity);
    const fallback = this.phase === 'big' ? FOREMAN_FALLBACK_X : TIMBER_FALLBACK_X;
    if (!this.sprung && (this.thrown || lead < fallback)) {
      this.sprung = true;
      this.sprungAt = this.t;
    }
    if (!this.sprung) return;
    this.active.forEach((x, i) => {
      const pair = this.pairs.find((p) => p.x === x);
      if (!pair || pair.tipped) return;
      if (this.t - this.sprungAt < i * WAVE_STAGGER) return;
      const under = live.some(
        (e) => e.body.x >= x - BEHIND && e.body.x <= x + AHEAD && Math.abs(e.body.y - LANE_Y) < 90,
      );
      // The Foreman's shelves are kept for him: they only fall on him, never into thin air.
      const patient = this.phase === 'big' ? false : this.t - this.sprungAt > WAVE_PATIENCE;
      if (under || patient) this.topple(pair);
    });
  }

  private topple(pair: Pair): void {
    const game = this.game;
    pair.tipped = true;
    const first = !this.pairs.some((p) => p !== pair && p.tipped && this.active.includes(p.x));
    pair.north.tip(game, 0, 1);
    pair.south.tip(game, 0, -1);
    if (first) {
      game.fx.burst('TIMBER!', pair.x, LANE_Y - 40, 1.6, '#ffd23f', true);
      game.camera.focus(pair.x, LANE_Y, 1.1, 1.1);
      game.slowMotion(0.45, 0.55);
    }
  }

  /** The Foreman's nudges: a glow on what is left standing, then one line if he is nearly on you. */
  private updateForeman(live: readonly Enemy[]): void {
    const game = this.game;
    const foreman = live.find((e) => e.type.id === 'bulwark');
    if (!foreman) return;
    if (!this.tuned.has(foreman)) {
      this.tuned.add(foreman);
      foreman.hp = foreman.maxHp = FOREMAN_HP;
    }
    if (!this.sprung) {
      this.hooks.glow(['bookshelf'], 0.5);
      if (foreman.body.x < 760 && !this.said.has('nudge')) {
        this.said.add('nudge');
        game.hud.hint('REMEMBER THE SHELVES', '', 3);
      }
    }
  }

  /** What the movers say. Short, and only a handful of times. */
  private speak(live: readonly Enemy[]): void {
    const game = this.game;
    const lead = live[0];
    if (!lead || lead.body.x > 940) return;
    const say = (key: string, text: string): void => {
      if (this.said.has(key)) return;
      this.said.add(key);
      game.popup(text, lead.body.x, lead.body.y - 38, '#fff3d6', 17, 2.2);
    };
    if (this.phase === 'timber') say('t', 'FOUND THE CELLAR, BOYS.');
    else if (this.phase === 'dance') say('d', 'IS THAT A RADIO?');
    else if (this.phase === 'big') {
      const foreman = live.find((e) => e.type.id === 'bulwark');
      if (foreman && !this.said.has('f')) {
        this.said.add('f');
        game.popup('I AM THE FOREMAN.', foreman.body.x, foreman.body.y - 44, '#fff3d6', 18, 2.4);
      }
    }
  }

  /** Movers crushed by shelves in the set-piece that just ended (for the caption and the tests). */
  get crushedCount(): number {
    return this.crushed;
  }
}
