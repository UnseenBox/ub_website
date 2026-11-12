import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * CABLE KRAKEN: "do not lick."
 *
 * A FIGHT ABOUT THE POWER. He is fed by FOUR SOCKETS in the corners, each joined to him by a live cable.
 * Every powered cable is armour: hit him while all four are live and it barely registers (POWERED).
 * Cut a cable (throw anything through it, or into its socket) and the socket fries, the feedback
 * bites him and the armour thins. Cut all four and it is a BLACKOUT: he is drained, helpless, and
 * takes +60% until the sockets reboot one by one.
 *
 * But the same sockets arm his grid: powered sockets fire LIVE BEAMS to each other across the floor.
 * The beam is only a warning line for a moment, then it burns. So the corners are where the fight is.
 *
 * ATTACKS (telegraphed, shuffled):
 *   ARC     two powered sockets light a beam between them: a thin line warns, then it burns.
 *   LASH    a plug whips round him: a fan shows where.
 *   SURGE   he swells with charge: a circle grows, then it blows. Get out of it.
 * Below a quarter health it is HIGH VOLTAGE: sockets reboot faster and the moves come quicker.
 *
 * THE ENTRANCE. The lights flicker out. One by one the four sockets ignite with a crack and a cable
 * snakes out of each to the heap in the middle, and he rises out of the tangle. First move: an arc,
 * so the line-then-burn rule is the first thing you learn.
 */

export const POWER_STEP = 0.18;
export const POWER_FLOOR = 0.3;
export const BLACKOUT_BONUS = 1.6;
/** Fraction of his max health the feedback of a cut cable takes. */
export const CUT_DAMAGE = 0.03;
const BLACKOUT_SECONDS = 3.8;
const REBOOT = 9;
const REBOOT_FINALE = 6;
const NODE_R = 46;
const CABLE_R = 20;
const ARC_WIDTH = 24;
const ARC_WARN = 1.2;
const ARC_LIVE = 1.5;
const LASH_RANGE = 185;
const LASH_HALF_ARC = 0.8;
const SURGE_RADIUS = 215;
const GAP = 3.0;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.5;

export type CablesAttack = 'arc' | 'lash' | 'surge';

interface Node { x: number; y: number; powered: boolean; reboot: number; flash: number }
interface Beam { a: number; b: number; t: number; hitCd: number }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class CablesScript implements BossScript {
  readonly deathText = 'UNPLUGGED!';

  time = 0;
  finale = false;
  nodes: Node[] = [];
  /** Seconds of blackout left. */
  blackout = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private chipAt = -9;
  private gap = 2.5;
  private deck: CablesAttack[] = [];
  private lastKind: CablesAttack | null = null;

  intro: 'wake' | 'done' = 'wake';
  introT = 0;
  private lit = 0;

