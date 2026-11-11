import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE PIANO SPIDER: "one night only. every night."
 *
 * A FIGHT IN TIME. The whole room runs on his beat. A ring closes in on him once every beat, and
 * everything he does lands on the beat too. Your throws are judged the same way: a hit that lands
 * ON THE BEAT (as the ring reaches him) does ~1.7x, and a chain of them builds PERFECT x2, x3...
 * up to x2.5; an off-beat hit does barely half. Five perfect hits in a row is a CRESCENDO that
 * stuns him. So the skill is not only aim, it is timing.
 *
 * ATTACKS (each counted in beats, each warned a bar ahead):
 *   KEYBOARD     a giant keyboard is painted across the floor; some keys glow, then strike. Stand on the dark ones.
 *   STACCATO     he hops onto you, one circle per beat, three or four in a row. Keep moving.
 *   NOTES        a fan of musical notes on every beat. Thread the gaps.
 *   CRESCENDO    he crouches, then three rings of sound roll out one beat apart. Dash through them.
 * Below a quarter health the tempo jumps: FORTISSIMO.
 *
 * THE ENTRANCE. The lights drop. He lowers himself from the dark on a thread, lands in the middle
 * of the room with a crash of piano wire, and counts you in.
 */

const BPM = 100;
const BPM_OVERTIME = 116;
const BPM_FINALE = 132;
/** How close to the beat counts as on it, in seconds. */
export const BEAT_WINDOW = 0.14;
export const ON_BEAT_BONUS = 1.7;
export const OFF_BEAT_FACTOR = 0.55;
const STREAK_STEP = 0.15;
const MAX_MULT = 2.5;
const CRESCENDO_STREAK = 5;
const KEYS = 8;
const KEY_BAND = 150;
const HOP_RADIUS = 95;
const NOTE_SPEED = 250;
const RING_SPEED = 380;
const RING_WIDTH = 24;

export type PianoAttack = 'keyboard' | 'staccato' | 'notes' | 'crescendo';

interface Note { x: number; y: number; vx: number; vy: number; life: number }
interface Ring { age: number; hit: boolean }
interface Hop { x: number; y: number }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class PianoScript implements BossScript {
  readonly deathText = 'FINALE!';

  time = 0;
  finale = false;
  private tauntAt = -9;
  private tauntedHalf = false;
  private offAt = -9;

  // ── the beat ──
  beat = 0;
  beatT = 0;
  /** Perfect hits in a row. */
  streak = 0;
  lastJudge: 'perfect' | 'off' | null = null;
  judgeAt = -9;

  // ── entrance ──
  intro: 'drop' | 'count' | 'done' = 'drop';
  introT = 0;
  /** How high above the floor he is still hanging, for the drawing code. */
  dropHeight = 0;
  private landed = false;
  private dropTarget: { x: number; y: number } | null = null;

