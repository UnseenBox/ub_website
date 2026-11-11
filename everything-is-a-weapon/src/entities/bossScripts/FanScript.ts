import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * FAN-TASTIC NIGHTMARE: "it puts the air in despair."
 *
 * A FIGHT IN THE WIND. The whole room has a wind, drawn as drifting arrows on the floor and a
 * compass over his head. It SWINGS from side to side like an oscillating fan, and now and then a
 * GUST surges through. It shoves you, shoves the furniture, and, the part that matters, bends
 * everything you throw: aim for where the wind will take it, not where he is.
 *
 * HIS ARMOUR IS THE AIR. He hovers, and while he is in the air hits only graze him (WHOOSH, 20%).
 * What brings him down is his own attack: when he SWOOPS and misses he crash-lands, blades
 * grinding, and is GROUNDED for a few seconds taking +60%. So the way to hurt him is to bait the dive.
 *
 * ATTACKS (telegraphed, shuffled):
 *   SWOOP      a line and a ring mark where he will dive; he tears through it, then again, then crashes.
 *   TORNADO    twisters form around you, drift toward you and drag you in.
 *   CYCLONE    he spins up, then rings of wind roll out from him: dash through them.
 * Below a quarter health it is TURBO: a stronger wind, more dives, more twisters.
 *
 * THE ENTRANCE. The room goes still, a whine climbs, and he drops out of the ceiling with the blades
 * spinning up; the wind rises with him and shoves everything across the floor. His first move is a swoop.
 */

export const AIRBORNE_GRAZE = 0.2;
export const GROUNDED_BONUS = 1.6;
const HOVER = 34;
const GROUND_SECONDS = 3.6;
const DIVE_WINDUP = 0.9;
const DIVE_SPEED = 640;
const DIVE_LENGTH = 560;
const TORNADO_RADIUS = 52;
const TORNADO_PULL = 190;
const RING_SPEED = 330;
const RING_WIDTH = 26;
const GAP = 3.4;
const GAP_OVERTIME = 2.5;
const GAP_FINALE = 1.4;

export type FanAttack = 'swoop' | 'tornado' | 'cyclone';

interface Tornado { x: number; y: number; life: number; hitCd: number; spin: number }
interface Ring { age: number; hit: boolean }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class FanScript implements BossScript {
  readonly deathText = 'SWITCHED OFF!';

  time = 0;
  finale = false;
  /** Seconds he is on the floor, blades grinding. */
  grounded = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private whooshAt = -9;
  private gap = 2.5;
  private deck: FanAttack[] = [];
  private lastKind: FanAttack | null = null;

  // ── the wind ──
  windBase = 0;
  windAngle = 0;
  windStrength = 0;
  private gustT = 5;
  private gustLeft = 0;
  gusting = false;

  // ── entrance ──
  intro: 'drop' | 'spin' | 'done' = 'drop';
  introT = 0;
  /** How high above his hover height he still is, for the drawing code. */
  dropHeight = 0;
  private landed = false;
  private dropTarget: { x: number; y: number } | null = null;

