import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE FLUSHER: "do not stand downstream".
 *
 * ARMOUR. The seat lid is down and he is nearly deaf to being hit (45% gets through, CLANG).
 * The lid only lifts when something goes down the bowl. His WHIRLPOOL pulls the room in, and
 * anything that reaches the middle is swallowed and hurts him, whatever its size: FLUSHED!
 * Throw the furniture in, and the lid stays up for a few seconds afterwards.
 *
 * ATTACKS (telegraphed, on a shuffled deck, opening with the easiest):
 *   GEYSERS       circles mark the floor around you, then water erupts through them.
 *   PLUNGER FAN   three plungers fly at you; one that lands slows you right down.
 *   TIDAL WAVE    a wall of water sweeps the room. There is one gap, shown in green.
 *   WHIRLPOOL     the room drains toward him. Walk out of it; dash if you are close.
 * Below a quarter health the pipes burst (BURST PIPE): everything comes faster and in pairs.
 *
 * THE ENTRANCE. A flood surges in through the door and he rides it into the middle of the room,
 * slides to a stop, and the lid slams: FLUSH! Then the first geysers.
 */

export const LID_ARMOUR = 0.45;
export const LID_OPEN_SECONDS = 4.5;
export const INTERRUPT_DAMAGE = 16;
const INTERRUPT_STUN = 1.4;
const VORTEX_RADIUS = 320;
const VORTEX_BOWL = 62;
const VORTEX_WINDUP = 1.1;
const VORTEX_TIME = 3.2;
const WAVE_WINDUP = 1.3;
const WAVE_SPEED = 400;
const WAVE_THICKNESS = 120;
const WAVE_GAP = 170;
const GEYSER_RADIUS = 62;
const GEYSER_FUSE = 1.5;
const PLUNGER_SPEED = 380;
const GAP = 3.0;
const GAP_OVERTIME = 2.4;
const GAP_FINALE = 1.4;

export type FlusherAttack = 'geysers' | 'plungers' | 'wave' | 'vortex';
type Stage = 'windup' | 'go' | 'recover';

interface Plunger { x: number; y: number; vx: number; vy: number; life: number }
interface Geyser { x: number; y: number; t: number; fired: boolean }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class FlusherScript implements BossScript {
  readonly deathText = 'FLUSHED!';

  // ── armour ──
  /** Seconds the lid stays up; while it is down he shrugs hits off. */
  lidOpen = 0;
  finale = false;
  private bypass = false;
  private tauntAt = -9;
  private tauntedHalf = false;
  private clangAt = -9;

  // ── entrance ──
  intro: 'surf' | 'order' | 'done' = 'surf';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private introSpeed = 0;
  private slammed = false;

