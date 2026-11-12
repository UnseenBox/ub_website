import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * PRESSURE COOKER: "do not remove the lid. it will."
 *
 * A FIGHT ABOUT PRESSURE. He has a gauge, and the gauge is the whole fight. The lid is on, so your hits
 * mostly bounce (SEALED, 40%), BUT every hit you land, and every second that passes, builds pressure.
 * When the gauge is full the lid BLOWS: a telegraphed blast ring, and then the lid is off and he is
 * VENTED for a few seconds, taking +70%. Then the lid clamps back and the gauge starts from zero.
 *
 * So you choose how fast it goes: hit him hard and the blast comes sooner, but you must be OUTSIDE the
 * ring when it does, and what you get for it is the window. His own moves feed the gauge too.
 *
 * ATTACKS (telegraphed, shuffled):
 *   VENTS     rings are marked on the floor around you; they erupt in steam, which stays and burns.
 *   FLOP      a marker tracks you, then locks; he hops there and lands flat. Don't be under it.
 *   WHISTLE   he shrieks (and the gauge jumps): rings of steam roll out. Dash through.
 * Below a quarter health it is BOILING OVER: the gauge climbs faster, more vents, more rings.
 *
 * THE ENTRANCE. A kettle whistle rises, he rattles in at the middle of the room and the lid shakes
 * harder and harder until it pops off and clangs back down. Then he opens with a set of vents.
 */

export const SEALED_CHIP = 0.4;
export const VENTED_BONUS = 1.7;
const PRESSURE_PER_SEC = 0.04;
/** How much of the gauge a hit worth the boss's whole health would build. */
const HIT_PRESSURE = 3.2;
const BLOW_RADIUS = 245;
const BLOW_WINDUP = 1.7;
const VENT_SECONDS = 4.2;
const VENT_SECONDS_FINALE = 3.6;
const VENT_RADIUS = 64;
const FLOP_RADIUS = 118;
const RING_SPEED = 300;
const RING_WIDTH = 26;
const GAP = 3.0;
const GAP_OVERTIME = 2.4;
const GAP_FINALE = 1.6;

export type CookerAttack = 'vents' | 'flop' | 'whistle';

interface Vent { x: number; y: number; t: number; done: boolean }
interface Ring { age: number; hit: boolean }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class CookerScript implements BossScript {
  readonly deathText = 'DEPRESSURIZED!';

  time = 0;
  finale = false;
  /** The gauge, 0..1. */
  pressure = 0;
  /** Seconds he is vented (lid off), taking bonus damage. */
  vented = 0;
  /** lid animation for the drawing code */
  lid: 'on' | 'flying' | 'down' = 'on';
  lidT = 0;
  lidX = 0;
  lidY = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private chipAt = -9;
  private gap = 2.5;
  private deck: CookerAttack[] = [];
  private lastKind: CookerAttack | null = null;

  intro: 'rattle' | 'done' = 'rattle';
  introT = 0;
  private lidPopped = false;

