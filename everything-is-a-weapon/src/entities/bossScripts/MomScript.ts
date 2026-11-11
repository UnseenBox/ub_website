import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * MOM: "she found the mess. run."
 *
 * A BOSS WHO MAKES RULES. Mom does not fight fair: she fights house rules. Every so often she
 * stops, plants her feet and calls one out, and you have a few seconds to obey:
 *   NO RUNNING!          stand still. Move and it counts as running.
 *   CORNER. NOW.         get into the glowing corner before the timer ends.
 *   NO THROWING!         do not throw anything.
 *   TIDY UP!             pick something up. Anything.
 * Obey and she sighs ("...fine."): her guard drops and she takes extra damage for a few seconds.
 * Break the rule and you are hurt, she heals a little, and she lets you know ("I TOLD YOU!").
 *
 * HER GUARD. The rest of the time she is Mom: anything you throw at her is CAUGHT and
 * CONFISCATED (it is gone, and almost no damage lands). The only way through is her own rules,
 * or fire. Between rules she throws SLIPPERS, three at a time at the lines she shows you.
 * Below a quarter health it is GROUNDED: the rules come back to back and she never stops talking.
 *
 * THE ENTRANCE. The room is dark. The door opens on a silhouette with its arms crossed; the lights
 * snap on; she marches in and demands to know WHO DID THIS?
 */

export const GUARD_CHIP = 0.1;
export const OPEN_BONUS = 1.5;
const OPEN_SECONDS = 4.5;
const RULE_SECONDS = 3.6;
const RULE_SECONDS_FINALE = 2.9;
const MOVE_LIMIT = 80;
const CORNER_RADIUS = 95;
const SLIPPER_SPEED = 340;
const GAP = 4.0;
const GAP_OVERTIME = 3.0;
const GAP_FINALE = 1.2;

export type RuleKind = 'still' | 'corner' | 'nothrow' | 'tidy';
type Attack = 'rule' | 'slippers';

interface Slipper { x: number; y: number; vx: number; vy: number; life: number; spin: number }