  // ── attacks ──
  attack: PianoAttack | null = null;
  /** Beats since the attack began. */
  step = 0;
  private gap = 4;
  private deck: PianoAttack[] = [];
  private lastKind: PianoAttack | null = null;
  // keyboard
  keyHoriz = true;
  keyCenter = 0;
  keyLit: boolean[] = [];
  keyPhase: 'off' | 'show' | 'warn' | 'strike' = 'off';
  // staccato
  hopTarget: Hop | null = null;
  private hops = 0;
  // notes
  notes: Note[] = [];
  // crescendo
  rings: Ring[] = [];
  private ringX = 0;
  private ringY = 0;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done';
  }

  get bpm(): number {
    return this.finale ? BPM_FINALE : this.phaseOvertime ? BPM_OVERTIME : BPM;
  }

  private phaseOvertime = false;

  get beatLen(): number {
    return 60 / this.bpm;
  }

  /** 0 right after a beat, approaching 1 as the next one arrives. */
  get phase(): number {
    return this.beatT / this.beatLen;
  }

  /** Seconds from the nearest beat. */
  get offBeat(): number {
    return Math.min(this.beatT, this.beatLen - this.beatT);
  }

  get pose(): 'idle' | 'drop' | 'hop' | 'play' | 'crouch' {
    if (this.intro === 'drop') return 'drop';
    if (this.attack === 'staccato') return 'hop';
    if (this.attack === 'keyboard' || this.attack === 'notes') return 'play';
    if (this.attack === 'crescendo') return 'crouch';
    return 'idle';
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.phaseOvertime = boss.phaseIndex >= 1 || this.finale;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      this.updateNotes(game, dt);
      return;
    }
    this.tickBeat(game, boss, dt);
    this.updateNotes(game, dt);
    this.updateRings(game, dt);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    if (this.phaseOvertime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'THE HIGH NOTES!', '#ffe9a8', true);
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack();
    if (!this.attack && boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
    if (this.attack) {
      boss.body.vx = 0;
      boss.body.vy = 0;
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    const on = this.offBeat <= BEAT_WINDOW;
    if (on) {
      this.streak++;
      this.lastJudge = 'perfect';
      this.judgeAt = game.time;
      const mult = Math.min(MAX_MULT, ON_BEAT_BONUS + (this.streak - 1) * STREAK_STEP);
      game.fx.burst(this.streak > 1 ? `PERFECT x${this.streak}` : 'PERFECT!', boss.body.x, boss.body.y - 86, 1.0, '#ffe066', true);
      game.audio.pianoNote(523.25 * Math.pow(2, Math.min(this.streak, 7) / 12), 0.7);
      if (this.streak >= CRESCENDO_STREAK) {
        this.streak = 0;
        this.crescendoStun(game, boss);
      }
      return amount * mult;
    }
    this.streak = 0;
    this.lastJudge = 'off';
    this.judgeAt = game.time;
    if (game.time - this.offAt > 1.1) {
      this.offAt = game.time;
      game.fx.burst('OFF BEAT', boss.body.x, boss.body.y - 86, 0.75, '#c9c2d6', true);
    }
    return amount * OFF_BEAT_FACTOR;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.notes.length = 0;
    this.rings.length = 0;
    this.keyPhase = 'off';
    this.hopTarget = null;
    game.popup('...fermata.', boss.body.x, boss.body.y - 124, '#fff3d6', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'drop') {
      if (!this.dropTarget) {
        const bounds = game.world.bounds;
        this.dropTarget = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 - 20 };
        b.x = this.dropTarget.x;
        b.y = this.dropTarget.y;
        game.camera.focus(b.x, b.y, 2.2, 1.07);
        game.audio.pianoNote(130.81, 0.6);
      }
      b.vx = 0;
      b.vy = 0;
      // lowered on a thread: slow, then a drop
      const fall = Math.min(1, this.introT / 2.2);
      this.dropHeight = 260 * (1 - fall * fall);
      boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      if (!this.landed && fall >= 1) {
        this.landed = true;
        this.dropHeight = 0;
        this.intro = 'count';
        this.introT = 0;
        this.beat = 0;
        this.beatT = 0;
        game.fx.burst('CRASH!', b.x, b.y - 90, 1.4, '#ffe9a8', true);
        game.fx.ring(b.x, b.y, 10, 250, 0.5, 'rgba(255,233,168,0.9)', 5);
        game.audio.pianoNote(65.41, 1);
        game.audio.pianoNote(196, 0.9);
        game.camera.punchZoom(0.03);
        game.hitStop(0.05);
        this.pushAway(game, boss);
      }
      return;
    }
    // count-in: one, two, three, four
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    this.tickBeat(game, boss, dt, true);
    if (this.beat >= 4) this.finishIntro(game, boss);
  }

  private pushAway(game: Game, boss: Enemy): void {
    const b = boss.body;
    const push = (body: { x: number; y: number; mass: number; applyImpulse(x: number, y: number): void }, strength: number): void => {
      const dx = body.x - b.x;
      const dy = body.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 250) return;
      const f = 1 - d / 250;
      body.applyImpulse((dx / d) * strength * f * body.mass, (dy / d) * strength * f * body.mass);
    };
    for (const o of game.objects) {
      if (!o.alive || o.held || o.def.fixed) continue;
      push(o.body, 220);
      o.body.wake();
    }
    push(game.player.body, 280);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithKeys = true): void {
    this.intro = 'done';
    this.introT = 0;
    this.dropHeight = 0;
    this.landed = true;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 0.5;
    this.deck = ['crescendo', 'notes', 'staccato'];
    game.hud.banner('KEEP TIME', 'throw as the ring closes on him', 3);
    this.taunt(game, boss, pickLine(["And a one, and a two...", 'Allegro, please.', "Let's take it from the top."]), '#fff3d6', true);
    if (openWithKeys) this.beginAttack(game, boss, 'keyboard');
  }

  // ───────────── the beat ─────────────

  private tickBeat(game: Game, boss: Enemy, dt: number, counting = false): void {
    this.beatT += dt;
    while (this.beatT >= this.beatLen) {
      this.beatT -= this.beatLen;
      this.beat++;
      game.audio.play('click', counting ? 0.35 : 0.1);
      if (counting) {
        const word = ['ONE', 'TWO', 'THREE', 'FOUR'][(this.beat - 1) % 4];
        if (word && this.beat <= 4) game.fx.burst(word, boss.body.x, boss.body.y - 100, 1.1, '#fff3d6', true);
      } else if (this.attack) {
        this.onAttackBeat(game, boss);
      }
    }
  }

  private crescendoStun(game: Game, boss: Enemy): void {
    boss.stun = Math.max(boss.stun, 1.5);
    boss.squash = 1;
    this.attack = null;
    this.gap = 2.2;
    game.fx.burst('CRESCENDO!', boss.body.x, boss.body.y - 110, 1.5, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 130, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.hitStop(0.08);
    this.taunt(game, boss, 'You... have rhythm?!', '#ffe9a8', true);
  }

  // ───────────── director ─────────────

  private pick(): PianoAttack {
    if (this.deck.length === 0) {
      const all: PianoAttack[] = ['keyboard', 'staccato', 'notes', 'crescendo'];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      if (all[all.length - 1] === this.lastKind) all.unshift(all.pop()!);
      this.deck = all;
    }
    const kind = this.deck.pop()!;
    this.lastKind = kind;
    return kind;
  }

  /** Public so tests can start a specific move. */
  beginAttack(game: Game, boss: Enemy, kind: PianoAttack): void {
    this.attack = kind;
    this.step = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    // start on a beat so every number is in time with the ring
    this.beatT = 0;
    switch (kind) {
      case 'keyboard':
        game.fx.burst('KEYBOARD!', boss.body.x, boss.body.y - 100, 1.25, '#fff3d6', true);
        this.setupKeys(game);
        this.taunt(game, boss, pickLine(['Mind the keys.', 'Scales, anyone?']));
        break;
      case 'staccato':
        game.fx.burst('STACCATO!', boss.body.x, boss.body.y - 100, 1.25, '#ffb38a', true);
        this.hops = 0;
        this.markHop(game);
        this.taunt(game, boss, pickLine(['Short and sharp!', 'Hop to it.']));
        break;
      case 'notes':
        game.fx.burst('NOTES!', boss.body.x, boss.body.y - 100, 1.25, '#9fd8ff', true);
        this.taunt(game, boss, pickLine(['Sing along!', 'Reading music?']));
        break;
      case 'crescendo':
        game.fx.burst('CRESCENDO!', boss.body.x, boss.body.y - 100, 1.3, '#ff9f9f', true);
        game.audio.pianoNote(98, 0.9);
        this.ringX = boss.body.x;
        this.ringY = boss.body.y;
        this.taunt(game, boss, pickLine(['Louder!', 'Fortissimo!']));
        break;
    }
  }

  private endAttack(): void {
    this.attack = null;
    this.keyPhase = 'off';
    this.hopTarget = null;
    this.gap = this.finale ? 1.4 : this.phaseOvertime ? 2.4 : 3.4;
  }

  private onAttackBeat(game: Game, boss: Enemy): void {
    this.step++;
    switch (this.attack) {
      case 'keyboard': this.keyboardBeat(game, boss); break;
      case 'staccato': this.staccatoBeat(game, boss); break;
      case 'notes': this.notesBeat(game, boss); break;
      case 'crescendo': this.crescendoBeat(game, boss); break;
      default: break;
    }
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.2;
    game.hud.banner('FORTISSIMO', 'the tempo jumps', 2.6);
    game.fx.burst('FORTISSIMO!', boss.body.x, boss.body.y - 112, 1.5, '#ff6b6b', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,150,120,0.9)', 6);
    game.fx.flash('#ffe9a8', 0.12);
    game.audio.pianoNote(130.81, 1);
    this.taunt(game, boss, 'ENCORE! ENCORE!', '#ffd0a0', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#fff3d6', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 130, color, 19, 2.2);
  }

  // ───────────── KEYBOARD ─────────────

  private setupKeys(game: Game): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    this.keyHoriz = Math.random() < 0.5;
    const lo = this.keyHoriz ? bounds.y0 : bounds.x0;
    const hi = this.keyHoriz ? bounds.y1 : bounds.x1;
    const at = this.keyHoriz ? p.y : p.x;
    this.keyCenter = Math.min(hi - KEY_BAND / 2, Math.max(lo + KEY_BAND / 2, at));
    const count = this.finale ? 5 : this.phaseOvertime ? 4 : 3;
    const lit = new Array<boolean>(KEYS).fill(false);
    let n = 0;
    while (n < count) {
      const k = Math.floor(Math.random() * KEYS);
      if (!lit[k]) {
        lit[k] = true;
        n++;
      }
    }
    this.keyLit = lit;
    this.keyPhase = 'show';
  }

  private keyRect(game: Game, k: number): { x: number; y: number; w: number; h: number } {
    const bounds = game.world.bounds;
    if (this.keyHoriz) {
      const w = (bounds.x1 - bounds.x0) / KEYS;
      return { x: bounds.x0 + k * w, y: this.keyCenter - KEY_BAND / 2, w, h: KEY_BAND };
    }
    const h = (bounds.y1 - bounds.y0) / KEYS;
    return { x: this.keyCenter - KEY_BAND / 2, y: bounds.y0 + k * h, w: KEY_BAND, h };
  }

  private keyboardBeat(game: Game, boss: Enemy): void {
    if (this.step === 1) this.keyPhase = 'warn';
    if (this.step === 3) {
      // warning flash: one beat to move
      this.keyPhase = 'warn';
    }
    if (this.step === 4) {
      this.keyPhase = 'strike';
      game.audio.pianoNote(261.63, 1);
      game.audio.pianoNote(329.63, 0.8);
      game.audio.pianoNote(392, 0.8);
      const p = game.player;
      for (let k = 0; k < KEYS; k++) {
        if (!this.keyLit[k]) continue;
        const r = this.keyRect(game, k);
        game.fx.ring(r.x + r.w / 2, r.y + r.h / 2, 6, 40, 0.3, 'rgba(255,233,168,0.9)', 3);
        if (p.alive && p.body.x > r.x - 8 && p.body.x < r.x + r.w + 8 && p.body.y > r.y - 8 && p.body.y < r.y + r.h + 8 && p.hurt(game, 1, 'Piano key')) {
          p.body.applyImpulse(0, -240 * p.body.mass);
        }
      }
    }
    if (this.step >= 6) {
      this.keyPhase = 'off';
      this.endAttack();
    }
    void boss;
  }

  // ───────────── STACCATO ─────────────

  private markHop(game: Game): void {
    const p = game.player.body;
    this.hopTarget = { x: p.x, y: p.y };
  }

  private staccatoBeat(game: Game, boss: Enemy): void {
    const total = this.finale ? 5 : this.phaseOvertime ? 4 : 3;
    if (this.hops < total && this.hopTarget) {
      const t = this.hopTarget;
      const b = boss.body;
      // he lands on the circle that was marked a beat ago
      b.x = t.x;
      b.y = t.y;
      b.vx = 0;
      b.vy = 0;
      boss.squash = 1;
      this.hops++;
      game.audio.pianoNote(196 + this.hops * 40, 0.9);
      game.fx.ring(t.x, t.y, 8, HOP_RADIUS + 20, 0.35, 'rgba(255,180,120,0.9)', 4);
      game.particles.burst('dust', t.x, t.y, 3, 120);
      const p = game.player;
      if (p.alive && Math.hypot(p.body.x - t.x, p.body.y - t.y) < HOP_RADIUS + p.body.boundR * 0.4 && p.hurt(game, 1, 'Staccato')) {
        const dx = p.body.x - t.x;
        const dy = p.body.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        p.body.applyImpulse((dx / d) * 280 * p.body.mass, (dy / d) * 280 * p.body.mass);
      }
      for (const o of game.objects) {
        if (!o.alive || o.held || o.def.fixed) continue;
        if (Math.hypot(o.body.x - t.x, o.body.y - t.y) < HOP_RADIUS + o.body.boundR) {
          o.body.vz = Math.max(o.body.vz, 160);
          o.body.wake();
        }
      }
      if (this.hops < total) this.markHop(game);
      else this.hopTarget = null;
    } else {
      this.endAttack();
    }
  }

  // ───────────── NOTES ─────────────

  private notesBeat(game: Game, boss: Enemy): void {
    const beats = this.finale ? 8 : 6;
    if (this.step > beats) {
      this.endAttack();
      return;
    }
    const b = boss.body;
    const aim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    const count = this.finale ? 5 : this.phaseOvertime ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const a = aim + (i - (count - 1) / 2) * 0.4 + (this.step % 2 ? 0.12 : -0.12);
      this.notes.push({
        x: b.x + Math.cos(a) * boss.type.radius,
        y: b.y - 6 + Math.sin(a) * boss.type.radius,
        vx: Math.cos(a) * NOTE_SPEED,
        vy: Math.sin(a) * NOTE_SPEED,
        life: 4.5,
      });
    }
    game.audio.pianoNote(392 + (this.step % 4) * 60, 0.5);
  }

  private updateNotes(game: Game, dt: number): void {
    if (this.notes.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i]!;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.life -= dt;
      if (n.life <= 0 || n.x < bounds.x0 || n.x > bounds.x1 || n.y < bounds.y0 || n.y > bounds.y1) {
        this.notes.splice(i, 1);
        continue;
      }
      const smash = game.objects.find((o) => o.alive && o.thrownByPlayer && o.body.speed() > 160 && Math.hypot(o.body.x - n.x, o.body.y - n.y) < o.body.boundR + 12);
      if (smash) {
        this.notes.splice(i, 1);
        continue;
      }
      if (p.alive && Math.hypot(p.body.x - n.x, p.body.y - n.y) < p.body.boundR + 10) {
        this.notes.splice(i, 1);
        if (p.hurt(game, 1, 'Music note')) p.body.applyImpulse(n.vx * 0.7 * p.body.mass, n.vy * 0.7 * p.body.mass);
      }
    }
  }

  // ───────────── CRESCENDO ─────────────

  private crescendoBeat(game: Game, boss: Enemy): void {
    if (this.step >= 3 && this.step <= 5) {
      this.rings.push({ age: 0, hit: false });
      this.ringX = boss.body.x;
      this.ringY = boss.body.y;
      game.audio.pianoNote(130.81 * (1 + (this.step - 3) * 0.25), 1);
      game.fx.ring(boss.body.x, boss.body.y, 8, 90, 0.3, 'rgba(255,233,168,0.9)', 4);
    }
    if (this.step >= 6) this.endAttack();
  }

  private updateRings(game: Game, dt: number): void {
    if (this.rings.length === 0) return;
    const p = game.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.age += dt;
      const radius = r.age * RING_SPEED;
      if (radius > 560) {
        this.rings.splice(i, 1);
        continue;
      }
      if (!r.hit && p.alive) {
        const d = Math.hypot(p.body.x - this.ringX, p.body.y - this.ringY);
        if (Math.abs(d - radius) < RING_WIDTH / 2 + p.body.boundR * 0.4 && p.hurt(game, 1, 'Crescendo')) {
          r.hit = true;
          const dx = p.body.x - this.ringX;
          const dy = p.body.y - this.ringY;
          const dd = Math.hypot(dx, dy) || 1;
          p.body.applyImpulse((dx / dd) * 260 * p.body.mass, (dy / dd) * 260 * p.body.mass);
        }
      }
    }
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the beat ring: closes on him once a beat, and flashes as it lands
    if (this.intro !== 'drop') {
      const closing = 1 - this.phase;
      const r = boss.type.radius + 8 + 110 * closing;
      const near = this.offBeat <= BEAT_WINDOW;
      ctx.strokeStyle = near ? 'rgba(255, 224, 102, 0.95)' : `rgba(255, 243, 214, ${0.25 + 0.4 * (1 - closing)})`;
      ctx.lineWidth = near ? 6 : 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, TAU);
      ctx.stroke();
      if (near) {
        ctx.fillStyle = 'rgba(255, 224, 102, 0.12)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, boss.type.radius + 8, 0, TAU);
        ctx.fill();
      }
    }
    // the giant keyboard
    if (this.keyPhase !== 'off') this.drawKeyboard(ctx, game, pulse);
    // staccato: where he lands next
    if (this.hopTarget) {
      const t = this.hopTarget;
      ctx.fillStyle = `rgba(255, 140, 90, ${0.14 + 0.14 * pulse})`;
      ctx.strokeStyle = `rgba(255, 170, 120, ${0.6 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, HOP_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(t.x, t.y, HOP_RADIUS * (1 - this.phase), 0, TAU);
      ctx.stroke();
    }
    // crescendo: the crouch (a shrinking warning) and the rolling rings
    if (this.attack === 'crescendo' && this.step < 3) {
      ctx.strokeStyle = `rgba(255, 150, 130, ${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 150 + 140 * (1 - (this.step + this.phase) / 3), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const r of this.rings) {
      const radius = r.age * RING_SPEED;
      ctx.strokeStyle = `rgba(255, 214, 120, ${Math.max(0, 1 - radius / 560)})`;
      ctx.lineWidth = RING_WIDTH;
      ctx.beginPath();
      ctx.arc(this.ringX, this.ringY, radius, 0, TAU);
      ctx.stroke();
    }
  }

  private drawKeyboard(ctx: Ctx, game: Game, pulse: number): void {
    const strike = this.keyPhase === 'strike';
    const warn = this.keyPhase === 'warn';
    for (let k = 0; k < KEYS; k++) {
      const r = this.keyRect(game, k);
      const lit = this.keyLit[k];
      let fill = 'rgba(250, 250, 245, 0.35)';
      if (lit) {
        if (strike) fill = 'rgba(255, 233, 120, 0.8)';
        else if (warn && this.step >= 3) fill = `rgba(255, 70, 70, ${0.4 + 0.3 * pulse})`;
        else if (warn) fill = 'rgba(255, 190, 90, 0.5)';
        else fill = 'rgba(255, 190, 90, 0.3)';
      }
      ctx.fillStyle = fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(20, 16, 28, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      // black keys sit between the white ones
      if (k < KEYS - 1 && k !== 2) {
        ctx.fillStyle = 'rgba(20, 16, 28, 0.55)';
        if (this.keyHoriz) ctx.fillRect(r.x + r.w * 0.72, r.y, r.w * 0.56, r.h * 0.6);
        else ctx.fillRect(r.x, r.y + r.h * 0.72, r.w * 0.6, r.h * 0.56);
      }
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    // the lights drop for his entrance
    if (this.intro === 'drop' && !boss.defeated) {
      const dark = Math.min(0.55, this.introT * 0.5);
      const bounds = game.world.bounds;
      const spot = ctx.createRadialGradient(boss.body.x, boss.body.y, 80, boss.body.x, boss.body.y, 440);
      spot.addColorStop(0, 'rgba(8, 6, 22, 0)');
      spot.addColorStop(1, `rgba(8, 6, 22, ${dark.toFixed(3)})`);
      ctx.fillStyle = spot;
      ctx.fillRect(bounds.x0 - 120, bounds.y0 - 120, bounds.x1 - bounds.x0 + 240, bounds.y1 - bounds.y0 + 240);
      // the thread he hangs from
      if (this.dropHeight > 1) {
        ctx.strokeStyle = 'rgba(240, 240, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(boss.body.x, boss.body.y - this.dropHeight - 60);
        ctx.lineTo(boss.body.x, boss.body.y - this.dropHeight - 700);
        ctx.stroke();
      }
    }
    // musical notes in flight
    for (const n of this.notes) {
      const a = Math.atan2(n.vy, n.vx);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(Math.sin(time * 8 + n.x) * 0.25);
      ctx.fillStyle = '#fff3d6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 4, 8, 6, -0.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 2);
      ctx.lineTo(6, -16);
      ctx.lineTo(14, -10);
      ctx.stroke();
      ctx.restore();
      void a;
    }
    // the streak: pips over his head
    if (this.intro === 'done' && !boss.defeated) {
      for (let i = 0; i < CRESCENDO_STREAK; i++) {
        ctx.fillStyle = i < this.streak ? '#ffe066' : 'rgba(255,255,255,0.25)';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(boss.body.x + (i - (CRESCENDO_STREAK - 1) / 2) * 16, boss.body.y - 122, 5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