  attack: CookerAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  /** True while the blast is winding up. */
  blowing = false;
  private blowT = 0;
  vents: Vent[] = [];
  // flop
  flopX = 0;
  flopY = 0;
  private flopFromX = 0;
  private flopFromY = 0;
  private flopHit = false;
  // whistle
  rings: Ring[] = [];

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.vented > 0 || this.blowing;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.updateVents(game, dt);
    this.updateRings(game, boss, dt);
    this.updateLid(dt);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'BOILING OVER!', '#ff9f7a', true);
    }

    if (this.vented > 0) {
      this.vented -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.vented <= 0) this.clampLid(game, boss);
      return;
    }
    if (this.blowing) {
      this.runBlow(game, boss, dt);
      return;
    }
    // the gauge climbs with time
    this.pressure = Math.min(1, this.pressure + dt * PRESSURE_PER_SEC * (this.finale ? 1.8 : overtime ? 1.35 : 1));
    if (this.pressure >= 1) {
      this.beginBlow(game, boss);
      return;
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'vents': this.runVents(game, boss, overtime); break;
        case 'flop': this.runFlop(game, boss, dt, overtime); break;
        case 'whistle': this.runWhistle(game, boss, overtime); break;
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
    if (this.vented > 0) return amount * VENTED_BONUS;
    // every hit builds pressure, even the ones that bounce
    if (!this.blowing) this.pressure = Math.min(1, this.pressure + (amount / boss.maxHp) * HIT_PRESSURE);
    boss.blockFlash = 1;
    if (game.time - this.chipAt > 1.3) {
      this.chipAt = game.time;
      game.fx.burst('SEALED!', boss.body.x, boss.body.y - 96, 0.8, '#d6efff', true);
    }
    return amount * SEALED_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.blowing = false;
    this.vents.length = 0;
    this.rings.length = 0;
    game.popup('...pshhhh.', boss.body.x, boss.body.y - 124, '#d6efff', 20, 2.4);
  }

  // ───────────── the blast and the lid ─────────────

  private beginBlow(game: Game, boss: Enemy): void {
    this.blowing = true;
    this.blowT = 0;
    this.attack = null;
    this.vents.length = 0;
    this.rings.length = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    game.fx.burst('PRESSURE!', boss.body.x, boss.body.y - 104, 1.4, '#ff9f9f', true);
    game.audio.play('kettle', 1);
    game.hud.hint('GET CLEAR', 'the lid is about to blow', 1.9);
    this.taunt(game, boss, pickLine(["I can't hold it!", 'STAND BACK!']), '#ff9f7a', true);
  }

  private runBlow(game: Game, boss: Enemy, dt: number): void {
    this.blowT += dt;
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    if (this.blowT < BLOW_WINDUP) return;
    this.blowing = false;
    this.vented = this.finale ? VENT_SECONDS_FINALE : VENT_SECONDS;
    this.pressure = 0;
    boss.squash = 1;
    // the lid shoots up and lands to one side
    this.lid = 'flying';
    this.lidT = 0;
    const a = Math.random() * TAU;
    const bounds = game.world.bounds;
    this.lidX = Math.min(bounds.x1 - 50, Math.max(bounds.x0 + 50, b.x + Math.cos(a) * 170));
    this.lidY = Math.min(bounds.y1 - 50, Math.max(bounds.y0 + 50, b.y + Math.sin(a) * 170));
    game.fx.burst('BOOM!', b.x, b.y - 100, 1.5, '#ffe9a8', true);
    game.fx.ring(b.x, b.y, 10, BLOW_RADIUS, 0.45, 'rgba(228,247,251,0.95)', 6);
    game.particles.burst('dust', b.x, b.y - 20, 8, 320, { color: '#e4f7fb' });
    game.audio.play('explosion', 0.9);
    game.hitStop(0.09);
    const p = game.player;
    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (p.alive && d < BLOW_RADIUS && p.hurt(game, 1, 'Lid blast')) {
      p.body.applyImpulse((dx / d) * 340 * p.body.mass, (dy / d) * 340 * p.body.mass);
    }
    game.hud.hint('VENTED', 'the lid is off: hit him now', 2.2);
    this.taunt(game, boss, 'Phew... that is better.', '#d6efff', true);
  }

  private clampLid(game: Game, boss: Enemy): void {
    this.lid = 'on';
    this.lidT = 0;
    this.gap = 1.2;
    game.fx.burst('CLANG!', boss.body.x, boss.body.y - 96, 1.1, '#d6efff', true);
    game.audio.play('gong', 0.7);
    boss.squash = 0.6;
  }

  private updateLid(dt: number): void {
    if (this.lid === 'flying') {
      this.lidT += dt;
      if (this.lidT >= 1.0) this.lid = 'down';
    }
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    if (this.introT === dt) {
      const bounds = game.world.bounds;
      b.x = (bounds.x0 + bounds.x1) / 2;
      b.y = (bounds.y0 + bounds.y1) / 2 - 10;
      game.camera.focus(b.x, b.y, 3.0, 1.05);
      game.audio.play('kettle', 1);
    }
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    this.pressure = Math.min(1, this.introT / 2.4);
    if (!this.lidPopped && this.introT >= 2.4) {
      this.lidPopped = true;
      this.lid = 'flying';
      this.lidT = 0;
      this.lidX = b.x + 130;
      this.lidY = b.y + 40;
      game.fx.burst('PSSSSHH!', b.x, b.y - 100, 1.4, '#e4f7fb', true);
      game.fx.ring(b.x, b.y, 10, 150, 0.4, 'rgba(228,247,251,0.9)', 5);
      game.audio.play('hiss', 1);
      game.camera.punchZoom(0.03);
    }
    if (this.introT >= 3.4) {
      this.lid = 'on';
      this.lidT = 0;
      game.fx.burst('PRESSURE COOKER!', b.x, b.y - 104, 1.4, '#e4f7fb', true);
      game.audio.play('gong', 0.8);
      game.hitStop(0.05);
      game.hint('WATCH THE GAUGE', 'hits build pressure: be outside the blast when it blows', 3.8, 'boss:CookerScript');
      this.taunt(game, boss, pickLine(["Don't open me!", 'Stay calm... STAY CALM!']), '#e4f7fb', true);
      this.finishIntro(game, boss);
    }
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithVents = true): void {
    this.intro = 'done';
    this.introT = 0;
    this.lid = 'on';
    this.pressure = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.2;
    this.deck = ['whistle', 'flop'];
    if (openWithVents) this.beginAttack(game, boss, 'vents');
  }

  // ───────────── director ─────────────

  private pick(): CookerAttack {
    if (this.deck.length === 0) {
      const all: CookerAttack[] = ['vents', 'flop', 'whistle'];
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
  beginAttack(game: Game, boss: Enemy, kind: CookerAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'vents':
        this.markVents(game, boss);
        game.fx.burst('VENTS!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Steam time!', 'Let off some steam!']));
        break;
      case 'flop':
        this.aimFlop(game);
        this.flopHit = false;
        game.fx.burst('FLOP!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Heads up!', 'Sit still!']));
        break;
      case 'whistle':
        this.rings = [];
        game.fx.burst('WHISTLE!', boss.body.x, boss.body.y - 100, 1.2, '#d6efff', true);
        game.audio.play('kettle', 0.9);
        this.taunt(game, boss, pickLine(['Eeeeeee!', 'Whistle while you work!']));
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
    game.hud.hint('BOILING OVER', 'the gauge climbs faster', 2.6);
    game.fx.burst('BOILING OVER!', boss.body.x, boss.body.y - 112, 1.5, '#ff9f7a', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,150,120,0.9)', 6);
    game.fx.flash('#ffb08a', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'IT ALL COMES OUT NOW!', '#ff9f7a', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e4f7fb', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── VENTS ─────────────

  private markVents(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    const n = this.finale ? 6 : boss.phaseIndex >= 1 ? 5 : 4;
    this.vents = [];
    for (let i = 0; i < n; i++) {
      // the first is right on you; the rest scatter around you
      const a = Math.random() * TAU;
      const r = i === 0 ? 0 : 90 + Math.random() * 170;
      this.vents.push({
        x: Math.min(bounds.x1 - 50, Math.max(bounds.x0 + 50, p.x + Math.cos(a) * r)),
        y: Math.min(bounds.y1 - 50, Math.max(bounds.y0 + 50, p.y + Math.sin(a) * r)),
        t: 0,
        done: false,
      });
    }
  }

  private runVents(game: Game, boss: Enemy, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    const warn = this.finale ? 1.0 : 1.25;
    if (this.stage === 'windup' && this.stageT >= warn) {
      this.stage = 'go';
      this.stageT = 0;
      const p = game.player;
      for (const v of this.vents) {
        v.done = true;
        game.fx.ring(v.x, v.y, 6, VENT_RADIUS, 0.3, 'rgba(228,247,251,0.95)', 4);
        game.particles.burst('dust', v.x, v.y - 6, 4, 200, { color: '#e4f7fb' });
        game.zones.spawn(game, 'steam', v.x, v.y, VENT_RADIUS - 8, { ttl: 2.6 });
        if (p.alive && Math.hypot(p.body.x - v.x, p.body.y - v.y) < VENT_RADIUS + p.body.boundR * 0.3) {
          if (p.hurt(game, 1, 'Steam vent')) {
            const d = Math.hypot(p.body.x - v.x, p.body.y - v.y) || 1;
            p.body.applyImpulse(((p.body.x - v.x) / d) * 240 * p.body.mass, ((p.body.y - v.y) / d) * 240 * p.body.mass);
          }
        }
      }
      game.audio.play('hiss', 1);
      return;
    }
    if (this.stage === 'go' && this.stageT > 0.5) {
      this.vents = [];
      this.stage = 'recover';
      this.stageT = 0;
    }
    if (this.stage === 'recover' && this.stageT > 0.7) this.endAttack(overtime);
  }

  private updateVents(game: Game, dt: number): void {
    void game;
    for (const v of this.vents) v.t += dt;
  }

  // ───────────── FLOP ─────────────

  private aimFlop(game: Game): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    this.flopX = Math.min(bounds.x1 - 70, Math.max(bounds.x0 + 70, p.x));
    this.flopY = Math.min(bounds.y1 - 70, Math.max(bounds.y0 + 70, p.y));
  }

  private runFlop(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const windup = this.finale ? 1.0 : 1.3;
    if (this.stage === 'windup') {
      b.vx = 0;
      b.vy = 0;
      // the marker tracks you until the last third of a second
      if (this.stageT < windup - 0.35) this.aimFlop(game);
      boss.facing = Math.atan2(this.flopY - b.y, this.flopX - b.x);
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.flopFromX = b.x;
        this.flopFromY = b.y;
        game.audio.play('boing', 0.9);
      }
      return;
    }
    if (this.stage === 'go') {
      // a quick hop onto the marker
      const u = Math.min(1, this.stageT / 0.4);
      const e = 1 - (1 - u) * (1 - u);
      b.x = this.flopFromX + (this.flopX - this.flopFromX) * e;
      b.y = this.flopFromY + (this.flopY - this.flopFromY) * e;
      b.vx = 0;
      b.vy = 0;
      if (u >= 1) {
        this.stage = 'recover';
        this.stageT = 0;
        game.fx.burst('SPLAT!', b.x, b.y - 90, 1.3, '#ffe9a8', true);
        game.fx.ring(b.x, b.y, 10, FLOP_RADIUS, 0.4, 'rgba(228,247,251,0.95)', 6);
        game.particles.burst('dust', b.x, b.y - 8, 6, 280, { color: '#e4f7fb' });
        game.zones.spawn(game, 'steam', b.x, b.y, 56, { ttl: 2.2 });
        game.audio.play('stamp', 1);
        game.hitStop(0.07);
        boss.squash = 1;
        const p = game.player;
        const dx = p.body.x - b.x;
        const dy = p.body.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (p.alive && !this.flopHit && d < FLOP_RADIUS + boss.type.radius * 0.4 && p.hurt(game, 1, 'Flop')) {
          this.flopHit = true;
          p.body.applyImpulse((dx / d) * 320 * p.body.mass, (dy / d) * 320 * p.body.mass);
        }
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    if (this.stageT > 1.0) this.endAttack(overtime);
    void dt;
  }

  // ───────────── WHISTLE ─────────────

  private runWhistle(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const total = this.finale ? 3 : overtime ? 3 : 2;
    if (this.stage === 'windup') {
      if (this.stageT >= 1.0) {
        this.stage = 'go';
        this.stageT = 0;
        // the shriek feeds the gauge
        this.pressure = Math.min(0.97, this.pressure + 0.2);
        this.rings.push({ age: 0, hit: false });
        game.audio.play('kettle', 1);
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
    if (this.stageT > 1.1) this.endAttack(overtime);
  }

  private updateRings(game: Game, boss: Enemy, dt: number): void {
    if (this.rings.length === 0) return;
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
        const dx = p.body.x - boss.body.x;
        const dy = p.body.y - boss.body.y;
        const d = Math.hypot(dx, dy);
        if (Math.abs(d - radius) < RING_WIDTH / 2 + p.body.boundR * 0.4 && p.hurt(game, 1, 'Steam ring')) {
          r.hit = true;
          const dd = d || 1;
          p.body.applyImpulse((dx / dd) * 260 * p.body.mass, (dy / dd) * 260 * p.body.mass);
        }
      }
    }
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the blast ring grows as it winds up
    if (this.blowing) {
      const f = Math.min(1, this.blowT / BLOW_WINDUP);
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + 0.16 * f * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.55 + 0.4 * pulse})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BLOW_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(228, 247, 251, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, BLOW_RADIUS * f, 0, TAU);
      ctx.fill();
    }
    // vents: a ring and a dot
    for (const v of this.vents) {
      const f = this.attack === 'vents' && this.stage === 'windup' ? Math.min(1, v.t / 1.25) : 1;
      ctx.fillStyle = v.done ? 'rgba(228,247,251,0.45)' : `rgba(255, 90, 70, ${0.1 + 0.14 * f * pulse})`;
      ctx.strokeStyle = v.done ? 'rgba(228,247,251,0.9)' : `rgba(255, 130, 110, ${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(v.x, v.y, VENT_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 6, 0, TAU);
      ctx.fill();
    }
    // flop marker
    if (this.attack === 'flop' && this.stage === 'windup') {
      ctx.fillStyle = `rgba(255, 90, 70, ${0.12 + 0.14 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.6 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.flopX, this.flopY, FLOP_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.flopX - 10, this.flopY - 10);
      ctx.lineTo(this.flopX + 10, this.flopY + 10);
      ctx.moveTo(this.flopX + 10, this.flopY - 10);
      ctx.lineTo(this.flopX - 10, this.flopY + 10);
      ctx.stroke();
    }
    // whistle warning and rings
    if (this.attack === 'whistle' && this.stage === 'windup') {
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
      ctx.strokeStyle = `rgba(228, 247, 251, ${Math.max(0, 1 - radius / 600)})`;
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
    // the flying lid and the lid lying on the floor
    if (this.lid === 'flying') {
      const u = Math.min(1, this.lidT / 1.0);
      const lx = b.x + (this.lidX - b.x) * u;
      const ly = b.y + (this.lidY - b.y) * u - Math.sin(u * Math.PI) * 220 - (1 - u) * 50;
      this.drawLid(ctx, lx, ly, u * 14);
    } else if (this.lid === 'down') {
      this.drawLid(ctx, this.lidX, this.lidY - 6, 0);
    }
    // the gauge over his head
    const cx = b.x;
    const cy = b.y - 112;
    ctx.fillStyle = 'rgba(16, 20, 32, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    const f = this.vented > 0 ? 0 : this.pressure;
    ctx.strokeStyle = f > 0.8 ? (Math.sin(time * 22) > 0 ? '#ff5a4e' : '#ffd23f') : f > 0.5 ? '#ffb347' : '#8fdc8f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, -Math.PI / 2, -Math.PI / 2 + TAU * f);
    ctx.stroke();
    if (this.vented > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 82 + Math.sin(a) * 6;
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

  private drawLid(ctx: Ctx, x: number, y: number, spin: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 11, 0, 0, TAU);
    ctx.fillStyle = '#b8b0a0';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#6e675a';
    ctx.fillRect(-5, -10, 10, 8);
    ctx.restore();
  }
}