const RULE_TEXT: Record<RuleKind, { shout: string; sub: string }> = {
  still: { shout: 'NO RUNNING!', sub: 'stand perfectly still' },
  corner: { shout: 'CORNER. NOW.', sub: 'get into the glowing corner' },
  nothrow: { shout: 'NO THROWING!', sub: 'throw nothing' },
  tidy: { shout: 'TIDY UP!', sub: 'pick something up' },
};

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class MomScript implements BossScript {
  readonly deathText = 'BEDTIME!';

  time = 0;
  finale = false;
  /** Seconds her guard is down (vulnerable). */
  open = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private gap = 3;
  private deck: RuleKind[] = [];
  private lastRule: RuleKind | null = null;
  private slipperNext = false;
  private bypass = false;
  private confiscateAt = -9;

  // ── entrance ──
  intro: 'dark' | 'march' | 'done' = 'dark';
  introT = 0;
  private lit = false;
  private marchTarget: { x: number; y: number } | null = null;
  private asked = false;

  // ── attacks ──
  attack: Attack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  // rule
  rule: RuleKind | null = null;
  ruleT = 0;
  ruleTotal = RULE_SECONDS;
  private ruleFailed = false;
  private ruleThrown = false;
  cornerX = 0;
  cornerY = 0;
  // slippers
  slippers: Slipper[] = [];
  private aimAngle = 0;
  private volleys = 0;
  private volleyT = 0;
  private listening = false;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done';
  }

  get guarded(): boolean {
    return this.open <= 0 && !this.attack;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    if (!this.listening) {
      this.listening = true;
      game.bus.on('OBJECT_THROWN', () => {
        if (this.rule === 'nothrow') this.ruleThrown = true;
      });
    }
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    if (this.open > 0) this.open -= dt;
    this.updateSlippers(game, dt);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'GO TO YOUR ROOM!', '#ffb3b3', true);
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.attack === 'rule') this.runRule(game, boss, dt, overtime);
      else this.runSlippers(game, boss, dt, overtime);
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) {
        if (this.slipperNext) this.beginSlippers(game, boss);
        else this.beginRule(game, boss, this.pickRule());
        this.slipperNext = !this.slipperNext;
      }
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (cause.type === 'fire' || cause.type === 'explosion') return amount;
    if (this.open > 0) return amount * OPEN_BONUS;
    // shouting a rule or throwing slippers: she is distracted
    if (this.attack) return amount * 1.2;
    // otherwise she catches it and takes it away
    boss.blockFlash = 1;
    const src = cause.source;
    if (src && src.kind === 'object' && src.alive && game.time - this.confiscateAt > 0.25) {
      this.confiscateAt = game.time;
      src.destroy(game);
      game.fx.burst('CONFISCATED!', boss.body.x, boss.body.y - 84, 1.0, '#ffd6e8', true);
      game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 2, 100, { color: '#ffd6e8' });
    }
    return amount * GUARD_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.rule = null;
    this.slippers.length = 0;
    game.popup('...goodnight. Love you.', boss.body.x, boss.body.y - 124, '#ffd6e8', 20, 2.6);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'dark') {
      // she stands in the doorway; the lights come on
      b.vx = 0;
      b.vy = 0;
      boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      if (!this.lit && this.introT >= 1.1) {
        this.lit = true;
        game.fx.flash('#fff6d6', 0.25);
        game.fx.burst('CLICK!', b.x, b.y - 96, 1.2, '#fff6d6', true);
        game.audio.play('click', 1);
        game.camera.punchZoom(0.03);
      }
      if (this.introT >= 1.7) {
        this.intro = 'march';
        this.introT = 0;
        const bounds = game.world.bounds;
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        this.marchTarget = { x: b.x + (cx - b.x) * 0.6, y: b.y + (cy - b.y) * 0.6 };
        game.camera.focus(b.x, b.y, 2.2, 1.06);
      }
      return;
    }
    const t = this.marchTarget!;
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 24) {
      const sp = Math.min(150, d * 1.8 + 40);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      boss.walkPhase += dt * 8;
    } else {
      b.vx = 0;
      b.vy = 0;
      boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      if (!this.asked) {
        this.asked = true;
        game.fx.burst('WHO DID THIS?!', b.x, b.y - 100, 1.5, '#ff9fb8', true);
        game.fx.ring(b.x, b.y, 10, 230, 0.5, 'rgba(255,159,184,0.9)', 5);
        game.audio.play('alarm', 0.7);
        game.hitStop(0.05);
        this.taunt(game, boss, pickLine(['I leave you for FIVE MINUTES.', 'Look at this room!', 'I am not angry. I am disappointed.']), '#ffd6e8', true);
      }
    }
    if ((this.asked && this.introT > 3.2) || this.introT > 5) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithRule = true): void {
    this.intro = 'done';
    this.introT = 0;
    this.lit = true;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 2;
    this.slipperNext = true;
    this.deck = ['corner', 'nothrow', 'tidy'];
    if (openWithRule) this.beginRule(game, boss, 'still');
    else this.slipperNext = false;
  }

  // ───────────── rules ─────────────

  private pickRule(): RuleKind {
    if (this.deck.length === 0) {
      const all: RuleKind[] = ['still', 'corner', 'nothrow', 'tidy'];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      if (all[all.length - 1] === this.lastRule) all.unshift(all.pop()!);
      this.deck = all;
    }
    const kind = this.deck.pop()!;
    this.lastRule = kind;
    return kind;
  }

  /** Public so tests can start a specific rule. */
  beginRule(game: Game, boss: Enemy, kind: RuleKind): void {
    this.attack = 'rule';
    this.rule = kind;
    this.stage = 'windup';
    this.stageT = 0;
    this.ruleT = 0;
    this.ruleTotal = this.finale ? RULE_SECONDS_FINALE : RULE_SECONDS;
    this.ruleFailed = false;
    this.ruleThrown = false;
    boss.body.vx = 0;
    boss.body.vy = 0;
    const text = RULE_TEXT[kind];
    game.fx.burst(text.shout, boss.body.x, boss.body.y - 100, 1.5, '#ff9fb8', true);
    game.hud.banner(text.shout, text.sub, this.ruleTotal);
    game.audio.play('alarm', 0.6);
    if (kind === 'corner') this.pickCorner(game);
    this.taunt(game, boss, pickLine(['I will not say it again.', "Don't make me count to three.", 'Young person!']));
  }

  private pickCorner(game: Game): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    const corners: Array<[number, number]> = [
      [bounds.x0 + 110, bounds.y0 + 110], [bounds.x1 - 110, bounds.y0 + 110],
      [bounds.x0 + 110, bounds.y1 - 110], [bounds.x1 - 110, bounds.y1 - 110],
    ];
    // the nearest corner that is not right under you: you must move, but not far
    corners.sort((a, c) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(c[0] - p.x, c[1] - p.y));
    const pick = corners.find((c) => Math.hypot(c[0] - p.x, c[1] - p.y) > 160) ?? corners[1]!;
    this.cornerX = pick[0];
    this.cornerY = pick[1];
  }

  private runRule(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    this.ruleT += dt;
    const p = game.player;
    boss.facing = Math.atan2(p.body.y - boss.body.y, p.body.x - boss.body.x);
    if (this.ruleFailed) {
      if (this.ruleT >= 0.9) this.endAttack(overtime);
      return;
    }
    switch (this.rule) {
      case 'still':
        if (this.ruleT > 0.35 && p.alive && p.body.speed() > MOVE_LIMIT) return this.failRule(game, boss, 'YOU WERE RUNNING!');
        break;
      case 'nothrow':
        if (this.ruleThrown) return this.failRule(game, boss, 'I SAID NO THROWING!');
        break;
      case 'tidy':
        if (p.held) return this.passRule(game, boss);
        break;
      default:
        break;
    }
    if (this.ruleT >= this.ruleTotal) {
      if (this.rule === 'corner') {
        if (Math.hypot(p.body.x - this.cornerX, p.body.y - this.cornerY) < CORNER_RADIUS) this.passRule(game, boss);
        else this.failRule(game, boss, 'I SAID CORNER!');
      } else if (this.rule === 'tidy') {
        this.failRule(game, boss, 'LOOK AT THIS MESS!');
      } else {
        this.passRule(game, boss);
      }
    }
  }

  private passRule(game: Game, boss: Enemy): void {
    this.open = OPEN_SECONDS;
    this.attack = null;
    this.rule = null;
    this.gap = this.finale ? GAP_FINALE : boss.phaseIndex >= 1 ? GAP_OVERTIME : GAP;
    game.fx.burst('...FINE.', boss.body.x, boss.body.y - 100, 1.3, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 100, 0.45, 'rgba(255,210,63,0.9)', 4);
    game.hud.banner('GUARD DOWN', 'she is listening: hit her', 2);
    this.taunt(game, boss, pickLine(['Hmph. Good.', 'Thank you. Was that so hard?']), '#fff3d6', true);
  }

  private failRule(game: Game, boss: Enemy, word: string): void {
    this.ruleFailed = true;
    this.ruleT = 0;
    const p = game.player;
    game.fx.burst(word, boss.body.x, boss.body.y - 100, 1.2, '#ff6b6b', true);
    p.invulnerable = 0;
    p.hurt(game, 1, 'Mom');
    this.bypass = true;
    boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.025);
    this.bypass = false;
    this.taunt(game, boss, pickLine(['I TOLD YOU!', 'Go to your room!']), '#ffb3b3', true);
  }

  // ───────────── slippers ─────────────

  private beginSlippers(game: Game, boss: Enemy): void {
    this.attack = 'slippers';
    this.stage = 'windup';
    this.stageT = 0;
    this.volleys = 0;
    this.volleyT = 0;
    this.aimAngle = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
    game.fx.burst('SLIPPERS!', boss.body.x, boss.body.y - 100, 1.3, '#ffb38a', true);
    this.taunt(game, boss, pickLine(['Not the slipper...', 'Come here!']));
  }

  private runSlippers(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const volleys = this.finale ? 3 : overtime ? 3 : 2;
    if (this.stage === 'windup') {
      this.aimAngle = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      boss.facing = this.aimAngle;
      if (this.stageT >= 0.85) {
        this.stage = 'go';
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      this.volleyT -= dt;
      if (this.volleyT <= 0 && this.volleys < volleys) {
        this.volleyT = 0.75;
        this.volleys++;
        const aim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
        boss.facing = aim;
        for (const off of [-0.3, 0, 0.3]) {
          this.slippers.push({
            x: b.x + Math.cos(aim) * boss.type.radius,
            y: b.y - 8 + Math.sin(aim) * boss.type.radius,
            vx: Math.cos(aim + off) * SLIPPER_SPEED,
            vy: Math.sin(aim + off) * SLIPPER_SPEED,
            life: 3,
            spin: 0,
          });
        }
        game.audio.play('swipe', 0.7);
      }
      if (this.volleys >= volleys && this.stageT > volleys * 0.75 + 0.3) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  private updateSlippers(game: Game, dt: number): void {
    if (this.slippers.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.slippers.length - 1; i >= 0; i--) {
      const s = this.slippers[i]!;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.spin += dt * 14;
      if (s.life <= 0 || s.x < bounds.x0 || s.x > bounds.x1 || s.y < bounds.y0 || s.y > bounds.y1) {
        this.slippers.splice(i, 1);
        continue;
      }
      if (p.alive && Math.hypot(p.body.x - s.x, p.body.y - s.y) < p.body.boundR + 11) {
        this.slippers.splice(i, 1);
        if (p.hurt(game, 1, 'Slipper')) p.body.applyImpulse(s.vx * 0.6 * p.body.mass, s.vy * 0.6 * p.body.mass);
      }
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.rule = null;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.rule = null;
    this.gap = 0.8;
    this.slipperNext = false;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.banner('GROUNDED', 'the rules come faster', 2.6);
    game.fx.burst('GROUNDED!', boss.body.x, boss.body.y - 112, 1.5, '#ff6b6b', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,120,140,0.9)', 6);
    game.fx.flash('#ffb3b3', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'NO DESSERT FOR ANYONE!', '#ffb3b3', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#ffd6e8', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    if (this.attack === 'rule' && !this.ruleFailed) {
      if (this.rule === 'corner') {
        ctx.fillStyle = `rgba(255, 220, 120, ${0.18 + 0.14 * pulse})`;
        ctx.strokeStyle = `rgba(255, 235, 150, ${0.7 + 0.3 * pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.cornerX, this.cornerY, CORNER_RADIUS, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CORNER', this.cornerX, this.cornerY + 6);
        ctx.textAlign = 'start';
      }
    }
    // slipper aim lines
    if (this.attack === 'slippers' && this.stage === 'windup') {
      const b = boss.body;
      ctx.strokeStyle = `rgba(255, 150, 110, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 9]);
      for (const off of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(this.aimAngle + off) * 560, b.y + Math.sin(this.aimAngle + off) * 560);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    // the dark room before the lights come on
    if (this.intro === 'dark') {
      const bounds = game.world.bounds;
      ctx.fillStyle = this.lit ? 'rgba(8, 6, 22, 0)' : 'rgba(8, 6, 22, 0.55)';
      ctx.fillRect(bounds.x0 - 120, bounds.y0 - 120, bounds.x1 - bounds.x0 + 240, bounds.y1 - bounds.y0 + 240);
    }
    const b = boss.body;
    // the sign she holds up while a rule is on
    if (this.attack === 'rule' && this.rule) {
      const text = RULE_TEXT[this.rule];
      const w = 170;
      const x = b.x - w / 2;
      const y = b.y - 168;
      const left = Math.max(0, 1 - this.ruleT / this.ruleTotal);
      ctx.fillStyle = this.ruleFailed ? 'rgba(180, 30, 40, 0.95)' : 'rgba(250, 244, 230, 0.96)';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.fillRect(x, y, w, 38);
      ctx.strokeRect(x, y, w, 38);
      ctx.fillStyle = this.ruleFailed ? '#ffffff' : '#7a1f2e';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text.shout, b.x, y + 17);
      ctx.fillStyle = '#4a3a40';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(text.sub, b.x, y + 31);
      ctx.textAlign = 'start';
      ctx.fillStyle = 'rgba(20,16,24,0.8)';
      ctx.fillRect(x, y + 40, w, 6);
      ctx.fillStyle = left < 0.3 ? '#ff5a4e' : '#ffd23f';
      ctx.fillRect(x, y + 40, w * left, 6);
    }
    // guard: a ring while she is catching things, a gap in it when she is listening
    if (this.intro === 'done' && !this.attack) {
      ctx.strokeStyle = this.open > 0 ? 'rgba(255, 220, 90, 0.8)' : 'rgba(255, 150, 190, 0.45)';
      ctx.lineWidth = this.open > 0 ? 4 : 2.5;
      ctx.setLineDash(this.open > 0 ? [] : [10, 8]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, boss.type.radius + 22 + (this.open > 0 ? 6 * Math.sin(time * 10) : 0), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // slippers in flight
    for (const s of this.slippers) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 12, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e88aa8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff0f6';
      ctx.beginPath();
      ctx.ellipse(4, 0, 6, 4, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
