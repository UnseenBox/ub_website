import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { PhysicsObject } from '../PhysicsObject';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * POPCORN APOCALYPSE: "fresh, hot, and aimed at you."
 *
 * A FIGHT ABOUT HOT POTATOES. He lobs KERNEL BOMBS: every one has a fuse ring that shrinks, and when it
 * runs out it bursts in a ring of popping kernels. A burst hurts whoever is inside it. So a bomb is
 * a problem for you AND a weapon: pick it up and throw it back, because a bomb that bursts on HIM
 * takes a big bite out of his health. Ordinary hits barely scratch a tub this greasy (CHIP).
 *
 * ATTACKS (telegraphed, shuffled):
 *   LOB       he pops across the room (a ring marks where) and lobs bombs at you.
 *   SPRAY     a cone of kernels from his mouth: the cone is drawn, step out of it.
 *   OVERFLOW  he boils: a growing circle, then it blows. He is left an EMPTY TUB, SPENT for a few seconds
 *             taking +50%, and the overflow leaves bombs on the floor to throw at him.
 * Below a quarter health: EXTRA BUTTER, shorter fuses, more bombs, faster moves.
 *
 * THE ENTRANCE. Nothing happens, then kernels start to pop one by one and pile into the tub. Pop, pop,
 * pop, faster, and then eyes open in the heap. He is untouchable while he fills, and opens with one slow
 * bomb so the rule is obvious: throw it back.
 */

export const CHIP = 0.35;
export const SPENT_BONUS = 1.5;
/** Fraction of his max health a bomb takes when it bursts on him. */
export const BOMB_DAMAGE = 0.12;
const BURST_RADIUS = 112;
const FUSE = 3.4;
const FUSE_FINALE = 2.6;
const MAX_BOMBS = 5;
const SPRAY_RANGE = 440;
const SPRAY_HALF_ARC = 0.36;
const OVERFLOW_RADIUS = 240;
const SPENT_SECONDS = 3.4;
const GAP = 3.0;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.5;

export type PopcornAttack = 'lob' | 'spray' | 'overflow';

interface Bomb { obj: PhysicsObject; fuse: number; max: number }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class PopcornScript implements BossScript {
  readonly deathText = 'POPPED HIS LAST!';

  time = 0;
  finale = false;
  /** Seconds he is an empty tub, taking bonus damage. */
  spent = 0;
  /** How full the tub is, 0..1, for the drawing code. */
  fill = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private chipAt = -9;
  private gap = 2.5;
  private deck: PopcornAttack[] = [];
  private lastKind: PopcornAttack | null = null;

  intro: 'fill' | 'done' = 'fill';
  introT = 0;
  private popped = 0;