  // ── attacks ──
  attack: FanAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  // swoop
  dives = 0;
  private divesDone = 0;
  diveFromX = 0;
  diveFromY = 0;
  diveDX = 1;
  diveDY = 0;
  private diveT = 0;
  private diveHit = false;
  // tornado
  tornadoes: Tornado[] = [];
  private marks: Array<{ x: number; y: number }> = [];
  // cyclone
  rings: Ring[] = [];

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.grounded > 0;
  }

  get hoverHeight(): number {
    if (this.grounded > 0) return 0;
    if (this.attack === 'swoop' && this.stage === 'go') return 8;
    return HOVER + this.dropHeight;
  }

  /** Current wind as a vector (unit direction scaled by strength). */
  windVec(): { x: number; y: number } {
    const s = this.windStrength * (this.gusting ? 2.4 : 1) * (this.finale ? 1.3 : 1);
    return { x: Math.cos(this.windAngle) * s, y: Math.sin(this.windAngle) * s };
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.updateWind(game, boss, dt);
    this.applyWind(game, dt);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.updateTornadoes(game, dt);
    this.updateRings(game, dt);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'TURBO!', '#d6efff', true);
    }

    if (this.grounded > 0) {
      this.grounded -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.grounded <= 0) {
        game.fx.burst('WHRRRR!', boss.body.x, boss.body.y - 90, 1.0, '#d6efff', true);
        game.audio.play('hiss', 0.7);
        this.gap = 1.4;
      }
      return;
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'swoop': this.runSwoop(game, boss, dt, overtime); break;
        case 'tornado': this.runTornado(game, boss, overtime); break;
        case 'cyclone': this.runCyclone(game, boss, overtime); break;
      }
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.grounded > 0) return amount * GROUNDED_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.whooshAt > 1.3) {
      this.whooshAt = game.time;
      game.fx.burst('WHOOSH!', boss.body.x, boss.body.y - 86, 0.8, '#d6efff', true);
    }
    return amount * AIRBORNE_GRAZE;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.tornadoes.length = 0;
    this.rings.length = 0;
    this.windStrength = 0;
    game.popup('...whirr... click.', boss.body.x, boss.body.y - 124, '#d6efff', 20, 2.4);
  }

  // ───────────── the wind ─────────────

  private updateWind(game: Game, boss: Enemy, dt: number): void {
    // it swings like an oscillating fan, between two directions
    const swing = Math.sin(this.time * (this.finale ? 0.7 : 0.5)) * 1.0;
    this.windAngle = this.windBase + swing;
    const target = this.intro === 'drop' ? Math.min(1, this.introT / 2.4) * 0.8 : this.grounded > 0 ? 0.25 : 0.8;
    this.windStrength += (target - this.windStrength) * Math.min(1, dt * 1.5);
    if (this.intro === 'done') {
      this.gustT -= dt;
      if (!this.gusting && this.gustT <= 0) {
        this.gusting = true;
        this.gustLeft = 1.8;
        game.fx.burst('GUST!', boss.body.x, boss.body.y - 100, 1.1, '#d6efff', true);
        game.audio.play('hiss', 0.8);
      }
      if (this.gusting) {
        this.gustLeft -= dt;
        if (this.gustLeft <= 0) {
          this.gusting = false;
          this.gustT = 6.5 + Math.random() * 3;
        }
      }
    }
  }

  private applyWind(game: Game, dt: number): void {
    const w = this.windVec();
    if (Math.abs(w.x) + Math.abs(w.y) < 0.02) return;
    const p = game.player;
    if (p.alive) p.body.applyImpulse(w.x * 120 * dt * p.body.mass, w.y * 120 * dt * p.body.mass);
    for (const o of game.objects) {
      if (!o.alive || o.held || o.def.fixed) continue;
      o.body.applyImpulse(w.x * 260 * dt * o.body.mass, w.y * 260 * dt * o.body.mass);
    }
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'drop') {
      if (!this.dropTarget) {
        const bounds = game.world.bounds;
        this.dropTarget = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 - 10 };
        b.x = this.dropTarget.x;
        b.y = this.dropTarget.y;
        this.windBase = Math.random() < 0.5 ? 0 : Math.PI;
        game.camera.focus(b.x, b.y, 2.4, 1.07);
        game.audio.play('hiss', 0.8);
      }
      b.vx = 0;
      b.vy = 0;
      const fall = Math.min(1, this.introT / 2.2);
      this.dropHeight = 280 * (1 - fall * fall);
      boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      if (!this.landed && fall >= 1) {
        this.landed = true;
        this.dropHeight = 0;
        this.intro = 'spin';
        this.introT = 0;
        game.fx.burst('FAN-TASTIC!', b.x, b.y - 100, 1.5, '#d6efff', true);
        game.fx.ring(b.x, b.y, 10, 250, 0.5, 'rgba(214,239,255,0.9)', 5);
        game.audio.play('alarm', 0.6);
        game.camera.punchZoom(0.03);
        game.hitStop(0.05);
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    if (this.introT >= 0.4 && this.introT < 0.45) {
      game.hud.banner('RIDE THE WIND', 'it bends your throws: lead the shot', 3.4);
      this.taunt(game, boss, pickLine(["Let's clear the air.", 'Feeling a draft?', "I'm your biggest fan."]), '#e6f6ff', true);
    }
    if (this.introT >= 1.5) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithSwoop = true): void {
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
    this.gap = 1.2;
    this.windStrength = Math.max(this.windStrength, 0.8);
    this.deck = ['cyclone', 'tornado'];
    if (openWithSwoop) this.beginAttack(game, boss, 'swoop');
  }

  // ───────────── director ─────────────

  private pick(): FanAttack {
    if (this.deck.length === 0) {
      const all: FanAttack[] = ['swoop', 'tornado', 'cyclone'];
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
  beginAttack(game: Game, boss: Enemy, kind: FanAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'swoop':
        this.dives = this.finale ? 4 : boss.phaseIndex >= 1 ? 3 : 2;
        this.divesDone = 0;
        game.fx.burst('SWOOP!', boss.body.x, boss.body.y - 100, 1.25, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.aimDive(game, boss);
        this.taunt(game, boss, pickLine(['Incoming!', 'Hold onto your hat!']));
        break;
      case 'tornado':
        game.fx.burst('TORNADO!', boss.body.x, boss.body.y - 100, 1.25, '#bfe3ff', true);
        this.markTornadoes(game, boss);
        this.taunt(game, boss, pickLine(['Whirl-wind romance!', 'Spin cycle!']));
        break;
      case 'cyclone':
        game.fx.burst('CYCLONE!', boss.body.x, boss.body.y - 100, 1.25, '#d6efff', true);
        game.audio.play('hiss', 0.8);
        this.rings = [];
        this.taunt(game, boss, pickLine(['Blown away!', 'Feel the breeze?']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.banner('TURBO', 'a stronger wind', 2.6);
    game.fx.burst('TURBO!', boss.body.x, boss.body.y - 112, 1.5, '#9fd8ff', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(160,220,255,0.9)', 6);
    game.fx.flash('#d6efff', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'FULL BLAST!', '#d6efff', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e6f6ff', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── SWOOP ─────────────

  private aimDive(game: Game, boss: Enemy): void {
    const b = boss.body;
    const p = game.player.body;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    this.diveDX = dx / d;
    this.diveDY = dy / d;
    this.diveFromX = b.x;
    this.diveFromY = b.y;
    this.diveHit = false;
    this.diveT = 0;
  }

  private runSwoop(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const bounds = game.world.bounds;
    if (this.stage === 'windup') {
      b.vx = 0;
      b.vy = 0;
      // keep tracking you until the last quarter second
      if (this.stageT < DIVE_WINDUP - 0.25) this.aimDive(game, boss);
      boss.facing = Math.atan2(this.diveDY, this.diveDX);
      if (this.stageT >= DIVE_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        this.diveT = 0;
        game.audio.play('swipe', 0.9);
      }
      return;
    }
    if (this.stage === 'go') {
      this.diveT += dt;
      b.vx = this.diveDX * DIVE_SPEED;
      b.vy = this.diveDY * DIVE_SPEED;
      // keep him in the room
      b.x = Math.min(bounds.x1 - 30, Math.max(bounds.x0 + 30, b.x));
      b.y = Math.min(bounds.y1 - 30, Math.max(bounds.y0 + 30, b.y));
      const p = game.player;
      if (!this.diveHit && p.alive && Math.hypot(p.body.x - b.x, p.body.y - b.y) < boss.type.radius + p.body.boundR * 0.9 + 14) {
        this.diveHit = true;
        if (p.hurt(game, 1, 'Fan dive')) p.body.applyImpulse(this.diveDX * 300 * p.body.mass, this.diveDY * 300 * p.body.mass);
      }
      const travelled = Math.hypot(b.x - this.diveFromX, b.y - this.diveFromY);
      if (travelled >= DIVE_LENGTH || this.diveT > 1.2) {
        b.vx = 0;
        b.vy = 0;
        this.divesDone++;
        game.particles.burst('dust', b.x, b.y, 3, 140);
        if (this.divesDone >= this.dives) {
          // out of dives: he crashes
          this.crash(game, boss);
        } else {
          this.stage = 'windup';
          this.stageT = 0;
          this.aimDive(game, boss);
        }
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    if (this.stageT > 0.6) this.endAttack(overtime);
  }

  private crash(game: Game, boss: Enemy): void {
    this.attack = null;
    this.grounded = GROUND_SECONDS;
    boss.squash = 1;
    boss.body.vx = 0;
    boss.body.vy = 0;
    game.fx.burst('CRASH LANDING!', boss.body.x, boss.body.y - 96, 1.4, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 120, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.particles.burst('spark', boss.body.x, boss.body.y - 10, 4, 220, { color: '#ffe066' });
    game.audio.play('hiss', 1);
    game.hitStop(0.08);
    game.hud.banner('GROUNDED', 'hit him while the blades grind', 2.2);
    this.taunt(game, boss, pickLine(['Ugh... my blades...', 'Turbulence!']), '#ffe9a8', true);
  }

  // ───────────── TORNADO ─────────────

  private markTornadoes(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    const n = this.finale ? 4 : boss.phaseIndex >= 1 ? 3 : 2;
    this.marks = [];
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n + Math.random() * 0.8;
      const r = 190 + Math.random() * 90;
      this.marks.push({
        x: Math.min(bounds.x1 - 60, Math.max(bounds.x0 + 60, p.x + Math.cos(a) * r)),
        y: Math.min(bounds.y1 - 60, Math.max(bounds.y0 + 60, p.y + Math.sin(a) * r)),
      });
    }
  }

  private runTornado(game: Game, boss: Enemy, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    if (this.stage === 'windup') {
      if (this.stageT >= 1.1) {
        this.stage = 'go';
        this.stageT = 0;
        for (const m of this.marks) {
          this.tornadoes.push({ x: m.x, y: m.y, life: 6.5, hitCd: 0, spin: 0 });
          game.fx.ring(m.x, m.y, 6, 80, 0.35, 'rgba(190,230,255,0.9)', 4);
        }
        this.marks = [];
        game.audio.play('hiss', 1);
      }
      return;
    }
    if (this.stageT > 1.2) this.endAttack(overtime);
  }

  private updateTornadoes(game: Game, dt: number): void {
    if (this.tornadoes.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.tornadoes.length - 1; i >= 0; i--) {
      const t = this.tornadoes[i]!;
      t.life -= dt;
      t.hitCd -= dt;
      t.spin += dt * 9;
      if (t.life <= 0) {
        this.tornadoes.splice(i, 1);
        continue;
      }
      // drifts toward you, slowly
      if (p.alive) {
        const dx = p.body.x - t.x;
        const dy = p.body.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = this.finale ? 95 : 80;
        t.x = Math.min(bounds.x1 - 30, Math.max(bounds.x0 + 30, t.x + (dx / d) * sp * dt));
        t.y = Math.min(bounds.y1 - 30, Math.max(bounds.y0 + 30, t.y + (dy / d) * sp * dt));
        if (d < TORNADO_PULL) {
          const f = 1 - d / TORNADO_PULL;
          p.body.applyImpulse(-(dx / d) * 280 * f * dt * p.body.mass, -(dy / d) * 280 * f * dt * p.body.mass);
        }
        if (d < TORNADO_RADIUS + p.body.boundR * 0.4 && t.hitCd <= 0 && p.hurt(game, 1, 'Tornado')) {
          t.hitCd = 0.9;
          p.body.applyImpulse((dx / d) * 300 * p.body.mass, (dy / d) * 300 * p.body.mass);
        }
      }
      for (const o of game.objects) {
        if (!o.alive || o.held || o.def.fixed) continue;
        const dx = t.x - o.body.x;
        const dy = t.y - o.body.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < TORNADO_PULL) {
          const f = 1 - d / TORNADO_PULL;
          o.body.applyImpulse((dx / d) * 380 * f * dt * o.body.mass, (dy / d) * 380 * f * dt * o.body.mass);
          o.body.wake();
        }
      }
    }
  }

  // ───────────── CYCLONE ─────────────

  private runCyclone(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const total = this.finale ? 3 : overtime ? 3 : 2;
    if (this.stage === 'windup') {
      if (this.stageT >= 1.0) {
        this.stage = 'go';
        this.stageT = 0;
        this.rings.push({ age: 0, hit: false });
        game.audio.play('hiss', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.rings.length < total && this.stageT > this.rings.length * 0.75) {
        this.rings.push({ age: 0, hit: false });
        game.audio.play('hiss', 0.8);
      }
      if (this.stageT > total * 0.75 + 0.2) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 1.2) this.endAttack(overtime);
  }

  private updateRings(game: Game, dt: number): void {
    if (this.rings.length === 0) return;
    const boss = game.enemies.find((e) => e.script === this);
    if (!boss) return;
    const p = game.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.age += dt;
      const radius = r.age * RING_SPEED;
      if (radius > 600) {
        this.rings.splice(i, 1);
        continue;
      }
      if (!r.hit && p.alive) {
        const d = Math.hypot(p.body.x - boss.body.x, p.body.y - boss.body.y);
        if (Math.abs(d - radius) < RING_WIDTH / 2 + p.body.boundR * 0.4 && p.hurt(game, 1, 'Cyclone')) {
          r.hit = true;
          const dx = p.body.x - boss.body.x;
          const dy = p.body.y - boss.body.y;
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
    const bounds = game.world.bounds;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the wind: drifting chevrons on the floor
    const w = this.windVec();
    const strength = Math.hypot(w.x, w.y);
    if (strength > 0.05) {
      const ang = Math.atan2(w.y, w.x);
      const alpha = Math.min(0.5, 0.1 + 0.16 * strength) * (this.gusting ? 1.6 : 1);
      ctx.strokeStyle = `rgba(220, 245, 255, ${alpha.toFixed(3)})`;
      ctx.lineWidth = this.gusting ? 4 : 2.5;
      const step = 130;
      const drift = (time * 90 * Math.min(2, strength)) % step;
      for (let gx = bounds.x0 + 40; gx < bounds.x1; gx += step) {
        for (let gy = bounds.y0 + 40; gy < bounds.y1; gy += step) {
          const cx = gx + Math.cos(ang) * drift;
          const cy = gy + Math.sin(ang) * drift;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(ang) * 14 - Math.sin(ang) * 9, cy - Math.sin(ang) * 14 + Math.cos(ang) * 9);
          ctx.lineTo(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8);
          ctx.lineTo(cx - Math.cos(ang) * 14 + Math.sin(ang) * 9, cy - Math.sin(ang) * 14 - Math.cos(ang) * 9);
          ctx.stroke();
        }
      }
    }
    // swoop lane
    if (this.attack === 'swoop' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const len = DIVE_LENGTH;
      const nx = -this.diveDY * (boss.type.radius + 8);
      const ny = this.diveDX * (boss.type.radius + 8);
      const x0 = live ? this.diveFromX : b.x;
      const y0 = live ? this.diveFromY : b.y;
      ctx.fillStyle = live ? 'rgba(255, 90, 70, 0.28)' : `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${live ? 0.9 : 0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 + nx, y0 + ny);
      ctx.lineTo(x0 + this.diveDX * len + nx, y0 + this.diveDY * len + ny);
      ctx.lineTo(x0 + this.diveDX * len - nx, y0 + this.diveDY * len - ny);
      ctx.lineTo(x0 - nx, y0 - ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // tornado marks
    for (const m of this.marks) {
      ctx.strokeStyle = `rgba(150, 215, 255, ${0.55 + 0.3 * pulse})`;
      ctx.fillStyle = `rgba(150, 215, 255, ${0.1 + 0.1 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, TORNADO_RADIUS + 14, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // cyclone warning and rings
    if (this.attack === 'cyclone' && this.stage === 'windup') {
      const f = Math.min(1, this.stageT / 1.0);
      ctx.strokeStyle = `rgba(190, 230, 255, ${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 200 * (1 - f) + 70, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const r of this.rings) {
      const radius = r.age * RING_SPEED;
      ctx.strokeStyle = `rgba(210, 240, 255, ${Math.max(0, 1 - radius / 600)})`;
      ctx.lineWidth = RING_WIDTH;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, TAU);
      ctx.stroke();
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    const b = boss.body;
    // tornadoes: stacked spinning funnels
    for (const t of this.tornadoes) {
      const fade = Math.min(1, t.life / 0.8);
      for (let k = 0; k < 7; k++) {
        const u = k / 6;
        const r = (12 + 40 * u) * (0.9 + 0.1 * Math.sin(t.spin + k));
        const y = t.y - 10 - (1 - u) * 56;
        ctx.strokeStyle = `rgba(215, 240, 255, ${(0.75 * fade).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(t.x + Math.sin(t.spin + k) * 4, y, r, r * 0.35, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // the wind compass over his head
    if (this.intro !== 'drop') {
      const w = this.windVec();
      const ang = Math.atan2(w.y, w.x);
      const cx = b.x;
      const cy = b.y - 116;
      ctx.fillStyle = 'rgba(16, 20, 32, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = this.gusting ? '#ffd23f' : '#d6efff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(ang) * 9, cy - Math.sin(ang) * 9);
      ctx.lineTo(cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9);
      ctx.lineTo(cx + Math.cos(ang) * 3 - Math.sin(ang) * 5, cy + Math.sin(ang) * 3 + Math.cos(ang) * 5);
      ctx.moveTo(cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9);
      ctx.lineTo(cx + Math.cos(ang) * 3 + Math.sin(ang) * 5, cy + Math.sin(ang) * 3 - Math.cos(ang) * 5);
      ctx.stroke();
    }
    if (this.grounded > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 24;
        const sy = b.y - 78 + Math.sin(a) * 6;
        ctx.fillStyle = '#ffd23f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 === 0 ? 5 : 2.2;
          const aa = (k * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