  attack: CablesAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  beams: Beam[] = [];
  private beamsPlanned = 1;
  // lash
  lashAngle = 0;
  private lashes = 0;
  private lashHit = false;
  // surge
  private surged = false;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.blackout > 0;
  }

  get powered(): number {
    return this.nodes.filter((n) => n.powered).length;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    if (this.nodes.length === 0) this.layoutNodes(game);
    for (const n of this.nodes) n.flash = Math.max(0, n.flash - dt * 3);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.reboots(game, dt);
    this.checkCuts(game, boss);
    this.updateBeams(game, dt);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'HIGH VOLTAGE!', '#ffe066', true);
    }

    if (this.blackout > 0) {
      this.blackout -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.blackout <= 0) this.rebootAll(game, boss);
      return;
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'arc': this.runArc(game, boss, overtime); break;
        case 'lash': this.runLash(game, boss, overtime); break;
        case 'surge': this.runSurge(game, boss, overtime); break;
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
    if (this.blackout > 0) return amount * BLACKOUT_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.chipAt > 1.3) {
      this.chipAt = game.time;
      game.fx.burst('POWERED!', boss.body.x, boss.body.y - 96, 0.8, '#ffe066', true);
    }
    return amount * Math.max(POWER_FLOOR, 1 - POWER_STEP * this.powered);
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.beams.length = 0;
    for (const n of this.nodes) n.powered = false;
    game.popup('...bzzt... off.', boss.body.x, boss.body.y - 124, '#ffe066', 20, 2.4);
  }

  aimPoints(): ReadonlyArray<{ x: number; y: number }> | null {
    const pts = this.nodes.filter((n) => n.powered).map((n) => ({ x: n.x, y: n.y }));
    return pts.length > 0 ? pts : null;
  }

  // ───────────── the grid ─────────────

  private layoutNodes(game: Game): void {
    const b = game.world.bounds;
    const m = 90;
    this.nodes = [
      { x: b.x0 + m, y: b.y0 + m, powered: false, reboot: 0, flash: 0 },
      { x: b.x1 - m, y: b.y0 + m, powered: false, reboot: 0, flash: 0 },
      { x: b.x1 - m, y: b.y1 - m, powered: false, reboot: 0, flash: 0 },
      { x: b.x0 + m, y: b.y1 - m, powered: false, reboot: 0, flash: 0 },
    ];
  }

  private reboots(game: Game, dt: number): void {
    if (this.blackout > 0) return;
    for (const n of this.nodes) {
      if (n.powered || n.reboot <= 0) continue;
      n.reboot -= dt;
      if (n.reboot <= 0) {
        n.powered = true;
        n.flash = 1;
        game.fx.ring(n.x, n.y, 8, 70, 0.35, 'rgba(255,224,102,0.9)', 4);
        game.audio.play('zap', 0.4);
      }
    }
  }

  private rebootAll(game: Game, boss: Enemy): void {
    this.nodes.forEach((n, i) => {
      n.reboot = 0.4 + i * 0.5;
    });
    game.fx.burst('REBOOT!', boss.body.x, boss.body.y - 96, 1.0, '#ffe066', true);
    this.gap = 1.4;
  }

  /** A thrown object through a cable, or into a socket, fries that socket. */
  private checkCuts(game: Game, boss: Enemy): void {
    if (this.blackout > 0) return;
    for (const o of game.objects) {
      if (!o.alive || !o.thrownByPlayer || o.body.speed() < 110) continue;
      const r = o.body.boundR;
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i]!;
        if (!n.powered) continue;
        const atNode = Math.hypot(o.body.x - n.x, o.body.y - n.y) < NODE_R + r;
        const onCable = segDist(o.body.x, o.body.y, n.x, n.y, boss.body.x, boss.body.y) < CABLE_R + r
          && Math.hypot(o.body.x - boss.body.x, o.body.y - boss.body.y) > boss.type.radius;
        if (atNode || onCable) this.cut(game, boss, i, o.body.x, o.body.y);
      }
    }
  }

  /** Fries one socket. Public so a test can cut without aiming. */
  cut(game: Game, boss: Enemy, i: number, x: number, y: number): void {
    const n = this.nodes[i]!;
    if (!n.powered) return;
    n.powered = false;
    n.flash = 1;
    n.reboot = this.finale ? REBOOT_FINALE : REBOOT;
    // a beam from that socket dies with it
    this.beams = this.beams.filter((bm) => bm.a !== i && bm.b !== i);
    game.fx.burst('SNIP!', x, y - 30, 1.1, '#ffe066', true);
    game.fx.ring(n.x, n.y, 8, 90, 0.4, 'rgba(255,224,102,0.95)', 5);
    game.particles.burst('spark', x, y - 10, 6, 300, { color: '#ffe066' });
    game.audio.play('zap', 0.8);
    game.hitStop(0.06);
    this.bypassDamage(game, boss, boss.maxHp * CUT_DAMAGE, n.x, n.y);
    if (boss.defeated) return;
    if (this.powered === 0) this.goDark(game, boss);
  }

  private goDark(game: Game, boss: Enemy): void {
    this.blackout = BLACKOUT_SECONDS;
    this.attack = null;
    this.beams.length = 0;
    boss.squash = 1;
    boss.body.vx = 0;
    boss.body.vy = 0;
    game.fx.burst('BLACKOUT!', boss.body.x, boss.body.y - 100, 1.5, '#9fd8ff', true);
    game.fx.flash('#9fd8ff', 0.1);
    game.audio.play('alarm', 0.8);
    game.hud.hint('BLACKOUT', 'hit him while the power is out', 2.4);
    this.taunt(game, boss, pickLine(['Who turned off the lights?!', 'My cables!']), '#bfe6ff', true);
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
    }
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    while (this.lit < 4 && this.introT >= 0.7 + this.lit * 0.6) {
      const n = this.nodes[this.lit]!;
      n.powered = true;
      n.flash = 1;
      this.lit++;
      game.fx.burst('ZZZAP!', n.x, n.y - 30, 1.0, '#ffe066', true);
      game.fx.ring(n.x, n.y, 8, 90, 0.4, 'rgba(255,224,102,0.95)', 5);
      game.particles.burst('spark', n.x, n.y - 10, 6, 280, { color: '#ffe066' });
      game.audio.play('zap', 0.5 + this.lit * 0.1);
    }
    if (this.introT >= 3.4 && this.lit >= 4) {
      game.fx.burst('CABLE KRAKEN!', b.x, b.y - 104, 1.4, '#ffe066', true);
      game.fx.ring(b.x, b.y, 10, 240, 0.5, 'rgba(255,224,102,0.9)', 5);
      game.audio.play('alarm', 0.6);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      game.hint('CUT THE CABLES', 'throw things through the cables or into the sockets', 3.6, 'boss:CablesScript');
      this.taunt(game, boss, pickLine(['Feeling charged?', 'Do not lick.', 'Plug in!']), '#fff0a0', true);
      this.finishIntro(game, boss);
    }
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithArc = true): void {
    if (this.nodes.length === 0) this.layoutNodes(game);
    for (const n of this.nodes) {
      n.powered = true;
      n.reboot = 0;
    }
    this.lit = 4;
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.2;
    this.deck = ['surge', 'lash'];
    if (openWithArc) this.beginAttack(game, boss, 'arc');
  }

  // ───────────── director ─────────────

  private pick(): CablesAttack {
    if (this.deck.length === 0) {
      const all: CablesAttack[] = ['arc', 'lash', 'surge'];
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
  beginAttack(game: Game, boss: Enemy, kind: CablesAttack): void {
    if (kind === 'arc' && this.powered < 2) kind = 'lash';
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'arc':
        this.beamsPlanned = this.finale || boss.phaseIndex >= 1 ? 2 : 1;
        this.armBeams(game);
        game.fx.burst('ARC!', boss.body.x, boss.body.y - 100, 1.2, '#ffe066', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Cross the line!', 'Wired!']));
        break;
      case 'lash':
        this.lashes = this.finale ? 2 : 1;
        this.aimLash(game, boss);
        this.lashHit = false;
        game.fx.burst('LASH!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Crack!', 'Plug this!']));
        break;
      case 'surge':
        this.surged = false;
        game.fx.burst('SURGE!', boss.body.x, boss.body.y - 100, 1.3, '#ff9f9f', true);
        game.audio.play('alarm', 0.6);
        this.taunt(game, boss, pickLine(['Overload!', 'Maximum power!']));
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
    game.hud.hint('HIGH VOLTAGE', 'sockets reboot faster', 2.6);
    game.fx.burst('HIGH VOLTAGE!', boss.body.x, boss.body.y - 112, 1.5, '#ffe066', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,224,102,0.9)', 6);
    game.fx.flash('#ffe066', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'FULL POWER!', '#ffe066', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#fff0a0', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── ARC ─────────────

  private armBeams(game: Game): void {
    const live = this.nodes.map((n, i) => (n.powered ? i : -1)).filter((i) => i >= 0);
    // prefer the pair nearest the player so it matters
    const p = game.player.body;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) pairs.push([live[i]!, live[j]!]);
    pairs.sort((u, v) => {
      const du = segDist(p.x, p.y, this.nodes[u[0]]!.x, this.nodes[u[0]]!.y, this.nodes[u[1]]!.x, this.nodes[u[1]]!.y);
      const dv = segDist(p.x, p.y, this.nodes[v[0]]!.x, this.nodes[v[0]]!.y, this.nodes[v[1]]!.x, this.nodes[v[1]]!.y);
      return du - dv;
    });
    this.beams = [];
    const used = new Set<number>();
    for (const [a, b] of pairs) {
      if (this.beams.length >= this.beamsPlanned) break;
      if (used.has(a) || used.has(b)) continue;
      used.add(a);
      used.add(b);
      this.beams.push({ a, b, t: 0, hitCd: 0 });
    }
    if (this.beams.length === 0 && pairs[0]) this.beams.push({ a: pairs[0][0], b: pairs[0][1], t: 0, hitCd: 0 });
  }

  private runArc(game: Game, boss: Enemy, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    // the beams count their own time in updateBeams; the attack ends when they are gone
    if (this.stage === 'windup' && this.stageT >= ARC_WARN) {
      this.stage = 'go';
      this.stageT = 0;
      game.audio.play('zap', 0.9);
    }
    if (this.stage === 'go' && (this.beams.length === 0 || this.stageT >= ARC_LIVE)) {
      this.beams.length = 0;
      this.stage = 'recover';
      this.stageT = 0;
    }
    if (this.stage === 'recover' && this.stageT > 0.7) this.endAttack(overtime);
  }

  private updateBeams(game: Game, dt: number): void {
    if (this.beams.length === 0) return;
    const p = game.player;
    for (const bm of this.beams) {
      bm.t += dt;
      bm.hitCd -= dt;
      if (this.stage !== 'go' || this.attack !== 'arc') continue;
      const a = this.nodes[bm.a]!;
      const b = this.nodes[bm.b]!;
      if (p.alive && bm.hitCd <= 0 && segDist(p.body.x, p.body.y, a.x, a.y, b.x, b.y) < ARC_WIDTH / 2 + p.body.boundR * 0.35) {
        if (p.hurt(game, 1, 'Live beam')) {
          bm.hitCd = 0.9;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const dx = p.body.x - mx;
          const dy = p.body.y - my;
          const d = Math.hypot(dx, dy) || 1;
          p.body.applyImpulse((dx / d) * 260 * p.body.mass, (dy / d) * 260 * p.body.mass);
        }
      }
    }
  }

  // ───────────── LASH ─────────────

  private aimLash(game: Game, boss: Enemy): void {
    this.lashAngle = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
  }

  private runLash(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 0.8 : 1.0;
    if (this.stage === 'windup') {
      if (this.stageT < windup - 0.25) this.aimLash(game, boss);
      boss.facing = this.lashAngle;
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.fireLash(game, boss);
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.stageT > 0.25) {
        this.lashes--;
        if (this.lashes > 0) {
          this.stage = 'windup';
          this.stageT = 0;
          this.lashHit = false;
          this.aimLash(game, boss);
        } else {
          this.stage = 'recover';
          this.stageT = 0;
        }
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  private fireLash(game: Game, boss: Enemy): void {
    const b = boss.body;
    game.audio.play('zap', 0.9);
    game.fx.ring(b.x + Math.cos(this.lashAngle) * 90, b.y + Math.sin(this.lashAngle) * 90, 6, 80, 0.25, 'rgba(255,224,102,0.9)', 4);
    game.particles.burst('spark', b.x + Math.cos(this.lashAngle) * 120, b.y + Math.sin(this.lashAngle) * 120, 6, 300, { color: '#ffe066' });
    const p = game.player;
    if (!p.alive || this.lashHit) return;
    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - this.lashAngle;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    if (d < LASH_RANGE + boss.type.radius * 0.4 && Math.abs(da) < LASH_HALF_ARC + 0.1 && p.hurt(game, 1, 'Cable lash')) {
      this.lashHit = true;
      p.body.applyImpulse((dx / d) * 260 * p.body.mass, (dy / d) * 260 * p.body.mass);
    }
  }

  // ───────────── SURGE ─────────────

  private runSurge(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 1.1 : 1.4;
    if (this.stage === 'windup') {
      if (this.stageT >= windup && !this.surged) {
        this.surged = true;
        this.stage = 'recover';
        this.stageT = 0;
        game.fx.burst('ZZZAP!', b.x, b.y - 90, 1.4, '#ffe066', true);
        game.fx.ring(b.x, b.y, 10, SURGE_RADIUS, 0.4, 'rgba(255,224,102,0.95)', 6);
        game.particles.burst('spark', b.x, b.y - 20, 8, 340, { color: '#ffe066' });
        game.audio.play('zap', 1);
        game.hitStop(0.07);
        const p = game.player;
        const dx = p.body.x - b.x;
        const dy = p.body.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (p.alive && d < SURGE_RADIUS && p.hurt(game, 1, 'Surge')) {
          p.body.applyImpulse((dx / d) * 320 * p.body.mass, (dy / d) * 320 * p.body.mass);
        }
      }
      return;
    }
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  // ───────────── damage helper ─────────────

  private bypass = false;

  private bypassDamage(game: Game, boss: Enemy, amount: number, fromX: number, fromY: number): void {
    const dx = boss.body.x - fromX;
    const dy = boss.body.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.bypass = true;
    boss.damage(game, amount, {
      type: 'shock', source: null, chain: null, label: 'cable feedback', dirX: dx / d, dirY: dy / d,
    });
    this.bypass = false;
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated || this.nodes.length === 0) return;
    void game;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the cables from each socket to him
    for (const n of this.nodes) {
      const sag = 22 + Math.sin(time * 2 + n.x) * 4;
      const mx = (n.x + b.x) / 2;
      const my = (n.y + b.y) / 2 + sag;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = n.powered ? '#3a3a4a' : '#2b2b36';
      ctx.lineWidth = 5;
      ctx.stroke();
      if (n.powered) {
        ctx.strokeStyle = `rgba(255, 224, 102, ${0.5 + 0.35 * pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 14]);
        ctx.lineDashOffset = -time * 80;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineCap = 'butt';
    }
    // the sockets
    for (const n of this.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 30, 0, TAU);
      ctx.fillStyle = n.powered ? '#2c2f3d' : '#1a1b22';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = n.powered ? `rgba(255, 224, 102, ${0.6 + 0.4 * pulse})` : 'rgba(120,120,140,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 24, 0, TAU);
      ctx.stroke();
      // two plug slots
      ctx.fillStyle = n.powered ? '#ffe066' : '#555';
      ctx.fillRect(n.x - 9, n.y - 7, 4, 14);
      ctx.fillRect(n.x + 5, n.y - 7, 4, 14);
      if (n.flash > 0) {
        ctx.fillStyle = `rgba(255, 244, 180, ${n.flash * 0.6})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 40 * (1 + (1 - n.flash)), 0, TAU);
        ctx.fill();
      }
    }
    // beams: warn, then burn
    for (const bm of this.beams) {
      const a = this.nodes[bm.a]!;
      const c = this.nodes[bm.b]!;
      const live = this.stage === 'go' && this.attack === 'arc';
      if (live) {
        ctx.strokeStyle = 'rgba(255, 90, 70, 0.35)';
        ctx.lineWidth = ARC_WIDTH + 10;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.strokeStyle = '#fff6b0';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const segs = 9;
        for (let k = 1; k < segs; k++) {
          const u = k / segs;
          const jx = (Math.random() - 0.5) * 14;
          const jy = (Math.random() - 0.5) * 14;
          ctx.lineTo(a.x + (c.x - a.x) * u + jx, a.y + (c.y - a.y) * u + jy);
        }
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(255, 130, 110, ${0.5 + 0.35 * pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255, 90, 70, ${0.06 + 0.08 * pulse})`;
        ctx.strokeStyle = 'rgba(0,0,0,0)';
        ctx.lineWidth = ARC_WIDTH;
        ctx.strokeStyle = `rgba(255, 90, 70, ${0.08 + 0.1 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
    // lash fan
    if (this.attack === 'lash' && this.stage === 'windup') {
      ctx.fillStyle = `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, LASH_RANGE + boss.type.radius * 0.4, this.lashAngle - LASH_HALF_ARC, this.lashAngle + LASH_HALF_ARC);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // surge circle
    if (this.attack === 'surge' && this.stage === 'windup') {
      const f = Math.min(1, this.stageT / (this.finale ? 1.1 : 1.4));
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + 0.16 * f * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, SURGE_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 224, 102, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, SURGE_RADIUS * f, 0, TAU);
      ctx.fill();
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    const b = boss.body;
    if (this.blackout > 0) {
      // dead and dark, with a few sparks leaking
      ctx.fillStyle = 'rgba(10, 12, 24, 0.45)';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 10, boss.type.radius + 6, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 84 + Math.sin(a) * 6;
        ctx.fillStyle = '#9fd8ff';
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
      return;
    }
    // powered pips over his head
    const n = this.nodes.length;
    for (let i = 0; i < n; i++) {
      const cx = b.x + (i - (n - 1) / 2) * 16;
      const cy = b.y - 100;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, TAU);
      ctx.fillStyle = this.nodes[i]!.powered ? '#ffe066' : '#2a2a36';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