  attack: PopcornAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  bombs: Bomb[] = [];
  /** Where he will pop out for a lob. */
  blinkTo: { x: number; y: number } | null = null;
  private blinked = false;
  private lobsLeft = 0;
  private lobsPlanned = 1;
  private lobAt = 0;
  // spray
  sprayAngle = 0;
  private sprayVolleys = 0;
  private sprayHit = false;
  // overflow
  rings: Array<{ age: number; hit: boolean }> = [];

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.spent > 0;
  }

  get heap(): number {
    return this.spent > 0 ? 0 : this.fill;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.updateBombs(game, boss, dt);
    this.updateRings(game, boss, dt);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'EXTRA BUTTER!', '#ffe08a', true);
    }

    if (this.spent > 0) {
      this.spent -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.spent <= 0) {
        this.fill = 0.4;
        game.fx.burst('REFILL!', boss.body.x, boss.body.y - 96, 1.0, '#ffe08a', true);
        game.audio.play('hiss', 0.6);
        this.gap = 1.2;
      }
      return;
    }
    if (this.fill < 1) this.fill = Math.min(1, this.fill + dt * 1.2);
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'lob': this.runLob(game, boss, overtime); break;
        case 'spray': this.runSpray(game, boss, overtime); break;
        case 'overflow': this.runOverflow(game, boss, overtime); break;
      }
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.spent > 0) return amount * SPENT_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.chipAt > 1.3) {
      this.chipAt = game.time;
      game.fx.burst('GREASY!', boss.body.x, boss.body.y - 92, 0.8, '#ffe08a', true);
    }
    return amount * CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.rings.length = 0;
    for (const b of this.bombs) b.obj.destroy(game);
    this.bombs.length = 0;
    game.popup('...pop.', boss.body.x, boss.body.y - 124, '#ffe08a', 20, 2.4);
  }

  aimPoints(): null {
    return null;
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
      game.camera.focus(b.x, b.y, 2.8, 1.06);
    }
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    // the pops come faster and faster
    const target = Math.min(8, Math.floor(Math.pow(this.introT / 2.6, 1.5) * 8));
    while (this.popped < target) {
      this.popped++;
      this.fill = this.popped / 8;
      game.audio.play('stamp', 0.35 + this.popped * 0.05);
      game.fx.burst('pop!', b.x + (Math.random() - 0.5) * 40, b.y - 70 - Math.random() * 18, 0.65, '#fff4c2', true);
    }
    if (this.introT >= 3.0 && this.popped >= 8) {
      game.fx.burst('POPCORN APOCALYPSE!', b.x, b.y - 100, 1.4, '#ffe08a', true);
      game.fx.ring(b.x, b.y, 10, 240, 0.5, 'rgba(255,224,138,0.9)', 5);
      game.audio.play('alarm', 0.6);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      game.hint('MIND THE FUSE', 'throw the bombs back at him', 3.6, 'boss:PopcornScript');
      this.taunt(game, boss, pickLine(['Fresh and HOT!', 'Who ordered extra butter?', 'Movie night!']), '#fff4c2', true);
      this.finishIntro(game, boss);
    }
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithLob = true): void {
    this.intro = 'done';
    this.introT = 0;
    this.fill = 1;
    this.popped = 8;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.2;
    this.deck = ['overflow', 'spray'];
    if (openWithLob) {
      this.beginAttack(game, boss, 'lob');
      this.lobsPlanned = 1;
      this.blinkTo = null;
      this.blinked = true;
    }
  }

  // ───────────── director ─────────────

  private pick(): PopcornAttack {
    if (this.deck.length === 0) {
      const all: PopcornAttack[] = ['lob', 'spray', 'overflow'];
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
  beginAttack(game: Game, boss: Enemy, kind: PopcornAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'lob':
        this.lobsPlanned = this.finale ? 3 : boss.phaseIndex >= 1 ? 2 : 1;
        this.lobsLeft = this.lobsPlanned;
        this.blinked = false;
        this.pickBlink(game, boss);
        game.fx.burst('LOB!', boss.body.x, boss.body.y - 100, 1.2, '#ffe08a', true);
        game.audio.play('hiss', 0.7);
        this.taunt(game, boss, pickLine(['Catch!', 'Hot potato!', 'Pop quiz!']));
        break;
      case 'spray':
        this.aimSpray(game, boss);
        this.sprayVolleys = 0;
        this.sprayHit = false;
        game.fx.burst('SPRAY!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Open wide!', 'Kernel panic!']));
        break;
      case 'overflow':
        game.fx.burst('OVERFLOW!', boss.body.x, boss.body.y - 100, 1.3, '#ff9f9f', true);
        game.audio.play('alarm', 0.6);
        this.taunt(game, boss, pickLine(['Too full!', "I'm about to POP!"]));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.blinkTo = null;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.hint('EXTRA BUTTER', 'shorter fuses, more bombs', 2.6);
    game.fx.burst('EXTRA BUTTER!', boss.body.x, boss.body.y - 112, 1.5, '#ffe08a', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,224,138,0.9)', 6);
    game.fx.flash('#ffe08a', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'NOW IT GETS HOT!', '#ffe08a', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#fff4c2', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── LOB ─────────────

  private pickBlink(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    let best: { x: number; y: number } | null = null;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU;
      const r = 260 + Math.random() * 120;
      const x = Math.min(bounds.x1 - 70, Math.max(bounds.x0 + 70, p.x + Math.cos(a) * r));
      const y = Math.min(bounds.y1 - 70, Math.max(bounds.y0 + 70, p.y + Math.sin(a) * r));
      if (!best || Math.hypot(x - p.x, y - p.y) > Math.hypot(best.x - p.x, best.y - p.y)) best = { x, y };
    }
    this.blinkTo = best;
    void boss;
  }

  private runLob(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const fast = this.finale ? 0.75 : 1;
    if (this.stage === 'windup') {
      if (!this.blinked) {
        if (this.stageT >= 0.8 * fast) {
          this.blinked = true;
          if (this.blinkTo) {
            game.particles.burst('dust', b.x, b.y, 4, 160, { color: '#fff4c2' });
            game.fx.ring(b.x, b.y, 6, 70, 0.3, 'rgba(255,244,194,0.9)', 4);
            b.x = this.blinkTo.x;
            b.y = this.blinkTo.y;
            game.particles.burst('dust', b.x, b.y, 4, 160, { color: '#fff4c2' });
            game.fx.ring(b.x, b.y, 6, 70, 0.3, 'rgba(255,244,194,0.9)', 4);
            game.audio.play('hiss', 0.6);
          }
          this.blinkTo = null;
          this.stageT = 0;
        }
        return;
      }
      boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      if (this.stageT >= 0.55 * fast) {
        this.stage = 'go';
        this.stageT = 0;
        this.lobAt = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.lobsLeft > 0 && this.stageT >= this.lobAt) {
        this.lobBomb(game, boss);
        this.lobsLeft--;
        this.lobAt = this.stageT + 0.4;
      }
      if (this.lobsLeft <= 0) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  private lobBomb(game: Game, boss: Enemy): void {
    if (this.bombs.length >= MAX_BOMBS) return;
    const b = boss.body;
    const p = game.player.body;
    const spread = (Math.random() - 0.5) * 0.5;
    const ang = Math.atan2(p.y - b.y, p.x - b.x) + spread;
    const obj = game.spawnObject('ball', b.x + Math.cos(ang) * 50, b.y + Math.sin(ang) * 50);
    if (!obj) return;
    const sp = this.lobsPlanned === 1 && this.intro !== 'done' ? 260 : 340;
    obj.body.vx = Math.cos(ang) * sp;
    obj.body.vy = Math.sin(ang) * sp;
    this.addBomb(game, obj);
    game.audio.play('swipe', 0.6);
    game.fx.burst('POP!', b.x, b.y - 80, 0.7, '#fff4c2', true);
    boss.squash = 0.6;
  }

  private addBomb(game: Game, obj: PhysicsObject): void {
    const max = this.finale ? FUSE_FINALE : FUSE;
    this.bombs.push({ obj, fuse: max, max });
    game.fx.ring(obj.body.x, obj.body.y, 4, 36, 0.3, 'rgba(255,224,138,0.9)', 3);
  }

  // ───────────── SPRAY ─────────────

  private aimSpray(game: Game, boss: Enemy): void {
    const b = boss.body;
    const p = game.player.body;
    this.sprayAngle = Math.atan2(p.y - b.y, p.x - b.x);
  }

  private runSpray(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 0.75 : 0.95;
    const volleys = this.finale ? 4 : overtime ? 3 : 2;
    if (this.stage === 'windup') {
      // he tracks you until the last quarter second
      if (this.stageT < windup - 0.25) this.aimSpray(game, boss);
      boss.facing = this.sprayAngle;
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.sprayVolleys = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.sprayVolleys < volleys && this.stageT >= this.sprayVolleys * 0.28) {
        this.sprayVolleys++;
        game.audio.play('swipe', 0.7);
        for (let i = 0; i < 5; i++) {
          const a = this.sprayAngle + (Math.random() - 0.5) * SPRAY_HALF_ARC * 2;
          game.particles.burst('spark', b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 40, 1, 300 + Math.random() * 120, { color: '#fff4c2' });
        }
        const p = game.player;
        if (!this.sprayHit && p.alive) {
          const dx = p.body.x - b.x;
          const dy = p.body.y - b.y;
          const d = Math.hypot(dx, dy);
          let da = Math.atan2(dy, dx) - this.sprayAngle;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (d < SPRAY_RANGE && Math.abs(da) < SPRAY_HALF_ARC + 0.1 && p.hurt(game, 1, 'Kernel spray')) {
            this.sprayHit = true;
            p.body.applyImpulse((dx / d) * 220 * p.body.mass, (dy / d) * 220 * p.body.mass);
          }
        }
      }
      if (this.sprayVolleys >= volleys && this.stageT > volleys * 0.28 + 0.2) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  // ───────────── OVERFLOW ─────────────

  private runOverflow(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 1.2 : 1.5;
    if (this.stage === 'windup') {
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.rings.push({ age: 0, hit: false });
        game.fx.burst('BOOM!', b.x, b.y - 90, 1.4, '#ffe08a', true);
        game.fx.ring(b.x, b.y, 10, OVERFLOW_RADIUS, 0.4, 'rgba(255,224,138,0.9)', 6);
        game.particles.burst('spark', b.x, b.y - 20, 8, 340, { color: '#fff4c2' });
        game.audio.play('explosion', 0.8);
        game.hitStop(0.08);
        // an instant blast around him
        const p = game.player;
        const dx = p.body.x - b.x;
        const dy = p.body.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (p.alive && d < OVERFLOW_RADIUS && p.hurt(game, 1, 'Overflow')) {
          p.body.applyImpulse((dx / d) * 320 * p.body.mass, (dy / d) * 320 * p.body.mass);
        }
        // he is spent; the overflow left bombs behind
        this.attack = null;
        this.spent = SPENT_SECONDS;
        this.fill = 0;
        boss.squash = 1;
        game.hud.hint('EMPTY TUB', 'hit him now, and throw the bombs', 2.4);
        const n = this.finale ? 3 : 2;
        for (let i = 0; i < n && this.bombs.length < MAX_BOMBS; i++) {
          const a = (i / n) * TAU + Math.random() * 1.2;
          const obj = game.spawnObject('ball', b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60);
          if (!obj) continue;
          obj.body.vx = Math.cos(a) * 260;
          obj.body.vy = Math.sin(a) * 260;
          this.addBomb(game, obj);
        }
        this.taunt(game, boss, 'Ugh... so empty...', '#ffe9a8', true);
      }
      return;
    }
    void overtime;
  }

  private updateRings(game: Game, boss: Enemy, dt: number): void {
    // (kept for the visual shockwave only; the damage is the instant blast above)
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i]!.age += dt;
      if (this.rings[i]!.age > 0.5) this.rings.splice(i, 1);
    }
    void game;
    void boss;
  }

  // ───────────── bombs ─────────────

  private updateBombs(game: Game, boss: Enemy, dt: number): void {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i]!;
      if (!bomb.obj.alive) {
        this.bombs.splice(i, 1);
        continue;
      }
      bomb.fuse -= dt;
      const o = bomb.obj.body;
      const hitBoss = bomb.obj.thrownByPlayer && Math.hypot(o.x - boss.body.x, o.y - boss.body.y) < boss.type.radius + 16;
      if (bomb.fuse <= 0 || hitBoss) {
        this.burst(game, boss, bomb);
        this.bombs.splice(i, 1);
      }
    }
  }

  private burst(game: Game, boss: Enemy, bomb: Bomb): void {
    const o = bomb.obj.body;
    const x = o.x;
    const y = o.y;
    bomb.obj.destroy(game);
    game.fx.ring(x, y, 8, BURST_RADIUS, 0.4, 'rgba(255,244,194,0.95)', 5);
    game.fx.burst('POP!', x, y - 30, 1.0, '#fff4c2', true);
    game.particles.burst('spark', x, y - 8, 6, 280, { color: '#fff4c2' });
    game.audio.play('explosion', 0.55);
    const p = game.player;
    const dp = Math.hypot(p.body.x - x, p.body.y - y);
    if (p.alive && dp < BURST_RADIUS && p.hurt(game, 1, 'Kernel bomb')) {
      const d = dp || 1;
      p.body.applyImpulse(((p.body.x - x) / d) * 260 * p.body.mass, ((p.body.y - y) / d) * 260 * p.body.mass);
    }
    if (!boss.defeated && Math.hypot(boss.body.x - x, boss.body.y - y) < BURST_RADIUS + boss.type.radius * 0.6) {
      game.fx.burst('SELF-POP!', boss.body.x, boss.body.y - 96, 1.3, '#ffd23f', true);
      game.hitStop(0.1);
      this.bypassDamage(game, boss, boss.maxHp * BOMB_DAMAGE, x, y);
      if (!boss.defeated) {
        boss.stun = Math.max(boss.stun, 1.2);
        boss.squash = 1;
      }
    }
  }

  private bypass = false;

  private bypassDamage(game: Game, boss: Enemy, amount: number, fromX: number, fromY: number): void {
    const dx = boss.body.x - fromX;
    const dy = boss.body.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.bypass = true;
    boss.damage(game, amount, {
      type: 'explosion', source: null, chain: null, label: 'his own bomb', dirX: dx / d, dirY: dy / d,
    });
    this.bypass = false;
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // bombs: the burst radius shows as the fuse runs low
    for (const bomb of this.bombs) {
      if (!bomb.obj.alive) continue;
      const left = bomb.fuse / bomb.max;
      const a = left < 0.4 ? 0.2 + 0.2 * pulse : 0.08;
      ctx.fillStyle = `rgba(255, 90, 70, ${a.toFixed(3)})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${left < 0.4 ? 0.8 : 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bomb.obj.body.x, bomb.obj.body.y, BURST_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // lob: where he will pop out
    if (this.blinkTo) {
      ctx.strokeStyle = `rgba(255, 224, 138, ${0.55 + 0.35 * pulse})`;
      ctx.fillStyle = `rgba(255, 224, 138, ${0.1 + 0.1 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.blinkTo.x, this.blinkTo.y, boss.type.radius + 12, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // spray cone
    if (this.attack === 'spray' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      ctx.fillStyle = live ? 'rgba(255, 90, 70, 0.3)' : `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${live ? 0.9 : 0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, SPRAY_RANGE, this.sprayAngle - SPRAY_HALF_ARC, this.sprayAngle + SPRAY_HALF_ARC);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // overflow: the circle fills as he boils
    if (this.attack === 'overflow' && this.stage === 'windup') {
      const f = Math.min(1, this.stageT / (this.finale ? 1.2 : 1.5));
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + 0.16 * f * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, OVERFLOW_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 224, 138, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, OVERFLOW_RADIUS * f, 0, TAU);
      ctx.fill();
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    // the bombs: a hot golden orb with a fuse ring that runs down
    for (const bomb of this.bombs) {
      if (!bomb.obj.alive) continue;
      const o = bomb.obj.body;
      const left = Math.max(0, bomb.fuse / bomb.max);
      const hot = left < 0.4;
      const cy = o.y - o.z - 8;
      ctx.beginPath();
      ctx.arc(o.x, cy, 13, 0, TAU);
      ctx.fillStyle = hot && Math.sin(time * 26) > 0 ? '#ff7a5a' : '#ffe08a';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = hot ? '#e5383b' : '#7a4a20';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(o.x, cy, 18, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(bomb.fuse)), o.x, cy + 1);
    }
    if (this.spent > 0) {
      const b = boss.body;
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 24;
        const sy = b.y - 84 + Math.sin(a) * 6;
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