  // ── attacks ──
  attack: FlusherAttack | null = null;
  stage: Stage = 'windup';
  stageT = 0;
  private gap = 2.4;
  private deck: FlusherAttack[] = [];
  private lastKind: FlusherAttack | null = null;
  time = 0;
  plungers: Plunger[] = [];
  geysers: Geyser[] = [];
  private volley = 0;
  private volleyT = 0;
  private plungerAim = 0;
  // wave
  waveX = 0;
  waveDir = 1;
  waveHoriz = true;
  waveGapAt = 0;
  private waveHit = false;
  waveLive = false;
  // vortex
  vortexSpin = 0;
  private vortexHitCooldown = 0;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done';
  }

  get lidClosed(): boolean {
    return this.lidOpen <= 0;
  }

  get pose(): 'idle' | 'surf' | 'vortex' | 'plunge' | 'slam' {
    if (this.intro === 'surf') return 'surf';
    if (this.intro === 'order') return 'slam';
    if (this.attack === 'vortex') return this.stage === 'windup' ? 'slam' : 'vortex';
    if (this.attack === 'plungers') return 'plunge';
    return 'idle';
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      this.updatePlungers(game, dt);
      return;
    }
    if (this.lidOpen > 0) this.lidOpen -= dt;
    this.vortexHitCooldown -= dt;
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'OVERFLOW!', '#9fe3ff', true);
    }
    this.updatePlungers(game, dt);
    this.updateGeysers(game, dt);

    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);

    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'geysers': this.runGeysers(game, boss, overtime); break;
        case 'plungers': this.runPlungers(game, boss, dt, overtime); break;
        case 'wave': this.runWave(game, boss, dt, overtime); break;
        case 'vortex': this.runVortex(game, boss, dt, overtime); break;
      }
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick(overtime));
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro === 'surf') {
      boss.blockFlash = 1;
      return 0;
    }
    // a heavy hit while he winds up breaks the move
    if (this.attack && this.stage === 'windup' && amount >= INTERRUPT_DAMAGE) {
      this.interrupt(game, boss);
      return amount * 0.6;
    }
    if (this.lidClosed) {
      boss.blockFlash = 1;
      if (game.time - this.clangAt > 1.2) {
        this.clangAt = game.time;
        game.fx.burst('CLANG!', boss.body.x, boss.body.y - 70, 0.8, '#d7e3ee', true);
        game.audio.play('gong', 0.4, 1.4);
      }
      return amount * LID_ARMOUR;
    }
    return amount;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.plungers.length = 0;
    this.geysers.length = 0;
    this.waveLive = false;
    game.popup('...glug.', boss.body.x, boss.body.y - 120, '#bfefff', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'surf') {
      if (!this.introTarget) {
        const bounds = game.world.bounds;
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        this.introTarget = { x: b.x + (cx - b.x) * 0.6, y: b.y + (cy - b.y) * 0.6 };
        game.camera.focus(b.x, b.y, 2.2, 1.07);
        game.audio.play('splash', 1);
      }
      const t = this.introTarget;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(470, d * 3.0);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      boss.walkPhase += dt * 9;
      this.introSpeed = sp / 470;
      if ((d < 24 && this.introT > 1.0) || this.introT > 4.5) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'order';
        this.introT = 0;
        this.slammed = false;
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    if (!this.slammed && this.introT >= 0.5) {
      this.slammed = true;
      game.fx.burst('FLUSH!', b.x, b.y - 100, 1.5, '#7ee0ff', true);
      game.fx.ring(b.x, b.y, 10, 230, 0.55, 'rgba(126,224,255,0.9)', 5);
      game.audio.play('plop', 1);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      this.taunt(game, boss, pickLine(["Welcome to the end of the line.", "You're in over your head.", "Hope you brought a mop."]), '#d8f4ff', true);
    }
    if (this.introT >= 1.3) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithGeysers = true): void {
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.6;
    // easiest first: circles on the floor teach the telegraph
    this.deck = ['wave', 'plungers', 'vortex'];
    if (openWithGeysers) this.beginAttack(game, boss, 'geysers');
  }

  // ───────────── director ─────────────

  private pick(overtime: boolean): FlusherAttack {
    if (this.deck.length === 0) {
      const all: FlusherAttack[] = overtime ? ['geysers', 'plungers', 'wave', 'vortex'] : ['geysers', 'plungers', 'wave', 'vortex'];
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
  beginAttack(game: Game, boss: Enemy, kind: FlusherAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'geysers':
        game.fx.burst('GEYSERS!', boss.body.x, boss.body.y - 96, 1.2, '#7ee0ff', true);
        this.taunt(game, boss, pickLine(["Don't rain on my parade.", 'Watch your step.']));
        this.markGeysers(game, boss);
        break;
      case 'plungers':
        game.fx.burst('PLUNGER FAN!', boss.body.x, boss.body.y - 96, 1.2, '#ff6b5a', true);
        this.plungerAim = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
        this.volley = 0;
        this.volleyT = 0;
        this.taunt(game, boss, pickLine(["Plunger's up!", 'Heads up!']));
        break;
      case 'wave':
        game.fx.burst('TIDAL WAVE!', boss.body.x, boss.body.y - 96, 1.3, '#4ad6e8', true);
        this.armWave(game, boss);
        this.taunt(game, boss, pickLine(['Time to go with the flow.', 'Surf is up!']));
        break;
      case 'vortex':
        game.fx.burst('WHIRLPOOL!', boss.body.x, boss.body.y - 96, 1.3, '#9fe3ff', true);
        game.audio.play('bossWalk', 1);
        this.vortexSpin = Math.random() * TAU;
        this.taunt(game, boss, pickLine(['Time to flush the competition!', 'Going down...']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.waveLive = false;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    this.lidOpen = Math.max(this.lidOpen, 2.5);
    game.hud.hint('BURST PIPE', 'everything comes in pairs', 2.6);
    game.fx.burst('BURST PIPE!', boss.body.x, boss.body.y - 110, 1.5, '#ff5a4e', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(120,220,255,0.9)', 6);
    game.fx.flash('#5ad7ff', 0.15);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'NOTHING LEAVES THIS ROOM DRY!', '#9fe3ff', true);
  }

  private interrupt(game: Game, boss: Enemy): void {
    this.endAttack(boss.phaseIndex >= 1 || this.finale);
    this.gap = Math.max(this.gap, 1.8);
    boss.stun = Math.max(boss.stun, INTERRUPT_STUN);
    boss.squash = 1;
    game.fx.burst('INTERRUPTED!', boss.body.x, boss.body.y - 100, 1.3, '#ffffff', true);
    game.fx.ring(boss.body.x, boss.body.y, 8, 100, 0.4, 'rgba(255,255,255,0.9)', 4);
    game.camera.addShake(0.12);
    game.hitStop(0.07);
    this.taunt(game, boss, 'Gurgle!? Rude.', '#ffe0e0', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e8fbff', force = false): void {
    if (!force && game.time - this.tauntAt < 2.6) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 128, color, 19, 2.2);
  }

  // ───────────── GEYSERS ─────────────

  private markGeysers(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    const n = this.finale ? 6 : boss.phaseIndex >= 1 ? 5 : 4;
    this.geysers.length = 0;
    for (let i = 0; i < n; i++) {
      // one right under you, the rest spread around you
      const a = Math.random() * TAU;
      const r = i === 0 ? 0 : 70 + Math.random() * 130;
      const x = Math.min(bounds.x1 - 50, Math.max(bounds.x0 + 50, p.x + Math.cos(a) * r));
      const y = Math.min(bounds.y1 - 50, Math.max(bounds.y0 + 50, p.y + Math.sin(a) * r));
      this.geysers.push({ x, y, t: 0, fired: false });
    }
  }

  private runGeysers(game: Game, boss: Enemy, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    if (this.stage === 'windup' && this.stageT > GEYSER_FUSE + 0.2) this.stage = 'recover';
    if (this.stage === 'recover' && this.stageT > GEYSER_FUSE + 1.0) this.endAttack(overtime);
  }

  private updateGeysers(game: Game, dt: number): void {
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const g = this.geysers[i]!;
      g.t += dt;
      if (!g.fired && g.t >= GEYSER_FUSE) {
        g.fired = true;
        game.audio.play('splash', 0.5);
        game.particles.burst('water', g.x, g.y, 5, 160);
        const p = game.player;
        if (p.alive && Math.hypot(p.body.x - g.x, p.body.y - g.y) < GEYSER_RADIUS + p.body.boundR * 0.6) {
          if (p.hurt(game, 1, 'Geyser')) {
            const dx = p.body.x - g.x;
            const dy = p.body.y - g.y;
            const d = Math.hypot(dx, dy) || 1;
            p.body.applyImpulse((dx / d) * 260 * p.body.mass, (dy / d) * 260 * p.body.mass);
          }
        }
        for (const o of game.objects) {
          if (!o.alive || o.held || o.def.fixed) continue;
          if (Math.hypot(o.body.x - g.x, o.body.y - g.y) < GEYSER_RADIUS + o.body.boundR) {
            o.body.vz = Math.max(o.body.vz, 300);
            o.body.wake();
          }
        }
      }
      if (g.t > GEYSER_FUSE + 0.55) this.geysers.splice(i, 1);
    }
  }

  // ───────────── PLUNGER FAN ─────────────

  private runPlungers(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    const b = boss.body;
    const volleys = this.finale ? 3 : overtime ? 3 : 2;
    if (this.stage === 'windup') {
      this.plungerAim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      boss.facing = this.plungerAim;
      if (this.stageT >= 0.85) {
        this.stage = 'go';
        this.stageT = 0;
        this.volley = 0;
        this.volleyT = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      this.volleyT -= dt;
      if (this.volleyT <= 0 && this.volley < volleys) {
        this.volleyT = 0.8;
        this.volley++;
        const aim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
        boss.facing = aim;
        for (const off of [-0.32, 0, 0.32]) {
          this.plungers.push({
            x: b.x + Math.cos(aim) * boss.type.radius,
            y: b.y - 8 + Math.sin(aim) * boss.type.radius,
            vx: Math.cos(aim + off) * PLUNGER_SPEED,
            vy: Math.sin(aim + off) * PLUNGER_SPEED,
            life: 3,
          });
        }
        game.audio.play('plop', 0.8);
      }
      if (this.volley >= volleys && this.stageT > volleys * 0.8 + 0.3) this.stage = 'recover';
      return;
    }
    if (this.stageT > volleys * 0.8 + 0.9) this.endAttack(overtime);
  }

  private updatePlungers(game: Game, dt: number): void {
    if (this.plungers.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.plungers.length - 1; i >= 0; i--) {
      const pl = this.plungers[i]!;
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
      pl.life -= dt;
      if (pl.life <= 0 || pl.x < bounds.x0 || pl.x > bounds.x1 || pl.y < bounds.y0 || pl.y > bounds.y1) {
        this.plungers.splice(i, 1);
        continue;
      }
      if (p.alive && Math.hypot(p.body.x - pl.x, p.body.y - pl.y) < p.body.boundR + 11) {
        this.plungers.splice(i, 1);
        if (p.hurt(game, 1, 'Plunger')) {
          p.slowTimer = 2.2;
          p.slowFactor = 0.5;
          game.fx.burst('STUCK!', p.body.x, p.body.y - 50, 0.9, '#ff6b5a', true);
        }
      }
    }
  }

  // ───────────── TIDAL WAVE ─────────────

  private armWave(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    this.waveHoriz = Math.random() < 0.5;
    this.waveDir = Math.random() < 0.5 ? 1 : -1;
    this.waveHit = false;
    this.waveLive = false;
    const lo = this.waveHoriz ? bounds.y0 : bounds.x0;
    const hi = this.waveHoriz ? bounds.y1 : bounds.x1;
    // the gap lands near the player's side half the time, so it is a choice and not luck
    const p = game.player.body;
    const near = this.waveHoriz ? p.y : p.x;
    const random = lo + 110 + Math.random() * (hi - lo - 220);
    this.waveGapAt = Math.random() < 0.5 ? Math.min(hi - 110, Math.max(lo + 110, near + (Math.random() - 0.5) * 260)) : random;
    this.waveX = this.waveDir > 0 ? (this.waveHoriz ? bounds.x0 : bounds.y0) - WAVE_THICKNESS : (this.waveHoriz ? bounds.x1 : bounds.y1) + WAVE_THICKNESS;
    void boss;
  }

  private runWave(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    const bounds = game.world.bounds;
    if (this.stage === 'windup') {
      if (this.stageT >= WAVE_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        this.waveLive = true;
        game.audio.play('splash', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      this.waveX += this.waveDir * WAVE_SPEED * dt;
      const p = game.player;
      const along = this.waveHoriz ? p.body.x : p.body.y;
      const across = this.waveHoriz ? p.body.y : p.body.x;
      const inBand = Math.abs(along - this.waveX) < WAVE_THICKNESS / 2 + p.body.boundR * 0.5;
      const inGap = Math.abs(across - this.waveGapAt) < WAVE_GAP / 2;
      if (p.alive && !this.waveHit && inBand && !inGap) {
        this.waveHit = true;
        if (p.hurt(game, 1, 'Tidal wave')) {
          const ix = this.waveHoriz ? this.waveDir * 320 : 0;
          const iy = this.waveHoriz ? 0 : this.waveDir * 320;
          p.body.applyImpulse(ix * p.body.mass, iy * p.body.mass);
          p.slip = 1.2;
        }
      }
      // the wave carries loose things along with it
      for (const o of game.objects) {
        if (!o.alive || o.held || o.def.fixed) continue;
        const oa = this.waveHoriz ? o.body.x : o.body.y;
        const oc = this.waveHoriz ? o.body.y : o.body.x;
        if (Math.abs(oa - this.waveX) < WAVE_THICKNESS / 2 && Math.abs(oc - this.waveGapAt) >= WAVE_GAP / 2) {
          o.body.applyImpulse((this.waveHoriz ? this.waveDir : 0) * 14 * o.body.mass, (this.waveHoriz ? 0 : this.waveDir) * 14 * o.body.mass);
          o.body.wake();
        }
      }
      const end = this.waveHoriz ? (this.waveDir > 0 ? bounds.x1 : bounds.x0) : (this.waveDir > 0 ? bounds.y1 : bounds.y0);
      if ((this.waveX - end) * this.waveDir > WAVE_THICKNESS) {
        this.waveLive = false;
        // overtime and the finale send a second wave back the other way
        if ((overtime || this.finale) && this.stageT < 20) {
          this.waveDir = -this.waveDir;
          this.waveHit = false;
          const lo = this.waveHoriz ? bounds.y0 : bounds.x0;
          const hi = this.waveHoriz ? bounds.y1 : bounds.x1;
          this.waveGapAt = lo + 110 + Math.random() * (hi - lo - 220);
          this.waveX = this.waveDir > 0 ? (this.waveHoriz ? bounds.x0 : bounds.y0) - WAVE_THICKNESS : (this.waveHoriz ? bounds.x1 : bounds.y1) + WAVE_THICKNESS;
          this.stage = 'windup';
          this.stageT = WAVE_WINDUP * 0.5;
        } else {
          this.stage = 'recover';
          this.stageT = 0;
        }
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  // ───────────── WHIRLPOOL ─────────────

  private runVortex(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    if (this.stage === 'windup') {
      this.vortexSpin += dt * 2;
      if (this.stageT >= VORTEX_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        this.lidOpen = Math.max(this.lidOpen, VORTEX_TIME + LID_OPEN_SECONDS * 0.4);
        game.audio.play('splash', 1);
        game.fx.ring(b.x, b.y, 10, VORTEX_RADIUS, 0.5, 'rgba(126,224,255,0.9)', 5);
      }
      return;
    }
    if (this.stage === 'go') {
      this.vortexSpin += dt * 7;
      const total = VORTEX_TIME * (this.finale ? 1.3 : 1);
      const p = game.player;
      // the room drains toward him
      if (p.alive) {
        const dx = b.x - p.body.x;
        const dy = b.y - p.body.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < VORTEX_RADIUS) {
          const f = 1 - d / VORTEX_RADIUS;
          const accel = 560 * f;
          p.body.applyImpulse((dx / d) * accel * dt * p.body.mass, (dy / d) * accel * dt * p.body.mass);
          if (d < VORTEX_BOWL && this.vortexHitCooldown <= 0 && p.hurt(game, 1, 'Whirlpool')) {
            this.vortexHitCooldown = 0.9;
            game.fx.burst('GULP!', p.body.x, p.body.y - 50, 0.9, '#7ee0ff', true);
          }
        }
      }
      for (const o of [...game.objects]) {
        if (!o.alive || o.held || o.def.fixed) continue;
        const dx = b.x - o.body.x;
        const dy = b.y - o.body.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > VORTEX_RADIUS) continue;
        const f = 1 - d / VORTEX_RADIUS;
        o.body.applyImpulse((dx / d) * 900 * f * dt * o.body.mass, (dy / d) * 900 * f * dt * o.body.mass);
        o.body.wake();
        if (d < VORTEX_BOWL + o.body.boundR * 0.4) this.swallow(game, boss, o);
      }
      if (this.stageT >= total) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  /** Whatever reaches the bowl hurts him, whatever the lid says. */
  private swallow(game: Game, boss: Enemy, o: import('../PhysicsObject').PhysicsObject): void {
    const dmg = Math.min(48, 9 + o.body.mass * 1.1);
    game.fx.burst('FLUSHED!', boss.body.x, boss.body.y - 84, 1.0, '#ffffff', true);
    game.audio.play('plop', 0.8);
    o.destroy(game);
    this.lidOpen = Math.max(this.lidOpen, LID_OPEN_SECONDS);
    this.bypass = true;
    boss.damage(game, dmg, { type: 'impact', source: o, chain: null, label: 'flushed', dirX: 0, dirY: 0 });
    this.bypass = false;
    boss.squash = 1;
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    const bounds = game.world.bounds;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the surge that carries him in
    if (this.intro === 'surf') {
      ctx.fillStyle = 'rgba(90, 200, 235, 0.22)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 6, 110 + this.introSpeed * 80, 56, 0, 0, TAU);
      ctx.fill();
    }
    // geyser circles
    for (const g of this.geysers) {
      const fuse = Math.min(1, g.t / GEYSER_FUSE);
      const live = g.t >= GEYSER_FUSE;
      ctx.fillStyle = live ? 'rgba(160, 235, 255, 0.55)' : `rgba(255, 90, 90, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.9)' : 'rgba(255, 110, 110, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GEYSER_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (!live) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(g.x, g.y, GEYSER_RADIUS * (1 - fuse), 0, TAU);
        ctx.stroke();
      }
    }
    // whirlpool
    if (this.attack === 'vortex' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const ramp = live ? 1 : Math.min(1, this.stageT / VORTEX_WINDUP);
      const R = VORTEX_RADIUS * (live ? 1 : 0.3 + 0.7 * ramp);
      ctx.fillStyle = live ? 'rgba(40, 150, 200, 0.28)' : `rgba(60, 170, 220, ${0.08 + 0.08 * pulse})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = live ? 'rgba(190, 245, 255, 0.85)' : 'rgba(150, 225, 255, 0.5)';
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      // spiral arms
      ctx.lineWidth = 3;
      for (let arm = 0; arm < 4; arm++) {
        ctx.strokeStyle = `rgba(210, 248, 255, ${live ? 0.6 : 0.3})`;
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const t = s / 24;
          const a = this.vortexSpin + arm * (TAU / 4) + t * 2.4;
          const rr = R * (0.12 + 0.88 * t);
          const px = b.x + Math.cos(a) * rr;
          const py = b.y + Math.sin(a) * rr;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // the bowl: where things get swallowed
      ctx.strokeStyle = live ? 'rgba(255, 90, 90, 0.9)' : 'rgba(255, 120, 120, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, VORTEX_BOWL, 0, TAU);
      ctx.stroke();
    }
    // tidal wave
    if (this.attack === 'wave') this.drawWave(ctx, bounds, pulse);
    // plunger aim lines
    if (this.attack === 'plungers' && this.stage === 'windup') {
      ctx.strokeStyle = `rgba(255, 110, 90, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 9]);
      for (const off of [-0.32, 0, 0.32]) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(this.plungerAim + off) * 560, b.y + Math.sin(this.plungerAim + off) * 560);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  private drawWave(ctx: Ctx, bounds: { x0: number; y0: number; x1: number; y1: number }, pulse: number): void {
    const live = this.stage === 'go' && this.waveLive;
    const lo = this.waveHoriz ? bounds.y0 : bounds.x0;
    const hi = this.waveHoriz ? bounds.y1 : bounds.x1;
    const gapLo = this.waveGapAt - WAVE_GAP / 2;
    const gapHi = this.waveGapAt + WAVE_GAP / 2;
    const rect = (a0: number, a1: number, c0: number, c1: number, fill: string, stroke: string): void => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      if (this.waveHoriz) {
        ctx.fillRect(a0, c0, a1 - a0, c1 - c0);
        ctx.strokeRect(a0, c0, a1 - a0, c1 - c0);
      } else {
        ctx.fillRect(c0, a0, c1 - c0, a1 - a0);
        ctx.strokeRect(c0, a0, c1 - c0, a1 - a0);
      }
    };
    const startEdge = this.waveHoriz
      ? (this.waveDir > 0 ? bounds.x0 : bounds.x1)
      : (this.waveDir > 0 ? bounds.y0 : bounds.y1);
    const at = live ? this.waveX : startEdge - this.waveDir * 0; // while warning, show it at the entry edge
    const a0 = at - WAVE_THICKNESS / 2;
    const a1 = at + WAVE_THICKNESS / 2;
    const danger = live ? 'rgba(60, 170, 225, 0.55)' : `rgba(80, 180, 230, ${0.14 + 0.12 * pulse})`;
    const edge = live ? 'rgba(220, 250, 255, 0.95)' : 'rgba(150, 225, 255, 0.7)';
    rect(a0, a1, lo, gapLo, danger, edge);
    rect(a0, a1, gapHi, hi, danger, edge);
    // the safe gap, in green, through the whole room so you can plan the route
    ctx.fillStyle = `rgba(120, 240, 150, ${live ? 0.1 : 0.14 + 0.1 * pulse})`;
    if (this.waveHoriz) ctx.fillRect(bounds.x0, gapLo, bounds.x1 - bounds.x0, WAVE_GAP);
    else ctx.fillRect(gapLo, bounds.y0, WAVE_GAP, bounds.y1 - bounds.y0);
    // arrows showing which way it will come
    if (!live) {
      ctx.fillStyle = `rgba(230, 250, 255, ${0.5 + 0.4 * pulse})`;
      const mid = (lo + hi) / 2;
      for (let k = -2; k <= 2; k++) {
        const c = mid + k * 150;
        if (c > gapLo - 20 && c < gapHi + 20) continue;
        ctx.beginPath();
        if (this.waveHoriz) {
          const x = at + this.waveDir * 26;
          ctx.moveTo(x, c);
          ctx.lineTo(x - this.waveDir * 22, c - 16);
          ctx.lineTo(x - this.waveDir * 22, c + 16);
        } else {
          const y = at + this.waveDir * 26;
          ctx.moveTo(c, y);
          ctx.lineTo(c - 16, y - this.waveDir * 22);
          ctx.lineTo(c + 16, y - this.waveDir * 22);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void boss;
    // erupting geysers
    for (const g of this.geysers) {
      if (g.t < GEYSER_FUSE) continue;
      const t = (g.t - GEYSER_FUSE) / 0.55;
      const h = 110 * Math.sin(Math.min(1, t) * Math.PI);
      const grad = ctx.createLinearGradient(0, g.y - h, 0, g.y);
      grad.addColorStop(0, 'rgba(235, 252, 255, 0.95)');
      grad.addColorStop(1, 'rgba(110, 210, 245, 0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - 22, g.y - h, 44, h);
      ctx.beginPath();
      ctx.ellipse(g.x, g.y - h, 30, 10, 0, 0, TAU);
      ctx.fillStyle = 'rgba(235, 252, 255, 0.95)';
      ctx.fill();
    }
    // plungers
    for (const pl of this.plungers) {
      const a = Math.atan2(pl.vy, pl.vx);
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(a + Math.sin(time * 18) * 0.15);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 12, 3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#c79a5a';
      ctx.fillRect(-16, -2.5, 16, 5);
      ctx.strokeRect(-16, -2.5, 16, 5);
      ctx.fillStyle = '#e23d3a';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(14, -9, 14, 0);
      ctx.quadraticCurveTo(14, 9, 0, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

